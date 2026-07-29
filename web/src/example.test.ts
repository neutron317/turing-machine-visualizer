import { describe, expect, it } from "vitest";
import accdfa from "../../example/accdfa.tmvdtm?raw";
import div3 from "../../example/dfa-divisible-by-3.tmvdfa?raw";
import evenatrib from "../../example/dfa-even-a-tri-b.tmvdfa?raw";
import adder from "../../example/dtm-binary-adder.tmvdtm?raw";
import collatz from "../../example/dtm-collatz.tmvdtm?raw";
import palindrome from "../../example/dtm-palindrome.tmvdtm?raw";
import subsetsum from "../../example/dtm-subset-sum.tmvdtm?raw";
import { decodeMachine } from "./components/machineFile.ts";

// リポジトリ直下 example/ のサンプル機械が、アプリの「読込」と同じ経路
// (decodeMachine)で確実にロードできることを保証する回帰テスト。
describe("example/ のサンプル機械", () => {
	it.each([
		["dfa-divisible-by-3.tmvdfa", div3, "dfa"],
		["dfa-even-a-tri-b.tmvdfa", evenatrib, "dfa"],
		["dtm-palindrome.tmvdtm", palindrome, "dtm"],
		["accdfa.tmvdtm", accdfa, "dtm"],
		["dtm-subset-sum.tmvdtm", subsetsum, "dtm"],
		["dtm-binary-adder.tmvdtm", adder, "dtm"],
		["dtm-collatz.tmvdtm", collatz, "dtm"],
	])("%s が読み込める(kind=%s)", (name, text, kind) => {
		const result = decodeMachine(text, "ex", name);
		expect("machine" in result).toBe(true);
		if ("machine" in result) {
			expect(result.machine.kind).toBe(kind);
		}
	});
});
