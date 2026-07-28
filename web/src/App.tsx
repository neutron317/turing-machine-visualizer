import { useEffect, useState } from "react";
import { AutomatonDiagram } from "./components/AutomatonDiagram.tsx";
import { ConfigView } from "./components/ConfigView.tsx";
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
	const { load, stepForward, stepBack, reset, play, pause, setSpeed } =
		useReplayStore.getState();

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

			{/* 操作板(左上) */}
			<div className={`absolute top-3 left-3 z-20 w-64 p-3 ${PANEL}`}>
				<h1 className="font-bold text-sm">Turing Machine Visualizer</h1>
				<div className="mt-2 flex flex-col gap-1">
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
				</div>
				<div className="mt-3 flex flex-wrap items-center gap-1">
					<button
						type="button"
						aria-label="最初へ"
						className={CTRL}
						onClick={reset}
					>
						↺
					</button>
					<button
						type="button"
						aria-label="戻る"
						className={CTRL}
						onClick={stepBack}
						disabled={!canBack}
					>
						◀
					</button>
					<button
						type="button"
						aria-label={playing ? "一時停止" : "再生"}
						className={CTRL}
						onClick={playing ? pause : play}
					>
						{playing ? "⏸" : "▶"}
					</button>
					<button
						type="button"
						aria-label="進む"
						className={CTRL}
						onClick={stepForward}
						disabled={!canForward}
					>
						⏭
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
			</div>

			{/* テープ/状態(下部中央) */}
			{frame && (
				<div
					className={`absolute bottom-3 left-1/2 z-20 max-w-[90vw] -translate-x-1/2 overflow-x-auto p-3 ${PANEL}`}
				>
					<ConfigView frame={frame} />
				</div>
			)}
		</main>
	);
}
