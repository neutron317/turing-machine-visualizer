import type { Status } from "../contract/schemas.ts";
import type { Fired, Frame } from "../store/replay.ts";
import { Tape } from "./Tape.tsx";

// テープ空白(null)の表示。
function cell(sym: string | null): string {
	return sym === null ? "␣" : sym;
}

const statusLabel: Record<Status, string> = {
	running: "実行中",
	accept: "受理",
	reject: "拒否",
};

const statusClass: Record<Status, string> = {
	running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	accept: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
	reject: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function StatusBadge({ status }: { status: Status }) {
	return (
		<span
			className={`rounded px-2 py-0.5 text-sm font-medium ${statusClass[status]}`}
		>
			{statusLabel[status]}
		</span>
	);
}

function Cells({ items }: { items: (string | null)[] }) {
	return (
		<span className="inline-flex gap-1">
			{items.map((sym, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: テープはインデックス位置そのものが意味を持つ
					key={i}
					className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 font-mono dark:border-gray-600"
				>
					{cell(sym)}
				</span>
			))}
		</span>
	);
}

// DFA: 残りの入力(先頭が次に読む記号)。
function DfaTape({ rest }: { rest: string[] }) {
	return (
		<div className="mt-3">
			<div className="text-sm text-gray-500">残り入力</div>
			{rest.length > 0 ? (
				<Cells items={rest} />
			) : (
				<span className="text-gray-500">(なし)</span>
			)}
		</div>
	);
}

function FiredView({ fired }: { fired: Fired }) {
	if (fired === null) {
		return <div className="mt-3 text-sm text-gray-500">発火した遷移: —</div>;
	}
	const arrow =
		"move" in fired
			? `${cell(fired.read)}/${cell(fired.write)},${fired.move}`
			: fired.read;
	return (
		<div className="mt-3 text-sm text-gray-500">
			発火した遷移:{" "}
			<span className="font-mono text-gray-700 dark:text-gray-300">
				{fired.from} ──{arrow}──▶ {fired.to}
			</span>
		</div>
	);
}

export function ConfigView({ frame }: { frame: Frame }) {
	const { config, status, fired } = frame;
	return (
		<section className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
			<div className="flex items-center gap-3">
				<StatusBadge status={status} />
				<span className="font-mono text-lg">状態: {config.state}</span>
			</div>
			{"rest" in config ? (
				<DfaTape rest={config.rest} />
			) : (
				<Tape left={config.left} head={config.head} right={config.right} />
			)}
			<FiredView fired={fired} />
		</section>
	);
}
