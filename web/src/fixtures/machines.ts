import {
	type DFASpec,
	type DTMSpec,
	dfaSpecSchema,
	dtmSpecSchema,
} from "../contract/schemas.ts";

// フロントに用意するサンプル機械。spec(状態図の描画 + /step への送信)と、
// 初期コンフィグを組み立てる入力文字列 input を持つ。実行は逐次 /step で取得する
// (contract.md §4.3)。Zod で spec の契約を検証する。

export interface DFAMachine {
	id: string;
	label: string;
	kind: "dfa";
	spec: DFASpec;
	input: string;
}

export interface DTMMachine {
	id: string;
	label: string;
	kind: "dtm";
	spec: DTMSpec;
	input: string;
}

export type Machine = DFAMachine | DTMMachine;

const evenASpec = dfaSpecSchema.parse({
	states: ["Even", "Odd"],
	alphabet: ["a"],
	start: "Even",
	accept: ["Even"],
	transitions: [
		{ from: "Even", read: "a", to: "Odd" },
		{ from: "Odd", read: "a", to: "Even" },
	],
});

const anbncnSpec = dtmSpecSchema.parse({
	states: ["P0", "P1", "P2", "P3", "P4", "PA"],
	tapeAlphabet: ["a", "b", "c", "X", "Y", "Z"],
	start: "P0",
	accept: ["PA"],
	transitions: [
		{ from: "P0", read: "a", to: "P1", write: "X", move: "R" },
		{ from: "P0", read: "X", to: "P0", write: "X", move: "R" },
		{ from: "P0", read: "Y", to: "P4", write: "Y", move: "R" },
		{ from: "P0", read: null, to: "PA", write: null, move: "R" },
		{ from: "P1", read: "a", to: "P1", write: "a", move: "R" },
		{ from: "P1", read: "X", to: "P1", write: "X", move: "R" },
		{ from: "P1", read: "b", to: "P2", write: "Y", move: "R" },
		{ from: "P1", read: "Y", to: "P1", write: "Y", move: "R" },
		{ from: "P2", read: "b", to: "P2", write: "b", move: "R" },
		{ from: "P2", read: "Y", to: "P2", write: "Y", move: "R" },
		{ from: "P2", read: "c", to: "P3", write: "Z", move: "L" },
		{ from: "P2", read: "Z", to: "P2", write: "Z", move: "R" },
		{ from: "P3", read: "a", to: "P3", write: "a", move: "L" },
		{ from: "P3", read: "b", to: "P3", write: "b", move: "L" },
		{ from: "P3", read: "Y", to: "P3", write: "Y", move: "L" },
		{ from: "P3", read: "Z", to: "P3", write: "Z", move: "L" },
		{ from: "P3", read: "X", to: "P0", write: "X", move: "R" },
		{ from: "P4", read: "Y", to: "P4", write: "Y", move: "R" },
		{ from: "P4", read: "Z", to: "P4", write: "Z", move: "R" },
		{ from: "P4", read: null, to: "PA", write: null, move: "R" },
	],
});

export const machines: Machine[] = [
	{
		id: "even-a",
		label: "DFA: 偶数個の a",
		kind: "dfa",
		spec: evenASpec,
		input: "aa",
	},
	{
		id: "anbncn",
		label: "DTM: aⁿbⁿcⁿ",
		kind: "dtm",
		spec: anbncnSpec,
		input: "abc",
	},
];
