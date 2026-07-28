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

// 編集中の機械定義。states は明示リスト(孤立状態も保持・並び順もこれで決まる)。
// symbols(アルファベット/テープ記号)は遷移から自動導出するので持たない。
export interface Draft {
	states: string[];
	start: string;
	accept: string[];
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
		accept: [...machine.spec.accept],
		rows,
	};
}

// ラベル表示用: 空文字(空白セル)は ␣ で表す。
export function sym(x: string): string {
	return x === "" ? "␣" : x;
}

// 未完成の行(from/to が空)を除いた遷移だけを対象にする。
export function completeRows(rows: Row[]): Row[] {
	return rows.filter((r) => r.from !== "" && r.to !== "");
}

// 記号の妥当性: DFA は read が 1 文字必須。DTM は read/write が空(=空白)か 1 文字。
function rowSymbolOk(r: Row, isDfa: boolean): boolean {
	if (isDfa) {
		return r.read.length === 1;
	}
	return r.read.length <= 1 && r.write.length <= 1;
}

// 無効な行(完成済みだが記号が不正、または (from,read) が重複=決定性違反)の
// インデックス集合。表示では赤く、spec 生成では除外する。
export function invalidRowIndices(rows: Row[], isDfa: boolean): Set<number> {
	const invalid = new Set<number>();
	const complete: { r: Row; i: number }[] = [];
	rows.forEach((r, i) => {
		if (r.from !== "" && r.to !== "") {
			complete.push({ r, i });
		}
	});
	for (const { r, i } of complete) {
		if (!rowSymbolOk(r, isDfa)) {
			invalid.add(i);
		}
	}
	// 記号が妥当な行だけで (from,read) の重複を検出する。
	const byKey = new Map<string, number[]>();
	for (const { r, i } of complete) {
		if (invalid.has(i)) {
			continue;
		}
		const key = JSON.stringify([r.from, r.read]);
		const arr = byKey.get(key);
		if (arr) {
			arr.push(i);
		} else {
			byKey.set(key, [i]);
		}
	}
	for (const idxs of byKey.values()) {
		if (idxs.length > 1) {
			for (const i of idxs) {
				invalid.add(i);
			}
		}
	}
	return invalid;
}

// 状態集合: 明示 states に加え、start・accept・遷移の from/to を取り込む。
// 空文字はセルの未入力を表す番兵なので状態としては扱わない。
export function deriveStates(draft: Draft): string[] {
	const set = new Set<string>();
	for (const s of draft.states) {
		if (s !== "") {
			set.add(s);
		}
	}
	if (draft.start !== "") {
		set.add(draft.start);
	}
	for (const s of draft.accept) {
		if (s !== "") {
			set.add(s);
		}
	}
	for (const r of completeRows(draft.rows)) {
		set.add(r.from);
		set.add(r.to);
	}
	return [...set];
}

// 使える記号(アルファベット/テープ記号)を遷移関数から自動導出する。妥当な
// (完成済み・記号 OK)行のみを対象にする。DFA は read、DTM は read+write。
export function deriveSymbols(
	rows: Row[],
	isDfa: boolean,
	invalid: Set<number> = invalidRowIndices(rows, isDfa),
): string[] {
	const set = new Set<string>();
	rows.forEach((r, i) => {
		if (r.from === "" || r.to === "" || invalid.has(i)) {
			return;
		}
		if (r.read !== "") {
			set.add(r.read);
		}
		if (!isDfa && r.write !== "") {
			set.add(r.write);
		}
	});
	return [...set];
}

// 図の表示用グラフ。無効な遷移も valid:false として含める(隠さず赤く出す)。
export interface DisplayEdge {
	from: string;
	to: string;
	label: string;
	valid: boolean;
}
export interface DisplayGraph {
	states: string[];
	start: string;
	accept: Set<string>;
	edges: DisplayEdge[];
}

export function draftGraph(draft: Draft, isDfa: boolean): DisplayGraph {
	const invalid = invalidRowIndices(draft.rows, isDfa);
	const grouped = new Map<string, DisplayEdge>();
	draft.rows.forEach((r, i) => {
		if (r.from === "" || r.to === "") {
			return; // 未完成の行は描かない。
		}
		const key = JSON.stringify([r.from, r.to]);
		const label = isDfa
			? sym(r.read)
			: `${sym(r.read)}/${sym(r.write)},${r.move}`;
		const rowValid = !invalid.has(i);
		const g = grouped.get(key);
		if (g) {
			g.label += `, ${label}`;
			if (!rowValid) {
				g.valid = false;
			}
		} else {
			grouped.set(key, { from: r.from, to: r.to, label, valid: rowValid });
		}
	});
	return {
		states: deriveStates(draft),
		start: draft.start,
		accept: new Set(draft.accept),
		edges: [...grouped.values()],
	};
}

// draft から spec を組み立てる。無効な遷移(記号不正・決定性違反)は除外し、
// 有効な遷移だけで実行する。start が空のときだけ error を返す。
export function buildSpec(
	draft: Draft,
	isDfa: boolean,
): { spec?: Spec; error?: string } {
	if (draft.start === "") {
		return { error: "初期状態を設定してください。" };
	}
	const invalid = invalidRowIndices(draft.rows, isDfa);
	const validRows = draft.rows.filter(
		(r, i) => r.from !== "" && r.to !== "" && !invalid.has(i),
	);
	const states = deriveStates(draft);
	const symbols = deriveSymbols(draft.rows, isDfa, invalid);
	if (isDfa) {
		const parsed = dfaSpecSchema.safeParse({
			states,
			alphabet: symbols,
			start: draft.start,
			accept: draft.accept,
			transitions: validRows.map((r) => ({
				from: r.from,
				read: r.read,
				to: r.to,
			})),
		});
		if (!parsed.success) {
			return { error: "定義が不正です。" };
		}
		return { spec: parsed.data as DFASpec };
	}
	const parsed = dtmSpecSchema.safeParse({
		states,
		tapeAlphabet: symbols,
		start: draft.start,
		accept: draft.accept,
		transitions: validRows.map((r) => ({
			from: r.from,
			read: r.read === "" ? null : r.read,
			to: r.to,
			write: r.write === "" ? null : r.write,
			move: r.move,
		})),
	});
	if (!parsed.success) {
		return { error: "定義が不正です。" };
	}
	return { spec: parsed.data as DTMSpec };
}

// 記号(アルファベット/テープ記号)の並び順を無視した spec の署名。読み込み/切替
// 時の冗長な再コミット(記号順の違いだけの差分)を抑えるための比較に使う。
export function specSignature(spec: Spec): string {
	if ("alphabet" in spec) {
		return JSON.stringify({ ...spec, alphabet: [...spec.alphabet].sort() });
	}
	return JSON.stringify({
		...spec,
		tapeAlphabet: [...spec.tapeAlphabet].sort(),
	});
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

// --- 状態の追加・削除・改名(参照も追従) ---

export function addState(draft: Draft): Draft {
	return {
		...draft,
		states: [...draft.states, freshState(deriveStates(draft))],
	};
}

export function deleteState(draft: Draft, name: string): Draft {
	const states = draft.states.filter((s) => s !== name);
	const rows = draft.rows.filter((r) => r.from !== name && r.to !== name);
	const accept = draft.accept.filter((s) => s !== name);
	const start = draft.start === name ? (states[0] ?? "") : draft.start;
	return { states, start, accept, rows };
}

export function renameState(
	draft: Draft,
	oldName: string,
	newName: string,
): Draft {
	// 空文字は未入力セルの番兵。改名の対象にすると空欄の行を巻き込むので無視する。
	if (oldName === "") {
		return draft;
	}
	const rep = (s: string) => (s === oldName ? newName : s);
	return {
		states: draft.states.map(rep),
		start: rep(draft.start),
		accept: draft.accept.map(rep),
		rows: draft.rows.map((r) => ({ ...r, from: rep(r.from), to: rep(r.to) })),
	};
}
