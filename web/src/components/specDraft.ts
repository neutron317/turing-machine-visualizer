import {
	type DFASpec,
	type DTMSpec,
	dfaSpecSchema,
	dtmSpecSchema,
} from "../contract/schemas.ts";
import type { Machine } from "../fixtures/machines.ts";
import type { Spec } from "../store/replay.ts";

// 遷移表 1 行分の編集状態。DFA は from/read/to、DTM は write/move も使う。
export interface Row {
	from: string;
	read: string;
	to: string;
	write: string;
	move: "L" | "R";
}

// 編集中の機械定義。states は明示リスト(図でクリック追加した孤立状態も保持する)。
// accept はカンマ区切り文字列(編集しやすさのため)。symbols は遷移から自動導出する
// ので draft には持たない。
export interface Draft {
	states: string[];
	start: string;
	accept: string;
	rows: Row[];
}

export function draftFromMachine(machine: Machine): Draft {
	const rows: Row[] =
		machine.kind === "dfa"
			? machine.spec.transitions.map((t) => ({
					from: t.from,
					read: t.read,
					to: t.to,
					write: "",
					move: "R" as const,
				}))
			: machine.spec.transitions.map((t) => ({
					from: t.from,
					read: t.read ?? "",
					to: t.to,
					write: t.write ?? "",
					move: t.move,
				}));
	return {
		states: [...machine.spec.states],
		start: machine.spec.start,
		accept: machine.spec.accept.join(", "),
		rows,
	};
}

// カンマ区切りの入力を状態のリストへ(空白除去・空要素は捨てる)。
export function parseCsv(s: string): string[] {
	return s
		.split(",")
		.map((x) => x.trim())
		.filter((x) => x !== "");
}

// 未完成の行(from/to が空)を除いた遷移だけを対象にする。
export function completeRows(rows: Row[]): Row[] {
	return rows.filter((r) => r.from !== "" && r.to !== "");
}

// 状態集合: 明示 states に加え、start・accept・遷移の from/to を取り込む。
export function deriveStates(draft: Draft): string[] {
	const set = new Set<string>(draft.states);
	if (draft.start !== "") {
		set.add(draft.start);
	}
	for (const s of parseCsv(draft.accept)) {
		set.add(s);
	}
	for (const r of completeRows(draft.rows)) {
		set.add(r.from);
		set.add(r.to);
	}
	return [...set];
}

// 使える記号(アルファベット/テープ記号)を遷移関数から自動導出する。
// DFA は read、DTM は read と write の非空(空白 null は除く)を集める。
export function deriveSymbols(rows: Row[], isDfa: boolean): string[] {
	const set = new Set<string>();
	for (const r of completeRows(rows)) {
		if (r.read !== "") {
			set.add(r.read);
		}
		if (!isDfa && r.write !== "") {
			set.add(r.write);
		}
	}
	return [...set];
}

// draft から spec を組み立てる。未完成の行は無視。start 空・決定性違反・記号が
// 1 文字でない場合は { error } を返し、妥当なら { spec } を返す。
export function buildSpec(
	draft: Draft,
	isDfa: boolean,
): { spec?: Spec; error?: string } {
	if (draft.start === "") {
		return { error: "初期状態は必須です。" };
	}
	const complete = completeRows(draft.rows);
	const keys = new Set<string>();
	for (const r of complete) {
		const key = JSON.stringify([r.from, r.read]);
		if (keys.has(key)) {
			return { error: "同じ from と 読み記号 の組が重複しています(決定性)。" };
		}
		keys.add(key);
	}
	const states = deriveStates(draft);
	const accepts = parseCsv(draft.accept);
	const symbols = deriveSymbols(draft.rows, isDfa);
	if (isDfa) {
		const parsed = dfaSpecSchema.safeParse({
			states,
			alphabet: symbols,
			start: draft.start,
			accept: accepts,
			transitions: complete.map((r) => ({
				from: r.from,
				read: r.read,
				to: r.to,
			})),
		});
		if (!parsed.success) {
			return { error: "読み記号は 1 文字にしてください。" };
		}
		return { spec: parsed.data as DFASpec };
	}
	const parsed = dtmSpecSchema.safeParse({
		states,
		tapeAlphabet: symbols,
		start: draft.start,
		accept: accepts,
		transitions: complete.map((r) => ({
			from: r.from,
			read: r.read === "" ? null : r.read,
			to: r.to,
			write: r.write === "" ? null : r.write,
			move: r.move,
		})),
	});
	if (!parsed.success) {
		return { error: "読み/書き記号は 1 文字にしてください。" };
	}
	return { spec: parsed.data as DTMSpec };
}

// 未使用の状態名 qN を作る(既存 states と衝突しない最小の連番)。
export function freshState(states: string[]): string {
	const set = new Set(states);
	let i = 0;
	while (set.has(`q${i}`)) {
		i += 1;
	}
	return `q${i}`;
}
