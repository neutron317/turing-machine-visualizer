import { describe, expect, it } from "vitest";
import adderRaw from "../../../example/dtm-binary-adder.tmvdtm?raw";
import collatzRaw from "../../../example/dtm-collatz.tmvdtm?raw";
import palindromeRaw from "../../../example/dtm-palindrome.tmvdtm?raw";
import subsetsumRaw from "../../../example/dtm-subset-sum.tmvdtm?raw";
// 契約のゴールデントレース(Haskell エンジンが再現する基準)。移植したクライアント側
// エンジンが同じ列を出すことを確認する = 移植のパリティ検証。
import evenASpecRaw from "../../../fixtures/dfa/even-a.json?raw";
import anbncnSpecRaw from "../../../fixtures/dtm/anbncn.json?raw";
import evenATraceRaw from "../../../fixtures/traces/dfa-even-a.json?raw";
import anbncnTraceRaw from "../../../fixtures/traces/dtm-anbncn.json?raw";
import { decodeMachine } from "../components/machineFile.ts";
import type {
	DFAConfig,
	DFASpec,
	DTMConfig,
	DTMSpec,
	StepDFA,
	StepDTM,
} from "../contract/schemas.ts";
import { stepDfa, stepDtm } from "./step.ts";

// biome-ignore lint/suspicious/noExplicitAny: fixture JSON を素直に読む
const parse = (s: string): any => JSON.parse(s);

function replayDfa(spec: DFASpec, initial: DFAConfig, max = 10000): StepDFA[] {
	const steps: StepDFA[] = [];
	let config = initial;
	for (let i = 0; i < max; i++) {
		const s = stepDfa(spec, config);
		steps.push(s);
		if (s.status !== "running") return steps;
		config = s.config;
	}
	throw new Error("terminate せず");
}

function replayDtm(spec: DTMSpec, initial: DTMConfig, max = 10000): StepDTM[] {
	const steps: StepDTM[] = [];
	let config = initial;
	for (let i = 0; i < max; i++) {
		const s = stepDtm(spec, config);
		steps.push(s);
		if (s.status !== "running") return steps;
		config = s.config;
	}
	throw new Error("terminate せず");
}

describe("client-side step: ゴールデントレース一致(Haskell エンジンとのパリティ)", () => {
	it("DFA even-a のトレースを再現する", () => {
		const spec = parse(evenASpecRaw).machine as DFASpec;
		const trace = parse(evenATraceRaw);
		expect(replayDfa(spec, trace.initial)).toEqual(trace.steps);
	});

	it("DTM anbncn のトレースを再現する", () => {
		const spec = parse(anbncnSpecRaw).machine as DTMSpec;
		const trace = parse(anbncnTraceRaw);
		expect(replayDtm(spec, trace.initial)).toEqual(trace.steps);
	});
});

// example/ の機械をデコードし、入力語を最後まで走らせて accept/reject を確認する。
function dtmSpec(raw: string): DTMSpec {
	const r = decodeMachine(raw, "x", "m");
	if (!("machine" in r)) throw new Error("decode 失敗");
	return r.machine.spec as DTMSpec;
}
function runDtm(spec: DTMSpec, word: string, max = 200000): string {
	const cells = [...word];
	const config: DTMConfig =
		cells.length > 0
			? { state: spec.start, left: [], head: cells[0], right: cells.slice(1) }
			: { state: spec.start, left: [], head: null, right: [] };
	const steps = replayDtm(spec, config, max);
	return steps[steps.length - 1].status;
}

describe("client-side step: example 機械の判定", () => {
	it("palindrome: 回文=accept, 非回文=reject", () => {
		const s = dtmSpec(palindromeRaw);
		expect(runDtm(s, "abba")).toBe("accept");
		expect(runDtm(s, "aba")).toBe("accept");
		expect(runDtm(s, "ab")).toBe("reject");
		expect(runDtm(s, "abab")).toBe("reject");
	});
	it("subset-sum: 部分和が成立=accept, 不成立=reject", () => {
		const s = dtmSpec(subsetsumRaw);
		expect(runDtm(s, "n11,n111,n1#1111")).toBe("accept"); // {2,3,1} 目標4 → {3,1}
		expect(runDtm(s, "n11,n111#111111")).toBe("reject"); // {2,3} 目標6 → 最大5
	});
	it("collatz: 1 に到達=accept", () => {
		const s = dtmSpec(collatzRaw);
		expect(runDtm(s, "^1")).toBe("accept");
		expect(runDtm(s, "^111")).toBe("accept");
	});
	it("binary-adder: 計算して停止=accept", () => {
		const s = dtmSpec(adderRaw);
		expect(runDtm(s, "101+11")).toBe("accept");
	});
});

// ゴールデントレースが通らない周辺経路(左端行き詰まり・遷移なし・重複遷移の tie-break)を
// 直接ユニット検証する。特に tie-break は Haskell(Map.fromList=後勝ち)との一致が要。
describe("client-side step: 境界・tie-break の直接検証", () => {
	it("DTM: 左端で左移動しようとすると reject(config 据え置き・書込なし)", () => {
		const spec: DTMSpec = {
			states: ["q"],
			tapeAlphabet: ["a", "b"],
			start: "q",
			accept: [],
			// head=a で左移動を指示するが left は空 → 行き詰まり。書込 b も反映されない。
			transitions: [{ from: "q", read: "a", to: "q", write: "b", move: "L" }],
		};
		const config: DTMConfig = { state: "q", left: [], head: "a", right: [] };
		expect(stepDtm(spec, config)).toEqual({
			status: "reject",
			config,
			fired: null,
		});
	});

	it("DTM: (state, head) に遷移が無ければ reject", () => {
		const spec: DTMSpec = {
			states: ["q"],
			tapeAlphabet: ["a"],
			start: "q",
			accept: [],
			transitions: [],
		};
		const config: DTMConfig = { state: "q", left: [], head: "a", right: [] };
		expect(stepDtm(spec, config).status).toBe("reject");
	});

	it("DFA: 遷移が無ければ reject(行き詰まり)", () => {
		const spec: DFASpec = {
			states: ["q"],
			alphabet: ["a"],
			start: "q",
			accept: ["q"],
			transitions: [],
		};
		expect(stepDfa(spec, { state: "q", rest: ["a"] }).status).toBe("reject");
	});

	it("DFA: 重複 (from, read) は後勝ち(Haskell Map.fromList と一致)", () => {
		const spec: DFASpec = {
			states: ["q", "x", "y"],
			alphabet: ["a"],
			start: "q",
			accept: [],
			transitions: [
				{ from: "q", read: "a", to: "x" },
				{ from: "q", read: "a", to: "y" }, // 後勝ち → y へ
			],
		};
		expect(stepDfa(spec, { state: "q", rest: ["a"] }).config.state).toBe("y");
	});

	it("DTM: 重複 (from, head) は後勝ち", () => {
		const spec: DTMSpec = {
			states: ["q", "x", "y"],
			tapeAlphabet: ["a"],
			start: "q",
			accept: [],
			transitions: [
				{ from: "q", read: "a", to: "x", write: "a", move: "R" },
				{ from: "q", read: "a", to: "y", write: "a", move: "R" }, // 後勝ち
			],
		};
		const config: DTMConfig = { state: "q", left: [], head: "a", right: [] };
		expect(stepDtm(spec, config).config.state).toBe("y");
	});
});
