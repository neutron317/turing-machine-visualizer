import { z } from "zod";

// docs/contract.md のデータ契約をフロント側で実行時に検証する Zod スキーマ。
// - 記号(入力・テープ記号)は 1 文字の文字列。
// - テープの空白(blank)は null。
// スキーマは `*Schema`、推論した TypeScript 型は同名のパスカルケースで公開する。

export const symbolSchema = z.string().length(1);
export const moveSchema = z.enum(["L", "R"]);
export const statusSchema = z.enum(["running", "accept", "reject"]);

// --- 機械 spec ---
export const dfaTransSchema = z.object({
	from: z.string(),
	read: symbolSchema,
	to: z.string(),
});

export const dfaSpecSchema = z.object({
	states: z.array(z.string()),
	alphabet: z.array(symbolSchema),
	start: z.string(),
	accept: z.array(z.string()),
	transitions: z.array(dfaTransSchema),
});

export const dtmTransSchema = z.object({
	from: z.string(),
	read: symbolSchema.nullable(),
	to: z.string(),
	write: symbolSchema.nullable(),
	move: moveSchema,
});

export const dtmSpecSchema = z.object({
	states: z.array(z.string()),
	tapeAlphabet: z.array(symbolSchema),
	start: z.string(),
	accept: z.array(z.string()),
	transitions: z.array(dtmTransSchema),
});

// --- コンフィグ ---
export const dfaConfigSchema = z.object({
	state: z.string(),
	rest: z.array(symbolSchema),
});

export const dtmConfigSchema = z.object({
	state: z.string(),
	left: z.array(symbolSchema.nullable()),
	head: symbolSchema.nullable(),
	right: z.array(symbolSchema.nullable()),
});

// --- 発火した遷移 ---
export const firedDfaSchema = z.object({
	from: z.string(),
	read: symbolSchema,
	to: z.string(),
});

export const firedDtmSchema = z.object({
	from: z.string(),
	read: symbolSchema.nullable(),
	to: z.string(),
	write: symbolSchema.nullable(),
	move: moveSchema,
});

// --- ステップ結果(StepResult。terminal 時は fired=null) ---
export const stepDfaSchema = z.object({
	status: statusSchema,
	config: dfaConfigSchema,
	fired: firedDfaSchema.nullable(),
});

export const stepDtmSchema = z.object({
	status: statusSchema,
	config: dtmConfigSchema,
	fired: firedDtmSchema.nullable(),
});

// --- ゴールデントレース(contract.md §6) ---
export const dfaTraceSchema = z.object({
	kind: z.literal("dfa"),
	machine: z.string(),
	input: z.string(),
	note: z.string().optional(),
	initial: dfaConfigSchema,
	steps: z.array(stepDfaSchema),
});

export const dtmTraceSchema = z.object({
	kind: z.literal("dtm"),
	machine: z.string(),
	input: z.string(),
	note: z.string().optional(),
	initial: dtmConfigSchema,
	steps: z.array(stepDtmSchema),
});

export type Move = z.infer<typeof moveSchema>;
export type Status = z.infer<typeof statusSchema>;
export type DFATrans = z.infer<typeof dfaTransSchema>;
export type DFASpec = z.infer<typeof dfaSpecSchema>;
export type DTMTrans = z.infer<typeof dtmTransSchema>;
export type DTMSpec = z.infer<typeof dtmSpecSchema>;
export type DFAConfig = z.infer<typeof dfaConfigSchema>;
export type DTMConfig = z.infer<typeof dtmConfigSchema>;
export type FiredDFA = z.infer<typeof firedDfaSchema>;
export type FiredDTM = z.infer<typeof firedDtmSchema>;
export type StepDFA = z.infer<typeof stepDfaSchema>;
export type StepDTM = z.infer<typeof stepDtmSchema>;
export type DFATrace = z.infer<typeof dfaTraceSchema>;
export type DTMTrace = z.infer<typeof dtmTraceSchema>;
