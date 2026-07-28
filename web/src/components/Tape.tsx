// テープの右側パディング(半無限テープを空セルで示唆する)。
const BLANK_PAD = 3;

function glyph(cell: string | null): string {
	return cell === null ? "␣" : cell;
}

// DTM のテープ。left ++ [head] ++ right を連続した帯として描き、ヘッドを
// ▼ ポインタとハイライトで示す。右端に空セルを足して半無限を示唆する。
export function Tape({
	left,
	head,
	right,
}: {
	left: (string | null)[];
	head: string | null;
	right: (string | null)[];
}) {
	const headIndex = left.length;
	const cells: (string | null)[] = [
		...left,
		head,
		...right,
		...Array.from({ length: BLANK_PAD }, () => null),
	];

	return (
		<div className="mt-3">
			<div className="text-sm text-gray-500">テープ(▼ = ヘッド)</div>
			<div className="mt-1 overflow-x-auto pb-1">
				<div className="inline-block">
					{/* ヘッドポインタ(セル帯と同じ 1px 分だけ内側に寄せて列を揃える) */}
					<div className="flex border border-transparent">
						{cells.map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: テープはセル位置そのものがキーの意味を持つ
							<div key={i} className="flex w-9 justify-center">
								{i === headIndex ? (
									<span className="text-blue-500 text-xs leading-none">▼</span>
								) : null}
							</div>
						))}
					</div>
					{/* セル帯(境界を共有して連続した帯に見せる) */}
					<div className="flex divide-x divide-gray-300 rounded border border-gray-400 bg-gray-50 dark:divide-gray-600 dark:border-gray-500 dark:bg-gray-800">
						{cells.map((c, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: テープはセル位置そのものがキーの意味を持つ
								key={i}
								data-head={i === headIndex}
								className={`flex h-10 w-9 items-center justify-center font-mono ${
									i === headIndex
										? "bg-blue-100 font-bold text-blue-900 dark:bg-blue-900 dark:text-blue-100"
										: c === null
											? "text-gray-400"
											: ""
								}`}
							>
								{glyph(c)}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
