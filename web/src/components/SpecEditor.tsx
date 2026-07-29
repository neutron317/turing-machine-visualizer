import { memo } from "react";
import {
	addState,
	type Draft,
	deleteState,
	deriveStates,
	deriveSymbols,
	invalidRowIndices,
	renameState,
} from "./specDraft.ts";

// 機械の定義を編集する制御コンポーネント。編集状態は App が draft として保持し、
// 変更は onChange で通知する(App がライブに spec へ反映)。状態は追加/改名/消去/
// 初期・受理の指定ができる。使える記号(アルファベット/テープ記号)は遷移関数から
// 自動導出して読み取り専用で表示する。error は App から受け取り role="alert" で表示。
// memo 化: 再生中は draft/isDfa/error/onChange が不変なので再描画をスキップする
// (大きな機械では遷移表の行数が多く、毎ステップの再描画が重いため)。
export const SpecEditor = memo(function SpecEditor({
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
	// 無効な遷移(記号不正・決定性違反)の件数。色以外の手掛かりとして注記に使う。
	const invalidCount = invalidRowIndices(rows, isDfa).size;

	const updateRow = (i: number, patch: Partial<Draft["rows"][number]>) => {
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
	const toggleAccept = (s: string, on: boolean) => {
		onChange({
			...draft,
			accept: on ? [...draft.accept, s] : draft.accept.filter((x) => x !== s),
		});
	};

	const cell =
		"min-w-0 rounded border border-gray-300 px-1 py-0.5 font-mono text-sm dark:border-gray-600 dark:bg-gray-700";
	const btn =
		"rounded border border-gray-300 px-2 py-0.5 text-xs dark:border-gray-600 dark:hover:bg-gray-700";
	const del =
		"rounded px-1 text-gray-400 text-xs hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700";

	return (
		<div className="flex flex-col gap-2">
			{/* 状態: 改名(入力)・受理(チェック)・消去(×)・追加。初期状態は選択。 */}
			<div className="flex flex-col gap-1">
				<div className="text-gray-500 text-xs">状態(受理はチェック)</div>
				{states.map((s, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: 位置がキー
					<div key={i} className="flex items-center gap-1">
						<input
							aria-label={`state ${i}`}
							className={`${cell} flex-1`}
							value={s}
							onChange={(e) => {
								// 空欄への改名は無視(名前を消すのは × で。空文字は未入力の番兵)。
								if (e.target.value !== "") {
									onChange(renameState(draft, s, e.target.value));
								}
							}}
						/>
						<label className="flex items-center gap-0.5 text-gray-500 text-xs">
							<input
								type="checkbox"
								aria-label={`受理 ${s}`}
								checked={draft.accept.includes(s)}
								onChange={(e) => toggleAccept(s, e.target.checked)}
							/>
							受理
						</label>
						<button
							type="button"
							aria-label={`状態 ${s} を消去`}
							className={del}
							onClick={() => onChange(deleteState(draft, s))}
						>
							×
						</button>
					</div>
				))}
				<div className="flex items-center gap-2">
					<button
						type="button"
						className={btn}
						onClick={() => onChange(addState(draft))}
					>
						状態を追加
					</button>
					<label className="flex items-center gap-1 text-xs">
						<span className="text-gray-500">初期状態</span>
						<select
							aria-label="初期状態"
							className={cell}
							value={draft.start}
							onChange={(e) => onChange({ ...draft, start: e.target.value })}
						>
							<option value="">(未設定)</option>
							{states.map((s) => (
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
					</label>
				</div>
				<div className="text-gray-400 text-xs">
					{isDfa ? "アルファベット" : "テープ記号"}:{" "}
					{symbols.length > 0 ? symbols.join(", ") : "(なし)"}
				</div>
			</div>

			{/* 遷移表 */}
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
										onChange={(e) => updateRow(i, { from: e.target.value })}
									/>
								</td>
								<td className="px-0.5 py-0.5">
									<input
										aria-label={`read ${i}`}
										className={`${cell} w-8`}
										value={r.read}
										onChange={(e) => updateRow(i, { read: e.target.value })}
									/>
								</td>
								{!isDfa && (
									<td className="px-0.5 py-0.5">
										<input
											aria-label={`write ${i}`}
											className={`${cell} w-8`}
											value={r.write}
											onChange={(e) => updateRow(i, { write: e.target.value })}
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
												updateRow(i, { move: e.target.value as "L" | "R" })
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
										onChange={(e) => updateRow(i, { to: e.target.value })}
									/>
								</td>
								<td className="px-0.5 py-0.5">
									<button
										type="button"
										aria-label={`delete ${i}`}
										className={del}
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
			{invalidCount > 0 && (
				<div className="text-red-600 text-xs">
					⚠ 無効な遷移が {invalidCount}{" "}
					件あります(図で赤・破線。実行からは除外)。
				</div>
			)}
			<button type="button" className={`self-start ${btn}`} onClick={addRow}>
				行を追加
			</button>
		</div>
	);
});
