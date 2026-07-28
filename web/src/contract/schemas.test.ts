import { describe, expect, it } from "vitest";
import {
	dfaSpecSchema,
	dfaTraceSchema,
	dtmConfigSchema,
	dtmSpecSchema,
	dtmTraceSchema,
	dtmTransSchema,
	moveSchema,
	statusSchema,
	stepDfaSchema,
	symbolSchema,
} from "./schemas.ts";

describe("契約スキーマ(docs/contract.md)", () => {
	it("記号は 1 文字の文字列のみ許可する", () => {
		expect(symbolSchema.safeParse("a").success).toBe(true);
		expect(symbolSchema.safeParse("ab").success).toBe(false);
		expect(symbolSchema.safeParse("").success).toBe(false);
	});

	it("move は L/R のみ", () => {
		expect(moveSchema.safeParse("L").success).toBe(true);
		expect(moveSchema.safeParse("U").success).toBe(false);
	});

	it("status は running/accept/reject のみ", () => {
		expect(statusSchema.safeParse("accept").success).toBe(true);
		expect(statusSchema.safeParse("halt").success).toBe(false);
	});

	it("DFASpec を検証する", () => {
		const spec = {
			states: ["Even", "Odd"],
			alphabet: ["a"],
			start: "Even",
			accept: ["Even"],
			transitions: [{ from: "Even", read: "a", to: "Odd" }],
		};
		expect(dfaSpecSchema.safeParse(spec).success).toBe(true);
	});

	it("記号が 2 文字の DFASpec を弾く", () => {
		const spec = {
			states: ["S"],
			alphabet: ["ab"],
			start: "S",
			accept: [],
			transitions: [],
		};
		expect(dfaSpecSchema.safeParse(spec).success).toBe(false);
	});

	it("DTMConfig の blank は null", () => {
		const config = { state: "P1", left: ["X"], head: null, right: [] };
		expect(dtmConfigSchema.safeParse(config).success).toBe(true);
	});

	it("StepDFA は terminal 時に fired=null を許可する", () => {
		const step = {
			status: "accept",
			config: { state: "Even", rest: [] },
			fired: null,
		};
		expect(stepDfaSchema.safeParse(step).success).toBe(true);
	});

	it("DFATrace(ゴールデントレース)を検証する", () => {
		const trace = {
			kind: "dfa",
			machine: "even-a",
			input: "aa",
			initial: { state: "Even", rest: ["a", "a"] },
			steps: [
				{
					fired: { from: "Even", read: "a", to: "Odd" },
					status: "running",
					config: { state: "Odd", rest: ["a"] },
				},
			],
		};
		expect(dfaTraceSchema.safeParse(trace).success).toBe(true);
	});

	it("DTMTrans は read/write の null(blank)を許容する", () => {
		expect(
			dtmTransSchema.safeParse({
				from: "P0",
				read: null,
				to: "PA",
				write: null,
				move: "R",
			}).success,
		).toBe(true);
	});

	it("DTMSpec を検証する(read=null/write=null の遷移を含む)", () => {
		const spec = {
			states: ["P0", "PA"],
			tapeAlphabet: ["a", "X"],
			start: "P0",
			accept: ["PA"],
			transitions: [
				{ from: "P0", read: "a", to: "P0", write: "X", move: "R" },
				{ from: "P0", read: null, to: "PA", write: null, move: "R" },
			],
		};
		expect(dtmSpecSchema.safeParse(spec).success).toBe(true);
	});

	it("DTMTrace を検証する(head=null・セル内 null・終端 fired=null accept)", () => {
		const trace = {
			kind: "dtm",
			machine: "anbncn",
			input: "abc",
			initial: { state: "P0", left: [], head: "a", right: ["b", "c"] },
			steps: [
				{
					status: "running",
					config: { state: "P1", left: ["X"], head: "b", right: ["c"] },
					fired: { from: "P0", read: "a", to: "P1", write: "X", move: "R" },
				},
				{
					status: "running",
					config: {
						state: "PA",
						left: ["X", "Y", "Z", null],
						head: null,
						right: [],
					},
					fired: { from: "P4", read: null, to: "PA", write: null, move: "R" },
				},
				{
					status: "accept",
					config: {
						state: "PA",
						left: ["X", "Y", "Z", null],
						head: null,
						right: [],
					},
					fired: null,
				},
			],
		};
		expect(dtmTraceSchema.safeParse(trace).success).toBe(true);
	});

	it("Trace の note は欠落・null・文字列のいずれも任意扱い(Haskell .:? に一致)", () => {
		const base = {
			kind: "dfa",
			machine: "even-a",
			input: "",
			initial: { state: "Even", rest: [] },
			steps: [],
		};
		expect(dfaTraceSchema.safeParse(base).success).toBe(true); // 欠落
		expect(dfaTraceSchema.safeParse({ ...base, note: null }).success).toBe(
			true,
		); // null
		expect(dfaTraceSchema.safeParse({ ...base, note: "メモ" }).success).toBe(
			true,
		); // 文字列
	});
});
