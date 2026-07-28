import { describe, expect, it } from "vitest";
import { machines } from "../fixtures/machines.ts";
import {
	decodeMachine,
	encodeMachine,
	machineFileName,
} from "./machineFile.ts";

describe("machineFile", () => {
	it("encode → decode で機械が往復する(DFA / DTM)", () => {
		for (const m of machines) {
			const text = encodeMachine({
				kind: m.kind,
				label: m.label,
				input: m.input,
				spec: m.spec,
			});
			const res = decodeMachine(text, "x");
			expect("machine" in res).toBe(true);
			if ("machine" in res) {
				expect(res.machine.id).toBe("x");
				expect(res.machine.kind).toBe(m.kind);
				expect(res.machine.label).toBe(m.label);
				expect(res.machine.input).toBe(m.input);
				expect(res.machine.spec).toEqual(m.spec);
			}
		}
	});

	it("軽量: 出力は空白のないミニファイ JSON", () => {
		const text = encodeMachine({
			kind: "dfa",
			label: "d",
			input: "a",
			spec: machines[0].spec,
		});
		expect(text).not.toContain("\n");
		expect(text.startsWith('{"v":1')).toBe(true);
	});

	it("壊れた JSON は error を返す", () => {
		const res = decodeMachine("{not json", "x");
		expect("error" in res && res.error).toMatch(/JSON/);
	});

	it("エンベロープ不正(必須欠落)は error を返す", () => {
		const res = decodeMachine(JSON.stringify({ v: 1, kind: "dfa" }), "x");
		expect("error" in res).toBe(true);
	});

	it("保存ファイル名: 空/空白はフォールバック、無効文字は _ に", () => {
		expect(machineFileName("even")).toBe("even.json");
		expect(machineFileName("")).toBe("machine.json");
		expect(machineFileName("   ")).toBe("machine.json");
		expect(machineFileName("a/b:c")).toBe("a_b_c.json");
		// スペースやハイフンは有効な文字なので残す(無効文字のみ置換)。
		expect(machineFileName("DFA: x")).toBe("DFA_ x.json");
		expect(machineFileName("even-a")).toBe("even-a.json");
	});

	it("spec が契約に一致しないと error を返す", () => {
		const bad = JSON.stringify({
			v: 1,
			kind: "dfa",
			label: "d",
			input: "",
			// read が 2 文字で symbolSchema 違反。
			spec: {
				states: ["A"],
				alphabet: ["ab"],
				start: "A",
				accept: [],
				transitions: [{ from: "A", read: "ab", to: "A" }],
			},
		});
		const res = decodeMachine(bad, "x");
		expect("error" in res && res.error).toMatch(/DFA/);
	});
});
