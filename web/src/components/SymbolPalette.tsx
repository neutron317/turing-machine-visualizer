// 入力(テープ)に使える記号の一覧。DFA は alphabet、DTM は tapeAlphabet を渡す。
// クリックすると入力欄へその記号を追記できる(記号は 1 文字。契約 §1)。
export function SymbolPalette({
	symbols,
	onPick,
}: {
	symbols: string[];
	onPick: (sym: string) => void;
}) {
	if (symbols.length === 0) {
		return null;
	}
	return (
		<div className="flex flex-wrap items-center gap-1">
			<span className="text-gray-500 text-xs">使える記号:</span>
			{symbols.map((s) => (
				<button
					key={s}
					type="button"
					aria-label={`記号 ${s} を追加`}
					className="rounded border border-gray-300 px-1.5 py-0.5 font-mono text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
					onClick={() => onPick(s)}
				>
					{s}
				</button>
			))}
		</div>
	);
}
