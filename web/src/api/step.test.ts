import { afterEach, describe, expect, it, vi } from "vitest";
import type { DFASpec, DTMSpec } from "../contract/schemas.ts";
import { StepError, stepDfa, stepDtm } from "./step.ts";

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

// fetch のダミー。Response の必要な部分だけをダックタイピングで返す。
function stubFetch(res: { ok: boolean; status: number; json: () => unknown }) {
	const mock = vi.fn(async (_url: string, _init: RequestInit) => res);
	vi.stubGlobal("fetch", mock);
	return mock;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("step API クライアント", () => {
	it("正しい URL / メソッド / ボディで POST し、検証済み応答を返す", async () => {
		const body = {
			status: "running",
			config: { state: "Odd", rest: ["a"] },
			fired: { from: "Even", read: "a", to: "Odd" },
		};
		const fetchMock = stubFetch({ ok: true, status: 200, json: () => body });

		const config = { state: "Even", rest: ["a"] };
		const res = await stepDfa(dfaSpec, config);

		expect(res.status).toBe("running");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("/api/dfa/step");
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body as string)).toEqual({
			machine: dfaSpec,
			config,
		});
	});

	it("非 2xx は StepError を投げる", async () => {
		stubFetch({ ok: false, status: 500, json: () => ({}) });
		await expect(
			stepDfa(dfaSpec, { state: "Even", rest: ["a"] }),
		).rejects.toBeInstanceOf(StepError);
	});

	it("接続失敗(fetch reject)は StepError を投げる", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("network down");
			}),
		);
		await expect(
			stepDfa(dfaSpec, { state: "Even", rest: ["a"] }),
		).rejects.toBeInstanceOf(StepError);
	});

	it("契約違反の応答は例外になる(Zod 検証)", async () => {
		stubFetch({ ok: true, status: 200, json: () => ({ status: "bogus" }) });
		await expect(
			stepDfa(dfaSpec, { state: "Even", rest: ["a"] }),
		).rejects.toThrow();
	});

	it("stepDtm は /api/dtm/step を叩く", async () => {
		const body = {
			status: "accept",
			config: { state: "PA", left: [], head: null, right: [] },
			fired: null,
		};
		const fetchMock = stubFetch({ ok: true, status: 200, json: () => body });
		const dtmSpec: DTMSpec = {
			states: ["PA"],
			tapeAlphabet: ["a"],
			start: "PA",
			accept: ["PA"],
			transitions: [],
		};

		const res = await stepDtm(dtmSpec, {
			state: "PA",
			left: [],
			head: null,
			right: [],
		});

		expect(res.status).toBe("accept");
		expect(fetchMock.mock.calls[0][0]).toBe("/api/dtm/step");
	});
});
