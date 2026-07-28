import { type Draft, deriveStates, deriveSymbols } from "./specDraft.ts";

// 機械の定義(遷移・初期状態・受理状態)を編集する制御コンポーネント。編集状態は
// App が draft として保持し、変更は onChange で通知する(App がライブに spec へ反映)。
// states と 使える記号(アルファベット/テープ記号)は遷移関数から自動導出し、
// 読み取り専用で一覧表示する。error は App から受け取り role="alert" で表示する。
export function SpecEditor({
	draft,
	isDfa,
	error,
	onChange,
}: {
	draft: Draft;
	isDfa: boolean;
	error: string | null;
	onChange: (draft: Draft) => void;
}) {
	const rows = draft.rows;
	const states = deriveStates(draft);
	const symbols = deriveSymbols(rows, isDfa);

	const update = (i: number, patch: Partial<Draft["rows"][number]>) => {
		onChange({
			...draft,
			rows: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
		});
	};
	const addRow = () => {
		onChange({
			...draft,
			rows: [...rows, { from: "", read: "", to: "", write: "", move: "R" }],
		});
	};
	const removeRow = (i: number) => {
		onChange({ ...draft, rows: rows.filter((_, j) => j !== i) });
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
						value={draft.start}
						onChange={(e) => onChange({ ...draft, start: e.target.value })}
					/>
				</label>
				<label className="flex items-center gap-1">
					<span className="w-16 shrink-0 text-gray-500">受理状態</span>
					<input
						className={`${cell} flex-1`}
						value={draft.accept}
						onChange={(e) => onChange({ ...draft, accept: e.target.value })}
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
