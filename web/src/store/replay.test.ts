import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	DFAConfig,
	DFASpec,
	DTMConfig,
	DTMSpec,
} from "../contract/schemas.ts";
import {
	selectCanStepBack,
	selectCanStepForward,
	selectCurrentFrame,
	useReplayStore,
} from "./replay.ts";

// api/step をモックし、ネットワークなしで逐次ステップを制御する。
const { stepDfaMock, stepDtmMock, StepErrorMock } = vi.hoisted(() => {
	class StepError extends Error {}
	return {
		stepDfaMock: vi.fn(),
		stepDtmMock: vi.fn(),
		StepErrorMock: StepError,
	};
});
vi.mock("../api/step.ts", () => ({
	StepError: StepErrorMock,
	stepDfa: stepDfaMock,
	stepDtm: stepDtmMock,
}));

const dfaSpec: DFASpec = {
	states: ["Even", "Odd"],
	alphabet: ["a"],
	start: "Even",
	accept: ["Even"],
	transitions: [
		{ from: "Even", read: "a", to: "Odd" },
		{ from: "Odd", read: "a", to: "Even" },
	],
};
const initial: DFAConfig = { state: "Even", rest: ["a", "a"] };

// even-a "aa" のステップ応答列(config の残り入力長で分岐)。
const steps = [
	{
		status: "running" as const,
		config: { state: "Odd", rest: ["a"] },
		fired: { from: "Even", read: "a", to: "Odd" },
	},
	{
		status: "running" as const,
		config: { state: "Even", rest: [] },
		fired: { from: "Odd", read: "a", to: "Even" },
	},
	{
		status: "accept" as const,
		config: { state: "Even", rest: [] },
		fired: null,
	},
];

function sequentialDfa(_spec: DFASpec, config: DFAConfig) {
	if (config.rest.length === 2) {
		return Promise.resolve(steps[0]);
	}
	if (config.rest.length === 1) {
		return Promise.resolve(steps[1]);
	}
	return Promise.resolve(steps[2]);
}

const store = () => useReplayStore.getState();
function start() {
	store().startRun("dfa", dfaSpec, initial);
}

beforeEach(() => {
	useReplayStore.setState(useReplayStore.getInitialState(), true);
	stepDfaMock.mockReset();
	stepDtmMock.mockReset();
	stepDfaMock.mockImplementation(sequentialDfa);
});

describe("replay ストア(逐次ステップ)", () => {
	it("startRun で初期コマ 1 つから始まる", () => {
		start();
		const s = store();
		expect(s.kind).toBe("dfa");
		expect(s.frames).toHaveLength(1);
		expect(s.cursor).toBe(0);
		expect(selectCurrentFrame(s)?.config).toEqual(initial);
		expect(s.frames[0]?.fired).toBeNull();
	});

	it("tip での前進は /step を叩いてコマを push する", async () => {
		start();
		await store().stepForward();
		const s = store();
		expect(stepDfaMock).toHaveBeenCalledTimes(1);
		expect(s.frames).toHaveLength(2);
		expect(s.cursor).toBe(1);
		expect(selectCurrentFrame(s)?.config).toEqual({
			state: "Odd",
			rest: ["a"],
		});
		expect(s.frames[1]?.fired).toEqual({ from: "Even", read: "a", to: "Odd" });
	});

	it("終端まで進むと accept で止まり、それ以上前進しない", async () => {
		start();
		await store().stepForward();
		await store().stepForward();
		await store().stepForward();
		const before = stepDfaMock.mock.calls.length;
		await store().stepForward(); // 既に terminal
		const s = store();
		expect(s.frames).toHaveLength(4); // initial + 3 steps
		expect(s.cursor).toBe(3);
		expect(selectCurrentFrame(s)?.status).toBe("accept");
		expect(selectCanStepForward(s)).toBe(false);
		expect(stepDfaMock.mock.calls.length).toBe(before); // 追加取得なし
	});

	it("履歴内の前進は再取得しない", async () => {
		start();
		await store().stepForward(); // 0->1(取得)
		await store().stepForward(); // 1->2(取得)
		store().stepBack(); // 2->1
		const before = stepDfaMock.mock.calls.length;
		await store().stepForward(); // 1->2(履歴内、再取得なし)
		expect(store().cursor).toBe(2);
		expect(stepDfaMock.mock.calls.length).toBe(before);
	});

	it("goto で任意コマへジャンプし、範囲外はクランプ・再生は止まる", async () => {
		start();
		await store().stepForward();
		await store().stepForward();
		store().play();
		store().goto(1);
		expect(store().cursor).toBe(1);
		expect(store().playing).toBe(false);
		store().goto(99);
		expect(store().cursor).toBe(2); // frames.length-1
		store().goto(-5);
		expect(store().cursor).toBe(0);
	});

	it("先頭では後退できない", () => {
		start();
		expect(selectCanStepBack(store())).toBe(false);
		store().stepBack();
		expect(store().cursor).toBe(0);
	});

	it("取得失敗は error に載り、再生を止める", async () => {
		stepDfaMock.mockReset();
		stepDfaMock.mockRejectedValueOnce(new StepErrorMock("接続できません"));
		start();
		store().play();
		await store().stepForward();
		const s = store();
		expect(s.error).toBe("接続できません");
		expect(s.loading).toBe(false);
		expect(s.playing).toBe(false);
		expect(s.frames).toHaveLength(1); // 追加されない
	});

	it("取得中(loading)は多重前進しない", async () => {
		let resolve: ((v: (typeof steps)[number]) => void) | undefined;
		stepDfaMock.mockReset();
		stepDfaMock.mockReturnValueOnce(
			new Promise((r) => {
				resolve = r;
			}),
		);
		start();
		const p1 = store().stepForward(); // loading=true のまま待機
		expect(store().loading).toBe(true);
		await store().stepForward(); // loading 中なので即 no-op
		expect(stepDfaMock).toHaveBeenCalledTimes(1);
		resolve?.(steps[0]);
		await p1;
		expect(store().frames).toHaveLength(2);
	});

	it("tip 取得中でも履歴内の前進はでき、取得結果は tip へ飛ばさず push だけする", async () => {
		start();
		await store().stepForward(); // cursor1 len2
		await store().stepForward(); // cursor2 len3(tip は running)
		// 次の tip 取得を保留にする。
		let resolveStep: ((v: (typeof steps)[number]) => void) | undefined;
		stepDfaMock.mockImplementationOnce(
			() =>
				new Promise((r) => {
					resolveStep = r;
				}),
		);
		const p = store().stepForward(); // tip fetch pending
		expect(store().loading).toBe(true);
		// 取得中に履歴内へ戻り、さらに履歴内前進(loading でも可)。
		store().goto(0);
		await store().stepForward();
		expect(store().cursor).toBe(1);
		// 取得完了: スクラブ済みなので tip へ飛ばず、コマだけ push。
		resolveStep?.(steps[2]);
		await p;
		expect(store().cursor).toBe(1);
		expect(store().frames).toHaveLength(4);
	});

	it("初回取得中に reset しても cursor は 0 のまま(取得コマへ飛ばない)", async () => {
		stepDfaMock.mockReset();
		let resolveStep: ((v: (typeof steps)[number]) => void) | undefined;
		stepDfaMock.mockImplementationOnce(
			() =>
				new Promise((r) => {
					resolveStep = r;
				}),
		);
		start(); // len1 cursor0
		const p = store().stepForward();
		expect(store().loading).toBe(true);
		store().reset(); // 「最初へ」
		resolveStep?.(steps[0]);
		await p;
		expect(store().cursor).toBe(0); // reset の意図が保たれる
		expect(store().frames).toHaveLength(2); // コマ自体は push される
	});

	it("取得中に別機械へ切り替えると古い応答は破棄される", async () => {
		stepDfaMock.mockReset();
		let resolveStep: ((v: (typeof steps)[number]) => void) | undefined;
		stepDfaMock.mockImplementationOnce(
			() =>
				new Promise((r) => {
					resolveStep = r;
				}),
		);
		start(); // dfa
		const p = store().stepForward(); // pending dfa fetch
		const dtmSpec: DTMSpec = {
			states: ["Q"],
			tapeAlphabet: ["a"],
			start: "Q",
			accept: [],
			transitions: [],
		};
		const dtmInitial: DTMConfig = {
			state: "Q",
			left: [],
			head: null,
			right: [],
		};
		store().startRun("dtm", dtmSpec, dtmInitial); // 機械切替
		expect(store().kind).toBe("dtm");
		resolveStep?.(steps[0]); // 古い dfa 応答が着弾
		await p;
		expect(store().kind).toBe("dtm");
		expect(store().frames).toHaveLength(1); // dfa コマは push されない
		expect(selectCurrentFrame(store())?.config).toEqual(dtmInitial);
	});

	it("終端から play() すると先頭へ戻して再生する", async () => {
		start();
		await store().stepForward();
		await store().stepForward();
		await store().stepForward();
		expect(store().cursor).toBe(3);
		store().play();
		const s = store();
		expect(s.cursor).toBe(0);
		expect(s.playing).toBe(true);
	});

	it("未開始で play() しても再生に入らない", () => {
		store().play();
		expect(store().frames).toHaveLength(0);
		expect(store().playing).toBe(false);
	});
});
