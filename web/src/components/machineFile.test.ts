import { describe, expect, it } from "vitest";
import { machines } from "../fixtures/machines.ts";
import {
	decodeMachine,
	encodeMachine,
	machineFileName,
	machineNameFromFile,
} from "./machineFile.ts";

describe("machineFile", () => {
	it("encode → decode で機械が往復する(表示名はファイル名由来)", () => {
		for (const m of machines) {
			const text = encodeMachine({
				kind: m.kind,
				input: m.input,
				spec: m.spec,
			});
			const res = decodeMachine(text, "x", "名前");
			expect("machine" in res).toBe(true);
			if ("machine" in res) {
				expect(res.machine.id).toBe("x");
				expect(res.machine.kind).toBe(m.kind);
				// 表示名は保存されず、読込時に渡した名前になる。
				expect(res.machine.label).toBe("名前");
				expect(res.machine.input).toBe(m.input);
				expect(res.machine.spec).toEqual(m.spec);
			}
		}
	});

	it("コンパクト形式: 先頭は d/t、パイプ区切り、JSON ではない", () => {
		const text = encodeMachine({
			kind: "dfa",
			input: "aa",
			spec: machines[0].spec,
		});
		expect(text).not.toContain("\n");
		expect(text).not.toContain("{");
		expect(text.startsWith("d|")).toBe(true);
	});

	it("区切り文字を含む記号もエスケープで往復する(; , | \\)", () => {
		const spec = {
			states: ["q"],
			tapeAlphabet: [";", ",", "|", "\\", "a"],
			start: "q",
			accept: ["q"],
			transitions: [
				{ from: "q", read: ";", to: "q", write: ",", move: "R" as const },
				{ from: "q", read: "|", to: "q", write: "\\", move: "L" as const },
				{ from: "q", read: "a", to: "q", write: null, move: "R" as const },
			],
		};
		const text = encodeMachine({ kind: "dtm", input: ";|,", spec });
		const res = decodeMachine(text, "x", "名前");
		expect("machine" in res).toBe(true);
		if ("machine" in res) {
			expect(res.machine.input).toBe(";|,");
			expect(res.machine.spec).toEqual(spec);
		}
	});

	it("旧 JSON 形式も読める(後方互換)", () => {
		const text = JSON.stringify({
			v: 1,
			kind: "dfa",
			input: "a",
			spec: machines[0].spec,
		});
		const res = decodeMachine(text, "x", "ファイル名");
		expect("machine" in res).toBe(true);
		if ("machine" in res) {
			expect(res.machine.label).toBe("ファイル名");
			expect(res.machine.spec).toEqual(machines[0].spec);
		}
	});

	it("壊れた JSON は error を返す", () => {
		const res = decodeMachine("{not json", "x", "名前");
		expect("error" in res && res.error).toMatch(/JSON/);
	});

	it("フィールド数が不正なら error を返す", () => {
		const res = decodeMachine("d|0,1|a", "x", "名前");
		expect("error" in res).toBe(true);
	});

	it("保存ファイル名: 空/空白はフォールバック、無効文字は _ に、拡張子 .tm", () => {
		expect(machineFileName("even")).toBe("even.tm");
		expect(machineFileName("")).toBe("machine.tm");
		expect(machineFileName("   ")).toBe("machine.tm");
		expect(machineFileName("a/b:c")).toBe("a_b_c.tm");
		expect(machineFileName("even-a")).toBe("even-a.tm");
	});

	it("ファイル名 → 表示名: 末尾 .tm / .json を除く・空はフォールバック", () => {
		expect(machineNameFromFile("even-a.tm")).toBe("even-a");
		expect(machineNameFromFile("old.json")).toBe("old");
		expect(machineNameFromFile("even-a")).toBe("even-a");
		expect(machineNameFromFile("my.dfa.tm")).toBe("my.dfa");
		expect(machineNameFromFile(".tm")).toBe("machine");
		expect(machineNameFromFile("DFA_3の倍数.tm")).toBe("DFA_3の倍数");
	});

	it("spec が契約に一致しないと error を返す", () => {
		// read が 2 文字で symbolSchema 違反。
		const res = decodeMachine("d|A|ab|A||x|A,ab,A", "x", "名前");
		expect("error" in res && res.error).toMatch(/DFA/);
	});
});
