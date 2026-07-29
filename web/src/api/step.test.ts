import { describe, expect, it } from "vitest";
import type { DFASpec, DTMSpec } from "../contract/schemas.ts";
import { StepError, stepDfa, stepDtm } from "./step.ts";

// api/step.ts はローカルエンジン(engine/step.ts)への非同期ラッパ。ここでは委譲が
// 正しく Promise で返ること・StepError が公開されていることだけを確認する
// (ステップ意味論の網羅検証は engine/step.test.ts のゴールデントレースが担う)。

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

describe("step API(ローカル実行への委譲)", () => {
	it("stepDfa は Promise でローカルの 1 ステップ結果を返す", async () => {
		const res = await stepDfa(dfaSpec, { state: "Even", rest: ["a"] });
		expect(res).toEqual({
			status: "running",
			config: { state: "Odd", rest: [] },
			fired: { from: "Even", read: "a", to: "Odd" },
		});
	});

	it("stepDtm は Promise で受理状態を terminal(accept)にする", async () => {
		const dtmSpec: DTMSpec = {
			states: ["PA"],
			tapeAlphabet: ["a"],
			start: "PA",
			accept: ["PA"],
			transitions: [],
		};
		const config = { state: "PA", left: [], head: null, right: [] };
		const res = await stepDtm(dtmSpec, config);
		expect(res).toEqual({ status: "accept", config, fired: null });
	});

	it("StepError は互換のため公開されている", () => {
		expect(new StepError("x")).toBeInstanceOf(Error);
	});
});
