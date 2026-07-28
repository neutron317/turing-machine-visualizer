import { useEffect } from "react";
import { ConfigView } from "./components/ConfigView.tsx";
import { anbncnTrace, evenATrace } from "./fixtures/traces.ts";
import {
	selectCanStepBack,
	selectCanStepForward,
	selectCurrentFrame,
	useReplayStore,
} from "./store/replay.ts";

const SPEEDS = [1, 2, 4, 8];

export default function App() {
	const frame = useReplayStore(selectCurrentFrame);
	const cursor = useReplayStore((s) => s.cursor);
	const frameCount = useReplayStore((s) => s.frames.length);
	const playing = useReplayStore((s) => s.playing);
	const speed = useReplayStore((s) => s.speed);
	const canForward = useReplayStore(selectCanStepForward);
	const canBack = useReplayStore(selectCanStepBack);
	const { load, stepForward, stepBack, reset, play, pause, setSpeed } =
		useReplayStore.getState();

	// 初回に既定のトレースを読み込む。
	useEffect(() => {
		if (useReplayStore.getState().frames.length === 0) {
			load(evenATrace);
		}
	}, [load]);

	// 自動再生: playing の間だけ speed に応じて前進する。終端で stepForward が
	// playing を false にするとクリーンアップで停止する。
	useEffect(() => {
		if (!playing) {
			return;
		}
		const id = setInterval(() => {
			useReplayStore.getState().stepForward();
		}, 1000 / speed);
		return () => clearInterval(id);
	}, [playing, speed]);

	return (
		<main className="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
			<div className="mx-auto max-w-2xl p-8">
				<h1 className="text-2xl font-bold">Turing Machine Visualizer</h1>
				<p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
					ゴールデントレースの再生(バックエンド未接続の骨組み)
				</p>

				<div className="mt-4 flex flex-wrap gap-2">
					<button
						type="button"
						className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
						onClick={() => load(evenATrace)}
					>
						DFA: 偶数個の a
					</button>
					<button
						type="button"
						className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
						onClick={() => load(anbncnTrace)}
					>
						DTM: aⁿbⁿcⁿ
					</button>
				</div>

				{frame ? (
					<>
						<div className="mt-4 flex flex-wrap items-center gap-2">
							<button
								type="button"
								className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40 dark:border-gray-600"
								onClick={reset}
							>
								↺ 最初へ
							</button>
							<button
								type="button"
								className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40 dark:border-gray-600"
								onClick={stepBack}
								disabled={!canBack}
							>
								◀ 戻る
							</button>
							<button
								type="button"
								className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40 dark:border-gray-600"
								onClick={playing ? pause : play}
							>
								{playing ? "⏸ 一時停止" : "▶ 再生"}
							</button>
							<button
								type="button"
								className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40 dark:border-gray-600"
								onClick={stepForward}
								disabled={!canForward}
							>
								進む ▶
							</button>
							<label className="ml-2 text-sm text-gray-600 dark:text-gray-400">
								速度
								<select
									className="ml-1 rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-600"
									value={speed}
									onChange={(e) => setSpeed(Number(e.target.value))}
								>
									{SPEEDS.map((s) => (
										<option key={s} value={s}>
											{s}x
										</option>
									))}
								</select>
							</label>
							<span className="ml-auto text-sm text-gray-500">
								{cursor + 1} / {frameCount}
							</span>
						</div>

						<ConfigView frame={frame} />
					</>
				) : (
					<p className="mt-4 text-gray-500">
						上のボタンで機械を読み込んでください。
					</p>
				)}
			</div>
		</main>
	);
}
