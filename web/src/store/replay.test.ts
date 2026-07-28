import { beforeEach, describe, expect, it } from "vitest";
import type { DFATrace } from "../contract/schemas.ts";
import {
	selectCanStepBack,
	selectCanStepForward,
	selectCurrentFrame,
	useReplayStore,
} from "./replay.ts";

const trace: DFATrace = {
	kind: "dfa",
	machine: "even-a",
	input: "aa",
	initial: { state: "Even", rest: ["a", "a"] },
	steps: [
		{
			status: "running",
			config: { state: "Odd", rest: ["a"] },
			fired: { from: "Even", read: "a", to: "Odd" },
		},
		{
			status: "running",
			config: { state: "Even", rest: [] },
			fired: { from: "Odd", read: "a", to: "Even" },
		},
		{ status: "accept", config: { state: "Even", rest: [] }, fired: null },
	],
};

beforeEach(() => {
	// ストアはシングルトンなのでテスト間で初期状態に戻す。
	useReplayStore.setState(useReplayStore.getInitialState(), true);
});

describe("replay ストア", () => {
	it("トレースを読み込むと初期コンフィグ + 各ステップのコマ列になる", () => {
		useReplayStore.getState().load(trace);
		const s = useReplayStore.getState();
		expect(s.kind).toBe("dfa");
		expect(s.frames).toHaveLength(4); // initial + 3 steps
		expect(s.cursor).toBe(0);
		expect(selectCurrentFrame(s)?.config).toEqual({
			state: "Even",
			rest: ["a", "a"],
		});
		// 各コマに status / fired が正しく載る(先頭は running・fired=null)。
		expect(s.frames[0]?.status).toBe("running");
		expect(s.frames[0]?.fired).toBeNull();
		expect(s.frames[1]?.status).toBe("running");
		expect(s.frames[1]?.fired).toEqual({ from: "Even", read: "a", to: "Odd" });
		expect(s.frames[3]?.status).toBe("accept");
		expect(s.frames[3]?.fired).toBeNull();
	});

	it("前進・後退がコマ内で動く", () => {
		const st = useReplayStore.getState();
		st.load(trace);
		st.stepForward();
		expect(useReplayStore.getState().cursor).toBe(1);
		st.stepBack();
		expect(useReplayStore.getState().cursor).toBe(0);
	});

	it("終端で前進しても cursor は末尾に留まり playing が止まる", () => {
		const st = useReplayStore.getState();
		st.load(trace);
		st.play();
		for (let i = 0; i < 10; i++) {
			st.stepForward();
		}
		const s = useReplayStore.getState();
		expect(s.cursor).toBe(3); // 末尾
		expect(s.playing).toBe(false);
		expect(selectCanStepForward(s)).toBe(false);
		expect(selectCurrentFrame(s)?.status).toBe("accept");
	});

	it("先頭では後退できない", () => {
		useReplayStore.getState().load(trace);
		expect(selectCanStepBack(useReplayStore.getState())).toBe(false);
		useReplayStore.getState().stepBack();
		expect(useReplayStore.getState().cursor).toBe(0);
	});

	it("reset で先頭に戻り停止する", () => {
		const st = useReplayStore.getState();
		st.load(trace);
		st.stepForward();
		st.play();
		st.reset();
		const s = useReplayStore.getState();
		expect(s.cursor).toBe(0);
		expect(s.playing).toBe(false);
	});

	it("play / pause と setSpeed", () => {
		const st = useReplayStore.getState();
		st.load(trace);
		st.play();
		expect(useReplayStore.getState().playing).toBe(true);
		st.pause();
		expect(useReplayStore.getState().playing).toBe(false);
		st.setSpeed(5);
		expect(useReplayStore.getState().speed).toBe(5);
	});

	it("最終コマへ進入した時点で playing を止める(1ティック遅延を避ける)", () => {
		const st = useReplayStore.getState();
		st.load(trace);
		st.play();
		st.stepForward(); // 0 -> 1
		st.stepForward(); // 1 -> 2(まだ中間)
		expect(useReplayStore.getState().playing).toBe(true);
		st.stepForward(); // 2 -> 3(最終)→ 同時に停止
		const s = useReplayStore.getState();
		expect(s.cursor).toBe(3);
		expect(s.playing).toBe(false);
	});

	it("終端から play() すると先頭に戻して再生する", () => {
		const st = useReplayStore.getState();
		st.load(trace);
		for (let i = 0; i < 10; i++) {
			st.stepForward();
		}
		expect(useReplayStore.getState().cursor).toBe(3);
		st.play();
		const s = useReplayStore.getState();
		expect(s.cursor).toBe(0);
		expect(s.playing).toBe(true);
	});

	it("未 load(コマなし)で play() しても再生に入らない", () => {
		useReplayStore.getState().play();
		const s = useReplayStore.getState();
		expect(s.frames).toHaveLength(0);
		expect(s.playing).toBe(false);
	});
});
