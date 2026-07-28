import { describe, expect, it } from "vitest";
import { initialDfaConfig, initialDtmConfig } from "./initial.ts";
import type { DFASpec, DTMSpec } from "./schemas.ts";

const dfaSpec: DFASpec = {
	states: ["Even", "Odd"],
	alphabet: ["a"],
	start: "Even",
	accept: ["Even"],
	transitions: [],
};

const dtmSpec: DTMSpec = {
	states: ["P0"],
	tapeAlphabet: ["a", "b"],
	start: "P0",
	accept: [],
	transitions: [],
};

describe("initialConfig(契約 §3)", () => {
	it("DFA は state=start・rest=入力の各文字", () => {
		expect(initialDfaConfig(dfaSpec, "aa")).toEqual({
			state: "Even",
			rest: ["a", "a"],
		});
	});

	it("DFA 空入力は rest=[]", () => {
		expect(initialDfaConfig(dfaSpec, "")).toEqual({ state: "Even", rest: [] });
	});

	it("DTM は先頭が head・残りが right", () => {
		expect(initialDtmConfig(dtmSpec, "abc")).toEqual({
			state: "P0",
			left: [],
			head: "a",
			right: ["b", "c"],
		});
	});

	it("DTM 空入力は head=null", () => {
		expect(initialDtmConfig(dtmSpec, "")).toEqual({
			state: "P0",
			left: [],
			head: null,
			right: [],
		});
	});
});
