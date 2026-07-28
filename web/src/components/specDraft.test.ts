import { describe, expect, it } from "vitest";
import {
	buildSpec,
	type Draft,
	deriveStates,
	deriveSymbols,
	freshState,
} from "./specDraft.ts";

const dfaDraft: Draft = {
	states: ["A", "B"],
	start: "A",
	accept: "A",
	rows: [{ from: "A", read: "a", to: "B", write: "", move: "R" }],
};

const dtmDraft: Draft = {
	states: ["P"],
	start: "P",
	accept: "",
	rows: [{ from: "P", read: "a", to: "P", write: "b", move: "R" }],
};

describe("buildSpec", () => {
	it("DFA の draft から spec を組み立てる(記号は read から自動導出)", () => {
		const { spec, error } = buildSpec(dfaDraft, true);
		expect(error).toBeUndefined();
		expect(spec).toEqual({
			states: ["A", "B"],
			alphabet: ["a"],
			start: "A",
			accept: ["A"],
			transitions: [{ from: "A", read: "a", to: "B" }],
		});
	});

	it("DTM は read と write からテープ記号を自動導出する", () => {
		const { spec } = buildSpec(dtmDraft, false);
		// biome-ignore lint/suspicious/noExplicitAny: テストで spec を緩く読む
		const s = spec as any;
		expect(s.tapeAlphabet).toEqual(["a", "b"]);
		expect(s.transitions[0]).toEqual({
			from: "P",
			read: "a",
			to: "P",
			write: "b",
			move: "R",
		});
	});

	it("DTM の空欄 read/write は null(空白セル)", () => {
		const { spec } = buildSpec(
			{
				...dtmDraft,
				rows: [{ from: "P", read: "", to: "P", write: "", move: "R" }],
			},
			false,
		);
		// biome-ignore lint/suspicious/noExplicitAny: テストで spec を緩く読む
		const s = spec as any;
		expect(s.tapeAlphabet).toEqual([]);
		expect(s.transitions[0]).toEqual({
			from: "P",
			read: null,
			to: "P",
			write: null,
			move: "R",
		});
	});

	it("初期状態が空だとエラー", () => {
		const { spec, error } = buildSpec({ ...dfaDraft, start: "" }, true);
		expect(spec).toBeUndefined();
		expect(error).toMatch(/必須/);
	});

	it("同じ (from, read) が重複するとエラー(決定性)", () => {
		const { error } = buildSpec(
			{
				...dfaDraft,
				rows: [
					{ from: "A", read: "a", to: "B", write: "", move: "R" },
					{ from: "A", read: "a", to: "A", write: "", move: "R" },
				],
			},
			true,
		);
		expect(error).toMatch(/重複/);
	});

	it("未完成の行(from/to が空)は無視する", () => {
		const { spec } = buildSpec(
			{
				...dfaDraft,
				rows: [
					{ from: "A", read: "a", to: "B", write: "", move: "R" },
					{ from: "", read: "", to: "", write: "", move: "R" },
				],
			},
			true,
		);
		// biome-ignore lint/suspicious/noExplicitAny: テストで spec を緩く読む
		expect((spec as any).transitions).toHaveLength(1);
	});

	it("DFA の read が空(from/to は有り)だとエラー", () => {
		const { spec, error } = buildSpec(
			{
				...dfaDraft,
				rows: [{ from: "A", read: "", to: "B", write: "", move: "R" }],
			},
			true,
		);
		expect(spec).toBeUndefined();
		expect(error).toMatch(/1 文字/);
	});
});

describe("deriveStates", () => {
	it("明示 states・start・accept・遷移の from/to を取り込む", () => {
		const states = deriveStates({
			states: ["X"],
			start: "S",
			accept: "T, U",
			rows: [{ from: "A", read: "a", to: "B", write: "", move: "R" }],
		});
		expect(states).toEqual(
			expect.arrayContaining(["X", "S", "T", "U", "A", "B"]),
		);
	});
});

describe("deriveSymbols", () => {
	it("DFA は read のみ、DTM は read+write を集める", () => {
		const rows = [
			{ from: "A", read: "a", to: "B", write: "X", move: "R" as const },
			{ from: "B", read: "b", to: "A", write: "Y", move: "L" as const },
		];
		expect(deriveSymbols(rows, true)).toEqual(["a", "b"]);
		expect(deriveSymbols(rows, false)).toEqual(["a", "X", "b", "Y"]);
	});
});

describe("freshState", () => {
	it("既存と衝突しない最小の qN を返す", () => {
		expect(freshState([])).toBe("q0");
		expect(freshState(["q0", "q1"])).toBe("q2");
		expect(freshState(["q1"])).toBe("q0");
	});
});
