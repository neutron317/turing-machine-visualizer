import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { AutomatonDiagram } from "./components/AutomatonDiagram.tsx";
import { ConfigView } from "./components/ConfigView.tsx";
import { TraceHistory } from "./components/TraceHistory.tsx";
import { type Machine, machines } from "./fixtures/machines.ts";
import {
	selectCanStepBack,
	selectCanStepForward,
	selectCurrentFrame,
	useReplayStore,
} from "./store/replay.ts";

const SPEEDS = [1, 2, 4, 8];
const PANEL =
	"rounded-lg border border-gray-200 bg-white/90 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/90";
const CTRL =
	"rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700";

export default function App() {
	const [selectedId, setSelectedId] = useState(machines[0].id);
	const machine = machines.find((m) => m.id === selectedId) ?? machines[0];

	const frame = useReplayStore(selectCurrentFrame);
	const cursor = useReplayStore((s) => s.cursor);
	const frameCount = useReplayStore((s) => s.frames.length);
	const playing = useReplayStore((s) => s.playing);
	const speed = useReplayStore((s) => s.speed);
	const canForward = useReplayStore(selectCanStepForward);
	const canBack = useReplayStore(selectCanStepBack);
	const frames = useReplayStore((s) => s.frames);
	const { load, stepForward, stepBack, reset, play, pause, setSpeed } =
		useReplayStore.getState();

	// 操作板の位置(ドラッグで移動可)。
	const [panelPos, setPanelPos] = useState({ x: 12, y: 12 });
	const [historyOpen, setHistoryOpen] = useState(false);
	const histRef = useRef<HTMLDivElement>(null);
	const panelDrag = useRef<{ dx: number; dy: number } | null>(null);
	const onPanelDown = (e: ReactPointerEvent<HTMLDivElement>) => {
		panelDrag.current = {
			dx: e.clientX - panelPos.x,
			dy: e.clientY - panelPos.y,
		};
		e.currentTarget.setPointerCapture(e.pointerId);
	};
	const onPanelMove = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (!panelDrag.current) {
			return;
		}
		// 画面外へ落として掴み直せなくならないよう、ビューポート内にクランプする。
		const w = 240; // パネル幅(w-60)
		setPanelPos({
			x: Math.min(
				Math.max(0, e.clientX - panelDrag.current.dx),
				window.innerWidth - w,
			),
			y: Math.min(
				Math.max(0, e.clientY - panelDrag.current.dy),
				window.innerHeight - 40,
			),
		});
	};
	const onPanelUp = () => {
		panelDrag.current = null;
	};

	// 初回に既定の機械を読み込む。
	useEffect(() => {
		if (useReplayStore.getState().frames.length === 0) {
			load(machines[0].trace);
		}
	}, [load]);

	// 自動再生。
	useEffect(() => {
		if (!playing) {
			return;
		}
		const id = setInterval(() => {
			useReplayStore.getState().stepForward();
		}, 1000 / speed);
		return () => clearInterval(id);
	}, [playing, speed]);

	// 履歴を開いている間、現在位置(末尾)へ自動スクロール。cursor 変化で再実行したい。
	// biome-ignore lint/correctness/useExhaustiveDependencies: cursor を依存に含めて末尾へ追従させる
	useEffect(() => {
		if (historyOpen && histRef.current) {
			histRef.current.scrollTop = histRef.current.scrollHeight;
		}
	}, [historyOpen, cursor]);

	const selectMachine = (m: Machine) => {
		setSelectedId(m.id);
		load(m.trace);
	};

	const currentState = frame?.config.state ?? machine.spec.start;

	return (
		<main className="relative h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
			{/* 状態図(全面) */}
			<div className="absolute inset-0">
				{frame && (
					<AutomatonDiagram
						key={machine.id}
						spec={machine.spec}
						current={currentState}
						fired={frame.fired}
					/>
				)}
			</div>

			{/* 操作板(ドラッグで移動可) */}
			<div
				className={`absolute z-20 w-60 ${PANEL}`}
				style={{ left: panelPos.x, top: panelPos.y }}
			>
				<div
					className="flex cursor-move items-center gap-2 rounded-t-lg border-gray-200 border-b bg-gray-100/70 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-700/40"
					onPointerDown={onPanelDown}
					onPointerMove={onPanelMove}
					onPointerUp={onPanelUp}
				>
					<span className="text-gray-400 leading-none">⠿</span>
					<h1 className="font-bold text-sm">Turing Machine Visualizer</h1>
				</div>
				<div className="flex flex-col gap-1 p-3">
					{machines.map((m) => (
						<button
							key={m.id}
							type="button"
							aria-pressed={m.id === selectedId}
							className={
								m.id === selectedId
									? "rounded bg-blue-500 px-2 py-1 text-left text-sm text-white"
									: "rounded px-2 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
							}
							onClick={() => selectMachine(m)}
						>
							{m.label}
						</button>
					))}
					<button
						type="button"
						aria-pressed={historyOpen}
						className="mt-2 rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
						onClick={() => setHistoryOpen((o) => !o)}
					>
						{historyOpen ? "遷移履歴を隠す" : "遷移履歴を表示"}
					</button>
				</div>
			</div>

			{/* 下部: 再生コントロール + テープ(全幅) */}
			{frame && (
				<div className="absolute inset-x-0 bottom-0 z-20 border-gray-200 border-t bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-800/90">
					<div className="flex flex-col gap-2">
						<div className="flex flex-wrap items-center gap-2 px-3 pt-3">
							<button type="button" className={CTRL} onClick={reset}>
								最初へ
							</button>
							<button
								type="button"
								className={CTRL}
								onClick={stepBack}
								disabled={!canBack}
							>
								戻る
							</button>
							<button
								type="button"
								className={CTRL}
								onClick={playing ? pause : play}
							>
								{playing ? "一時停止" : "再生"}
							</button>
							<button
								type="button"
								className={CTRL}
								onClick={stepForward}
								disabled={!canForward}
							>
								進む
							</button>
							<select
								aria-label="速度"
								className="rounded border border-gray-300 bg-transparent px-1 py-0.5 text-sm dark:border-gray-600"
								value={speed}
								onChange={(e) => setSpeed(Number(e.target.value))}
							>
								{SPEEDS.map((s) => (
									<option key={s} value={s}>
										{s}x
									</option>
								))}
							</select>
							<span className="ml-auto text-gray-500 text-sm">
								{cursor + 1} / {frameCount}
							</span>
						</div>
						<div className="px-3 pb-3">
							<ConfigView frame={frame} />
						</div>
					</div>
				</div>
			)}

			{/* 遷移履歴ドロワー(出し入れ・⊢ 記法) */}
			<div
				className={`absolute top-0 right-0 z-30 flex h-full w-80 max-w-[85vw] transform flex-col border-gray-200 border-l bg-white/95 backdrop-blur transition-transform dark:border-gray-700 dark:bg-gray-800/95 ${
					historyOpen ? "translate-x-0" : "translate-x-full"
				}`}
			>
				<div className="flex items-center justify-between border-gray-200 border-b px-3 py-2 dark:border-gray-700">
					<h2 className="font-bold text-sm">遷移履歴(⊢)</h2>
					<button
						type="button"
						className="rounded px-2 py-0.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
						onClick={() => setHistoryOpen(false)}
					>
						閉じる
					</button>
				</div>
				<div ref={histRef} className="flex-1 overflow-y-auto p-3">
					<TraceHistory frames={frames} cursor={cursor} />
				</div>
			</div>
		</main>
	);
}
