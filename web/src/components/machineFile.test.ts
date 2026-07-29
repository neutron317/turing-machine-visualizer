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

	it("軽量: 出力は空白のないミニファイ JSON・label を含まない", () => {
		const text = encodeMachine({
			kind: "dfa",
			input: "a",
			spec: machines[0].spec,
		});
		expect(text).not.toContain("\n");
		expect(text).not.toContain("label");
		expect(text.startsWith('{"v":1')).toBe(true);
	});

	it("壊れた JSON は error を返す", () => {
		const res = decodeMachine("{not json", "x", "名前");
		expect("error" in res && res.error).toMatch(/JSON/);
	});

	it("エンベロープ不正(必須欠落)は error を返す", () => {
		const res = decodeMachine(
			JSON.stringify({ v: 1, kind: "dfa" }),
			"x",
			"名前",
		);
		expect("error" in res).toBe(true);
	});

	it("古い label 付きファイルも読める(label は無視される)", () => {
		const text = JSON.stringify({
			v: 1,
			kind: "dfa",
			label: "古い名前",
			input: "a",
			spec: machines[0].spec,
		});
		const res = decodeMachine(text, "x", "ファイル名");
		expect("machine" in res).toBe(true);
		if ("machine" in res) {
			expect(res.machine.label).toBe("ファイル名");
		}
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

	it("ファイル名 → 表示名: 末尾 .json を除く・空はフォールバック", () => {
		expect(machineNameFromFile("even-a.json")).toBe("even-a");
		expect(machineNameFromFile("even-a")).toBe("even-a");
		expect(machineNameFromFile("my.dfa.json")).toBe("my.dfa");
		expect(machineNameFromFile(".json")).toBe("machine");
		expect(machineNameFromFile("DFA_3の倍数.json")).toBe("DFA_3の倍数");
	});

	it("spec が契約に一致しないと error を返す", () => {
		const bad = JSON.stringify({
			v: 1,
			kind: "dfa",
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
		const res = decodeMachine(bad, "x", "名前");
		expect("error" in res && res.error).toMatch(/DFA/);
	});
});
