import { useState } from "react";
import {
	type DFASpec,
	type DTMSpec,
	dfaSpecSchema,
	dtmSpecSchema,
} from "../contract/schemas.ts";
import type { Machine } from "../fixtures/machines.ts";
import type { Spec } from "../store/replay.ts";

// 1 行分の編集状態。DFA は from/read/to、DTM は write/move も使う。
interface Row {
	from: string;
	read: string;
	to: string;
	write: string;
	move: "L" | "R";
}

function rowsFromMachine(machine: Machine): Row[] {
	if (machine.kind === "dfa") {
		return machine.spec.transitions.map((t) => ({
			from: t.from,
			read: t.read,
			to: t.to,
			write: "",
			move: "R",
		}));
	}
	return machine.spec.transitions.map((t) => ({
		from: t.from,
		read: t.read ?? "",
		to: t.to,
		write: t.write ?? "",
		move: t.move,
	}));
}

// カンマ区切りの入力を記号/状態のリストへ(空白除去・空要素は捨てる)。
function parseCsv(s: string): string[] {
	return s
		.split(",")
		.map((x) => x.trim())
		.filter((x) => x !== "");
}

// 状態集合を導出する: 遷移が参照する from/to に加え、start・accept も含める
// (遷移を持たない受理状態や新規状態も states に載るように)。
function derivedStates(rows: Row[], start: string, accept: string[]): string[] {
	const set = new Set<string>();
	if (start !== "") {
		set.add(start);
	}
	for (const s of accept) {
		set.add(s);
	}
	for (const r of rows) {
		if (r.from !== "") {
			set.add(r.from);
		}
		if (r.to !== "") {
			set.add(r.to);
		}
	}
	return [...set];
}

// 機械の定義(遷移・初期状態・受理状態・使える記号)を編集して spec を組み立てる
// エディタ。states は from/to・start・accept から自動導出する。新規機械では空から
// 定義でき、既存機械では現在の定義を初期値として読み込む。
export function SpecEditor({
	machine,
	onRun,
}: {
	machine: Machine;
	onRun: (spec: Spec) => void;
}) {
	const isDfa = machine.kind === "dfa";
	const [rows, setRows] = useState<Row[]>(() => rowsFromMachine(machine));
	const [start, setStart] = useState(machine.spec.start);
	const [accept, setAccept] = useState(machine.spec.accept.join(", "));
	const [symbols, setSymbols] = useState(() =>
		(machine.kind === "dfa"
			? machine.spec.alphabet
			: machine.spec.tapeAlphabet
		).join(", "),
	);
	const [error, setError] = useState<string | null>(null);

	const acceptList = parseCsv(accept);
	const states = derivedStates(rows, start, acceptList);

	const update = (i: number, patch: Partial<Row>) => {
		setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
	};
	const addRow = () => {
		setRows((rs) => [
			...rs,
			{ from: "", read: "", to: "", write: "", move: "R" },
		]);
	};
	const removeRow = (i: number) => {
		setRows((rs) => rs.filter((_, j) => j !== i));
	};

	const run = () => {
		if (rows.some((r) => r.from === "" || r.to === "")) {
			setError("from と to は空にできません。");
			return;
		}
		if (start === "") {
			setError("初期状態(start)は必須です。");
			return;
		}
		// 決定性: 同じ (from, 読み) の組は 1 つだけ(契約 §1)。
		const keys = new Set<string>();
		for (const r of rows) {
			const key = JSON.stringify([r.from, r.read]);
			if (keys.has(key)) {
				setError("同じ from と 読み記号 の組が重複しています(決定性)。");
				return;
			}
			keys.add(key);
		}
		const symbolList = parseCsv(symbols);
		if (isDfa) {
			const spec = {
				states,
				alphabet: symbolList,
				start,
				accept: acceptList,
				transitions: rows.map((r) => ({
					from: r.from,
					read: r.read,
					to: r.to,
				})),
			};
			const parsed = dfaSpecSchema.safeParse(spec);
			if (!parsed.success) {
				setError("読み記号・使える記号は 1 文字にしてください(空欄不可)。");
				return;
			}
			setError(null);
			onRun(parsed.data as DFASpec);
			return;
		}
		const spec = {
			states,
			tapeAlphabet: symbolList,
			start,
			accept: acceptList,
			transitions: rows.map((r) => ({
				from: r.from,
				read: r.read === "" ? null : r.read,
				to: r.to,
				write: r.write === "" ? null : r.write,
				move: r.move,
			})),
		};
		const parsed = dtmSpecSchema.safeParse(spec);
		if (!parsed.success) {
			setError(
				"読み/書き・テープ記号は 1 文字にしてください(空欄は空白セル)。",
			);
			return;
		}
		setError(null);
		onRun(parsed.data as DTMSpec);
	};

	const cell =
		"min-w-0 rounded border border-gray-300 px-1 py-0.5 font-mono text-sm dark:border-gray-600 dark:bg-gray-700";

	return (
		<div className="flex flex-col gap-1">
			{/* 機械レベルの定義(初期状態・受理状態・使える記号)。states は自動導出。 */}
			<div className="flex flex-col gap-1 text-xs">
				<label className="flex items-center gap-1">
					<span className="w-16 shrink-0 text-gray-500">初期状態</span>
					<input
						className={`${cell} flex-1`}
						value={start}
						onChange={(e) => setStart(e.target.value)}
					/>
				</label>
				<label className="flex items-center gap-1">
					<span className="w-16 shrink-0 text-gray-500">受理状態</span>
					<input
						className={`${cell} flex-1`}
						value={accept}
						onChange={(e) => setAccept(e.target.value)}
						placeholder="カンマ区切り"
					/>
				</label>
				<label className="flex items-center gap-1">
					<span className="w-16 shrink-0 text-gray-500">
						{isDfa ? "アルファベット" : "テープ記号"}
					</span>
					<input
						className={`${cell} flex-1`}
						value={symbols}
						onChange={(e) => setSymbols(e.target.value)}
						placeholder="カンマ区切り"
					/>
				</label>
				<div className="text-gray-400">
					状態一覧: {states.length > 0 ? states.join(", ") : "(なし)"}
				</div>
			</div>
			<div className="overflow-x-auto">
				<table className="text-sm">
					<thead>
						<tr className="text-gray-500 text-xs">
							<th className="px-1 text-left font-normal">from</th>
							<th className="px-1 text-left font-normal">読</th>
							{!isDfa && <th className="px-1 text-left font-normal">書</th>}
							{!isDfa && <th className="px-1 text-left font-normal">移動</th>}
							<th className="px-1 text-left font-normal">to</th>
							<th />
						</tr>
					</thead>
					<tbody>
						{rows.map((r, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: 行位置がキー
							<tr key={i}>
								<td className="px-0.5 py-0.5">
									<input
										aria-label={`from ${i}`}
										className={`${cell} w-14`}
										value={r.from}
										onChange={(e) => update(i, { from: e.target.value })}
									/>
								</td>
								<td className="px-0.5 py-0.5">
									<input
										aria-label={`read ${i}`}
										className={`${cell} w-8`}
										value={r.read}
										onChange={(e) => update(i, { read: e.target.value })}
									/>
								</td>
								{!isDfa && (
									<td className="px-0.5 py-0.5">
										<input
											aria-label={`write ${i}`}
											className={`${cell} w-8`}
											value={r.write}
											onChange={(e) => update(i, { write: e.target.value })}
										/>
									</td>
								)}
								{!isDfa && (
									<td className="px-0.5 py-0.5">
										<select
											aria-label={`move ${i}`}
											className={`${cell}`}
											value={r.move}
											onChange={(e) =>
												update(i, { move: e.target.value as "L" | "R" })
											}
										>
											<option value="L">L</option>
											<option value="R">R</option>
										</select>
									</td>
								)}
								<td className="px-0.5 py-0.5">
									<input
										aria-label={`to ${i}`}
										className={`${cell} w-14`}
										value={r.to}
										onChange={(e) => update(i, { to: e.target.value })}
									/>
								</td>
								<td className="px-0.5 py-0.5">
									<button
										type="button"
										aria-label={`delete ${i}`}
										className="rounded px-1 text-gray-400 text-xs hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
										onClick={() => removeRow(i)}
									>
										×
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{error && <div className="text-red-600 text-xs">{error}</div>}
			<div className="flex gap-1">
				<button
					type="button"
					className="rounded border border-gray-300 px-2 py-0.5 text-xs dark:border-gray-600 dark:hover:bg-gray-700"
					onClick={addRow}
				>
					行を追加
				</button>
				<button
					type="button"
					className="rounded border border-gray-300 px-2 py-0.5 text-xs dark:border-gray-600 dark:hover:bg-gray-700"
					onClick={run}
				>
					この定義で実行
				</button>
			</div>
		</div>
	);
}
