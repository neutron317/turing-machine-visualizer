import { useEffect, useRef, useState } from "react";
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

// カンマ区切りの入力を状態のリストへ(空白除去・空要素は捨てる)。
function parseCsv(s: string): string[] {
	return s
		.split(",")
		.map((x) => x.trim())
		.filter((x) => x !== "");
}

// 未完成の行(from/to が空)を除いた遷移だけを対象にする。
function completeRows(rows: Row[]): Row[] {
	return rows.filter((r) => r.from !== "" && r.to !== "");
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

// 使える記号(アルファベット/テープ記号)を遷移関数から自動導出する。
// DFA は read、DTM は read と write の非空(空白 null は除く)を集める。
function derivedSymbols(rows: Row[], isDfa: boolean): string[] {
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

// 機械の定義(遷移・初期状態・受理状態)を編集するエディタ。変更のたびに妥当な
// spec を組み立てて onSpecChange へライブで通知する(実行ボタンは無い)。states と
// 使える記号(アルファベット/テープ記号)は遷移関数から自動導出し、読み取り専用で
// 一覧表示する。未完成の行(from/to が空)は無視し、決定性違反や空の初期状態は
// エラー表示にして通知しない。
export function SpecEditor({
	machine,
	onSpecChange,
}: {
	machine: Machine;
	onSpecChange: (spec: Spec) => void;
}) {
	const isDfa = machine.kind === "dfa";
	const [rows, setRows] = useState<Row[]>(() => rowsFromMachine(machine));
	const [start, setStart] = useState(machine.spec.start);
	const [accept, setAccept] = useState(machine.spec.accept.join(", "));
	const [error, setError] = useState<string | null>(null);

	const acceptList = parseCsv(accept);
	const states = derivedStates(rows, start, acceptList);
	const symbols = derivedSymbols(rows, isDfa);

	// onSpecChange の識別子が変わってもライブ通知の effect を再実行させないよう ref 経由で呼ぶ。
	const onSpecChangeRef = useRef(onSpecChange);
	onSpecChangeRef.current = onSpecChange;

	// 編集値が変わるたびに spec を組み立てて通知する(初回マウントは除く。初期状態は
	// 呼び出し側が machine.spec から持っているため二重に流さない)。
	const didMount = useRef(false);
	useEffect(() => {
		if (!didMount.current) {
			didMount.current = true;
			return;
		}
		if (start === "") {
			setError("初期状態は必須です。");
			return;
		}
		const complete = completeRows(rows);
		const keys = new Set<string>();
		for (const r of complete) {
			const key = JSON.stringify([r.from, r.read]);
			if (keys.has(key)) {
				setError("同じ from と 読み記号 の組が重複しています(決定性)。");
				return;
			}
			keys.add(key);
		}
		const accepts = parseCsv(accept);
		const sts = derivedStates(complete, start, accepts);
		const syms = derivedSymbols(complete, isDfa);
		if (isDfa) {
			const parsed = dfaSpecSchema.safeParse({
				states: sts,
				alphabet: syms,
				start,
				accept: accepts,
				transitions: complete.map((r) => ({
					from: r.from,
					read: r.read,
					to: r.to,
				})),
			});
			if (!parsed.success) {
				setError("読み記号は 1 文字にしてください。");
				return;
			}
			setError(null);
			onSpecChangeRef.current(parsed.data as DFASpec);
			return;
		}
		const parsed = dtmSpecSchema.safeParse({
			states: sts,
			tapeAlphabet: syms,
			start,
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
			setError("読み/書き記号は 1 文字にしてください。");
			return;
		}
		setError(null);
		onSpecChangeRef.current(parsed.data as DTMSpec);
	}, [rows, start, accept, isDfa]);

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

	const cell =
		"min-w-0 rounded border border-gray-300 px-1 py-0.5 font-mono text-sm dark:border-gray-600 dark:bg-gray-700";

	return (
		<div className="flex flex-col gap-1">
			{/* 機械レベルの定義。states と 使える記号 は遷移関数から自動導出(読み取り専用)。 */}
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
				<div className="text-gray-400">
					状態一覧: {states.length > 0 ? states.join(", ") : "(なし)"}
				</div>
				<div className="text-gray-400">
					{isDfa ? "アルファベット" : "テープ記号"}:{" "}
					{symbols.length > 0 ? symbols.join(", ") : "(なし)"}
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
			{error && (
				<div role="alert" className="text-red-600 text-xs">
					{error}
				</div>
			)}
			<button
				type="button"
				className="self-start rounded border border-gray-300 px-2 py-0.5 text-xs dark:border-gray-600 dark:hover:bg-gray-700"
				onClick={addRow}
			>
				行を追加
			</button>
		</div>
	);
}
