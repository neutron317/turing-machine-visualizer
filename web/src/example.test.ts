import { describe, expect, it } from "vitest";
import accdfa from "../../example/accdfa.tm?raw";
import div3 from "../../example/dfa-divisible-by-3.tm?raw";
import palindrome from "../../example/dtm-palindrome.tm?raw";
import { decodeMachine } from "./components/machineFile.ts";

// リポジトリ直下 example/ のサンプル機械が、アプリの「読込」と同じ経路
// (decodeMachine)で確実にロードできることを保証する回帰テスト。
describe("example/ のサンプル機械", () => {
	it.each([
		["dfa-divisible-by-3.tm", div3, "dfa"],
		["dtm-palindrome.tm", palindrome, "dtm"],
		["accdfa.tm", accdfa, "dtm"],
	])("%s が読み込める(kind=%s)", (name, text, kind) => {
		const result = decodeMachine(text, "ex", name);
		expect("machine" in result).toBe(true);
		if ("machine" in result) {
			expect(result.machine.kind).toBe(kind);
		}
	});
});
