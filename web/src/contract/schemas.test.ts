import { describe, expect, it } from "vitest";
import {
	dfaSpecSchema,
	dfaTraceSchema,
	dtmConfigSchema,
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
});
