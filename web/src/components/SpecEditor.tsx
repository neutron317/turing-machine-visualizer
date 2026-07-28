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

// 参照している状態(from/to)を states に取り込む(遷移先の新規状態も動くように)。
function derivedStates(base: string[], rows: Row[]): string[] {
	const set = new Set(base);
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

// 遷移表を編集して spec を組み立てるエディタ。states/alphabet/start/accept は
// プリセットのものを引き継ぎ、遷移(と参照する状態)だけを編集する。
export function SpecEditor({
	machine,
	onRun,
}: {
	machine: Machine;
	onRun: (spec: Spec) => void;
}) {
	const [rows, setRows] = useState<Row[]>(() => rowsFromMachine(machine));
	const [error, setError] = useState<string | null>(null);
	const isDfa = machine.kind === "dfa";

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
		if (isDfa) {
			const spec = {
				states: derivedStates(machine.spec.states, rows),
				alphabet: machine.spec.alphabet,
				start: machine.spec.start,
				accept: machine.spec.accept,
				transitions: rows.map((r) => ({
					from: r.from,
					read: r.read,
					to: r.to,
				})),
			};
			const parsed = dfaSpecSchema.safeParse(spec);
			if (!parsed.success) {
				setError("読み記号は 1 文字にしてください(空欄不可)。");
				return;
			}
			setError(null);
			onRun(parsed.data as DFASpec);
			return;
		}
		const spec = {
			states: derivedStates(machine.spec.states, rows),
			tapeAlphabet: (machine.spec as DTMSpec).tapeAlphabet,
			start: machine.spec.start,
			accept: machine.spec.accept,
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
			setError("読み/書き記号は 1 文字にしてください(空欄は空白セル)。");
			return;
		}
		setError(null);
		onRun(parsed.data as DTMSpec);
	};

	const cell =
		"min-w-0 rounded border border-gray-300 px-1 py-0.5 font-mono text-sm dark:border-gray-600 dark:bg-gray-700";

	return (
		<div className="flex flex-col gap-1">
			<div className="text-gray-500 text-xs">遷移表(編集して実行)</div>
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
