import { describe, expect, it } from "vitest";
import { machines } from "../fixtures/machines.ts";
import {
	addState,
	buildSpec,
	type Draft,
	deleteState,
	deriveStates,
	deriveSymbols,
	draftFromMachine,
	draftGraph,
	freshState,
	invalidRowIndices,
	renameState,
	specSignature,
} from "./specDraft.ts";

const dfaDraft: Draft = {
	states: ["A", "B"],
	start: "A",
	accept: ["A"],
	rows: [{ from: "A", read: "a", to: "B", write: "", move: "R" }],
};

const dtmDraft: Draft = {
	states: ["P"],
	start: "P",
	accept: [],
	rows: [{ from: "P", read: "a", to: "P", write: "b", move: "R" }],
};

// biome-ignore lint/suspicious/noExplicitAny: テストで spec を緩く読む
const asAny = (spec: unknown): any => spec;

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
		const s = asAny(buildSpec(dtmDraft, false).spec);
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
		const s = asAny(
			buildSpec(
				{
					...dtmDraft,
					rows: [{ from: "P", read: "", to: "P", write: "", move: "R" }],
				},
				false,
			).spec,
		);
		expect(s.tapeAlphabet).toEqual([]);
		expect(s.transitions[0]).toEqual({
			from: "P",
			read: null,
			to: "P",
			write: null,
			move: "R",
		});
	});

	it("初期状態が空だと error(spec は作らない)", () => {
		const { spec, error } = buildSpec({ ...dfaDraft, start: "" }, true);
		expect(spec).toBeUndefined();
		expect(error).toMatch(/初期状態/);
	});

	it("無効な遷移(DFA の read 空・決定性違反)は除外して spec を作る", () => {
		// read 空(無効)+ 正常行。read 空は除外され、spec は正常行のみ。
		const s = asAny(
			buildSpec(
				{
					...dfaDraft,
					rows: [
						{ from: "A", read: "a", to: "B", write: "", move: "R" },
						{ from: "A", read: "", to: "A", write: "", move: "R" },
					],
				},
				true,
			).spec,
		);
		expect(s.transitions).toEqual([{ from: "A", read: "a", to: "B" }]);
	});

	it("決定性違反の行は両方とも除外する", () => {
		const s = asAny(
			buildSpec(
				{
					...dfaDraft,
					rows: [
						{ from: "A", read: "a", to: "B", write: "", move: "R" },
						{ from: "A", read: "a", to: "A", write: "", move: "R" },
					],
				},
				true,
			).spec,
		);
		expect(s.transitions).toEqual([]);
	});

	it("未完成の行(from/to が空)は無視する", () => {
		const s = asAny(
			buildSpec(
				{
					...dfaDraft,
					rows: [
						{ from: "A", read: "a", to: "B", write: "", move: "R" },
						{ from: "", read: "", to: "", write: "", move: "R" },
					],
				},
				true,
			).spec,
		);
		expect(s.transitions).toHaveLength(1);
	});
});

describe("invalidRowIndices", () => {
	it("DFA の read 空・決定性違反を無効として拾う", () => {
		const rows = [
			{ from: "A", read: "a", to: "B", write: "", move: "R" as const },
			{ from: "A", read: "", to: "C", write: "", move: "R" as const }, // read 空
			{ from: "B", read: "b", to: "A", write: "", move: "R" as const },
			{ from: "B", read: "b", to: "B", write: "", move: "R" as const }, // (B,b) 重複
		];
		const invalid = invalidRowIndices(rows, true);
		expect([...invalid].sort()).toEqual([1, 2, 3]);
	});
});

describe("round-trip(commit ガードの前提)", () => {
	it("buildSpec(draftFromMachine(m)) は記号順を除き元の spec と一致する", () => {
		for (const m of machines) {
			const built = buildSpec(draftFromMachine(m), m.kind === "dfa").spec;
			expect(built).toBeDefined();
			// specSignature は記号順を無視するので、読み込み/切替で再コミットされない。
			expect(built && specSignature(built)).toBe(specSignature(m.spec));
		}
	});
});

describe("draftGraph", () => {
	it("同一 (from,to) をまとめ、片方が無効なら辺全体を無効にする", () => {
		const graph = draftGraph(
			{
				states: ["A", "B"],
				start: "A",
				accept: [],
				rows: [
					{ from: "A", read: "a", to: "B", write: "", move: "R" }, // 有効
					{ from: "A", read: "", to: "B", write: "", move: "R" }, // 無効(read 空)
				],
			},
			true,
		);
		const ab = graph.edges.filter((e) => e.from === "A" && e.to === "B");
		expect(ab).toHaveLength(1); // 同一 (from,to) は 1 辺にまとまる
		expect(ab[0]?.label).toContain(","); // ラベルは連結される
		expect(ab[0]?.valid).toBe(false); // 片方が無効なら辺全体を無効に
	});

	it("無効な遷移も valid:false として辺に含める", () => {
		const graph = draftGraph(
			{
				states: ["A", "B"],
				start: "A",
				accept: [],
				rows: [
					{ from: "A", read: "a", to: "B", write: "", move: "R" },
					{ from: "A", read: "", to: "A", write: "", move: "R" }, // 無効(read 空)
				],
			},
			true,
		);
		const ab = graph.edges.find((e) => e.from === "A" && e.to === "B");
		const aa = graph.edges.find((e) => e.from === "A" && e.to === "A");
		expect(ab?.valid).toBe(true);
		expect(aa?.valid).toBe(false);
	});
});

describe("deriveStates", () => {
	it("明示 states・start・accept・遷移の from/to を取り込む", () => {
		const states = deriveStates({
			states: ["X"],
			start: "S",
			accept: ["T", "U"],
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

describe("状態の操作", () => {
	it("addState は新しい状態を states に足す", () => {
		expect(addState(dfaDraft).states).toEqual(["A", "B", "q0"]);
	});

	it("deleteState は状態と、それを参照する遷移・受理・初期を除く", () => {
		const d = deleteState(
			{
				states: ["A", "B"],
				start: "A",
				accept: ["A"],
				rows: [
					{ from: "A", read: "a", to: "B", write: "", move: "R" },
					{ from: "B", read: "b", to: "A", write: "", move: "R" },
				],
			},
			"A",
		);
		expect(d.states).toEqual(["B"]);
		expect(d.rows).toEqual([]); // A を含む遷移は消える
		expect(d.accept).toEqual([]);
		expect(d.start).toBe("B"); // 消えた start は残りの先頭へ
	});

	it("renameState は空名(未入力の番兵)を対象にせず draft を変えない", () => {
		const before: Draft = {
			states: ["A"],
			start: "A",
			accept: [],
			rows: [{ from: "", read: "", to: "", write: "", move: "R" }],
		};
		expect(renameState(before, "", "q9")).toEqual(before);
	});

	it("renameState は states・start・accept・遷移の参照を追従して改名する", () => {
		const d = renameState(
			{
				states: ["A", "B"],
				start: "A",
				accept: ["A"],
				rows: [{ from: "A", read: "a", to: "B", write: "", move: "R" }],
			},
			"A",
			"S",
		);
		expect(d.states).toEqual(["S", "B"]);
		expect(d.start).toBe("S");
		expect(d.accept).toEqual(["S"]);
		expect(d.rows[0]).toEqual({
			from: "S",
			read: "a",
			to: "B",
			write: "",
			move: "R",
		});
	});
});
