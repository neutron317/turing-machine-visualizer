import { describe, expect, it } from "vitest";
import accdfa from "../../example/accdfa.json?raw";
import div3 from "../../example/dfa-divisible-by-3.json?raw";
import palindrome from "../../example/dtm-palindrome.json?raw";
import { decodeMachine } from "./components/machineFile.ts";

// リポジトリ直下 example/ のサンプル機械が、アプリの「読込」と同じ経路
// (decodeMachine)で確実にロードできることを保証する回帰テスト。
describe("example/ のサンプル機械", () => {
	it.each([
		["dfa-divisible-by-3.json", div3, "dfa"],
		["dtm-palindrome.json", palindrome, "dtm"],
		["accdfa.json", accdfa, "dtm"],
	])("%s が読み込める(kind=%s)", (_name, text, kind) => {
		const result = decodeMachine(text, "ex");
		expect("machine" in result).toBe(true);
		if ("machine" in result) {
			expect(result.machine.kind).toBe(kind);
		}
	});
});
