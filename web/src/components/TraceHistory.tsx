import type { Frame } from "../store/replay.ts";

// 記号セル。null は ␣。head(現在参照しているセル)は赤で強調する。
function Sym({ sym, head }: { sym: string | null; head?: boolean }) {
	const glyph = sym === null ? "␣" : sym;
	const cls = head
		? "font-bold text-red-600 dark:text-red-400"
		: sym === null
			? "text-gray-400"
			: undefined;
	return <span className={cls}>{glyph}</span>;
}

// 状態(ヘッド直前にインライン表示する)。
function State({ s }: { s: string }) {
	return (
		<span className="mx-0.5 rounded bg-blue-100 px-1 text-blue-700 text-xs dark:bg-blue-900 dark:text-blue-200">
			{s}
		</span>
	);
}

// 瞬間記述(ID)1 行。DFA は 状態+残り入力(先頭を強調)、DTM は
// 左…状態 ヘッド …右(ヘッドを強調)。遷移関数は書かない。
export function IdLine({ frame }: { frame: Frame }) {
	const { config } = frame;
	if ("rest" in config) {
		return (
			<span className="font-mono">
				<State s={config.state} />
				{config.rest.length === 0 ? (
					<span className="text-gray-400">␣</span>
				) : (
					config.rest.map((sym, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: 記号位置がキーの意味を持つ
						<Sym key={i} sym={sym} head={i === 0} />
					))
				)}
			</span>
		);
	}
	return (
		<span className="font-mono">
			{config.left.map((sym, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: 記号位置がキーの意味を持つ
				<Sym key={`l${i}`} sym={sym} />
			))}
			<State s={config.state} />
			<Sym sym={config.head} head />
			{config.right.map((sym, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: 記号位置がキーの意味を持つ
				<Sym key={`r${i}`} sym={sym} />
			))}
		</span>
	);
}

// 遷移履歴を瞬間記述(⊢ 記法)の列で表示する。全コマを常に表示し(戻っても
// 消えない)、行をクリックするとそのコマへジャンプする。現在行は強調。
export function TraceHistory({
	frames,
	current,
	onSelect,
}: {
	frames: Frame[];
	current: number;
	onSelect: (index: number) => void;
}) {
	return (
		<ol className="text-sm leading-6">
			{frames.map((f, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: コマ位置がキーの意味を持つ
				<li key={i}>
					<button
						type="button"
						onClick={() => onSelect(i)}
						aria-current={i === current ? "step" : undefined}
						className={`flex w-full items-baseline gap-1 rounded px-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
							// 現在行。状態チップ(bg-blue-100)と同色で埋もれないようリングで示し、
							// 強制カラー環境でも aria-current で現在位置が伝わるようにする。
							i === current
								? "bg-blue-50 ring-1 ring-blue-400 ring-inset dark:bg-blue-900/40 dark:ring-blue-500"
								: ""
						}`}
					>
						<span className="inline-block w-3 shrink-0 text-gray-400">
							{i === 0 ? "" : "⊢"}
						</span>
						<IdLine frame={f} />
					</button>
				</li>
			))}
		</ol>
	);
}
