import {
	type DFASpec,
	type DFATrace,
	type DTMSpec,
	type DTMTrace,
	dfaSpecSchema,
	dfaTraceSchema,
	dtmSpecSchema,
	dtmTraceSchema,
} from "../contract/schemas.ts";

// バックエンド未接続の間の再生用サンプル(engine の fixtures/ 相当)。
// spec(状態図の描画用)と trace(再生用)をペアで持ち、Zod で契約を検証する。
// ステージ5で trace を HTTP の逐次 /step 取得に置き換える。

export interface DFAMachine {
	id: string;
	label: string;
	kind: "dfa";
	spec: DFASpec;
	trace: DFATrace;
}

export interface DTMMachine {
	id: string;
	label: string;
	kind: "dtm";
	spec: DTMSpec;
	trace: DTMTrace;
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

const evenATrace = dfaTraceSchema.parse({
	kind: "dfa",
	machine: "even-a",
	input: "aa",
	initial: { state: "Even", rest: ["a", "a"] },
	steps: [
		{
			status: "running",
			config: { state: "Odd", rest: ["a"] },
			fired: { from: "Even", read: "a", to: "Odd" },
		},
		{
			status: "running",
			config: { state: "Even", rest: [] },
			fired: { from: "Odd", read: "a", to: "Even" },
		},
		{ status: "accept", config: { state: "Even", rest: [] }, fired: null },
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

const anbncnTrace = dtmTraceSchema.parse({
	kind: "dtm",
	machine: "anbncn",
	input: "abc",
	initial: { state: "P0", left: [], head: "a", right: ["b", "c"] },
	steps: [
		{
			status: "running",
			config: { state: "P1", left: ["X"], head: "b", right: ["c"] },
			fired: { from: "P0", read: "a", to: "P1", write: "X", move: "R" },
		},
		{
			status: "running",
			config: { state: "P2", left: ["X", "Y"], head: "c", right: [] },
			fired: { from: "P1", read: "b", to: "P2", write: "Y", move: "R" },
		},
		{
			status: "running",
			config: { state: "P3", left: ["X"], head: "Y", right: ["Z"] },
			fired: { from: "P2", read: "c", to: "P3", write: "Z", move: "L" },
		},
		{
			status: "running",
			config: { state: "P3", left: [], head: "X", right: ["Y", "Z"] },
			fired: { from: "P3", read: "Y", to: "P3", write: "Y", move: "L" },
		},
		{
			status: "running",
			config: { state: "P0", left: ["X"], head: "Y", right: ["Z"] },
			fired: { from: "P3", read: "X", to: "P0", write: "X", move: "R" },
		},
		{
			status: "running",
			config: { state: "P4", left: ["X", "Y"], head: "Z", right: [] },
			fired: { from: "P0", read: "Y", to: "P4", write: "Y", move: "R" },
		},
		{
			status: "running",
			config: { state: "P4", left: ["X", "Y", "Z"], head: null, right: [] },
			fired: { from: "P4", read: "Z", to: "P4", write: "Z", move: "R" },
		},
		{
			status: "running",
			config: {
				state: "PA",
				left: ["X", "Y", "Z", null],
				head: null,
				right: [],
			},
			fired: { from: "P4", read: null, to: "PA", write: null, move: "R" },
		},
		{
			status: "accept",
			config: {
				state: "PA",
				left: ["X", "Y", "Z", null],
				head: null,
				right: [],
			},
			fired: null,
		},
	],
});

export const machines: Machine[] = [
	{
		id: "even-a",
		label: "DFA: 偶数個の a",
		kind: "dfa",
		spec: evenASpec,
		trace: evenATrace,
	},
	{
		id: "anbncn",
		label: "DTM: aⁿbⁿcⁿ",
		kind: "dtm",
		spec: anbncnSpec,
		trace: anbncnTrace,
	},
];
