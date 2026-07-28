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

// 現在カーソルまでの遷移履歴を瞬間記述(⊢ 記法)の列で表示する。
export function TraceHistory({
	frames,
	cursor,
}: {
	frames: Frame[];
	cursor: number;
}) {
	return (
		<ol className="space-y-1 text-sm leading-6">
			{frames.slice(0, cursor + 1).map((f, i) => (
				<li
					// biome-ignore lint/suspicious/noArrayIndexKey: コマ位置がキーの意味を持つ
					key={i}
					className={
						i === cursor
							? "rounded bg-blue-50 px-1 dark:bg-blue-950/40"
							: "px-1"
					}
				>
					<span className="mr-1 inline-block w-3 text-gray-400">
						{i === 0 ? "" : "⊢"}
					</span>
					<IdLine frame={f} />
				</li>
			))}
		</ol>
	);
}
