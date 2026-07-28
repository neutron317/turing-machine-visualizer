import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { AutomatonDiagram } from "./components/AutomatonDiagram.tsx";
import { ConfigView } from "./components/ConfigView.tsx";
import { TraceHistory } from "./components/TraceHistory.tsx";
import { initialDfaConfig, initialDtmConfig } from "./contract/initial.ts";
import { type Machine, machines } from "./fixtures/machines.ts";
import {
	selectCanStepBack,
	selectCanStepForward,
	selectCurrentFrame,
	useReplayStore,
} from "./store/replay.ts";

const SPEEDS = [1, 2, 4, 8];
// 遷移履歴ドロワーの幅(px)。状態図の操作クラスタはこの分だけ左へ寄せる。
const HISTORY_W = 288;
const PANEL =
	"rounded-lg border border-gray-200 bg-white/90 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/90";
const CTRL =
	"rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700";

// 機械の初期コンフィグ(契約 §3)。モジュール定数なので参照が安定する。
function machineInitial(m: Machine) {
	return m.kind === "dfa"
		? initialDfaConfig(m.spec, m.input)
		: initialDtmConfig(m.spec, m.input);
}

export default function App() {
	const [selectedId, setSelectedId] = useState(machines[0].id);
	const machine = machines.find((m) => m.id === selectedId) ?? machines[0];
	// 実行する入力文字列(編集可)。機械を切り替えると既定入力に戻す。
	const [inputText, setInputText] = useState(machines[0].input);

	const frame = useReplayStore(selectCurrentFrame);
	const cursor = useReplayStore((s) => s.cursor);
	const frameCount = useReplayStore((s) => s.frames.length);
	const playing = useReplayStore((s) => s.playing);
	const speed = useReplayStore((s) => s.speed);
	const canForward = useReplayStore(selectCanStepForward);
	const canBack = useReplayStore(selectCanStepBack);
	const frames = useReplayStore((s) => s.frames);
	const error = useReplayStore((s) => s.error);
	const {
		startRun,
		stepForward,
		stepBack,
		goto,
		reset,
		play,
		pause,
		setSpeed,
	} = useReplayStore.getState();

	// 機械(spec + 入力)から実行を開始する。
	const startMachine = (m: Machine) => {
		startRun(m.kind, m.spec, machineInitial(m));
	};

	// 編集した入力文字列で現在の機械を実行する。
	const runInput = () => {
		const initial =
			machine.kind === "dfa"
				? initialDfaConfig(machine.spec, inputText)
				: initialDtmConfig(machine.spec, inputText);
		startRun(machine.kind, machine.spec, initial);
	};

	// 操作板の位置(ドラッグで移動可)。
	const [panelPos, setPanelPos] = useState({ x: 12, y: 12 });
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
		const w = 240;
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

	const [historyOpen, setHistoryOpen] = useState(false);

	// 下部帯(再生 + テープ)の高さを測る。状態図の操作クラスタをその上に置き、
	// 右ドロワー(履歴)の下端もこの高さで止めてテープの描画を優先する。
	const bottomRef = useRef<HTMLDivElement>(null);
	const [bottomInset, setBottomInset] = useState(0);
	const hasFrame = frame != null;
	useEffect(() => {
		const el = bottomRef.current;
		if (!hasFrame || !el || typeof ResizeObserver === "undefined") {
			return;
		}
		const ro = new ResizeObserver(() => setBottomInset(el.offsetHeight));
		ro.observe(el);
		setBottomInset(el.offsetHeight);
		return () => ro.disconnect();
	}, [hasFrame]);

	// 初回に既定の機械で実行を開始する(machines[0] と startRun は安定参照)。
	useEffect(() => {
		if (useReplayStore.getState().frames.length === 0) {
			startRun(machines[0].kind, machines[0].spec, machineInitial(machines[0]));
		}
	}, [startRun]);

	// 自動再生。各ステップ(ネットワーク取得を含む)の完了を待ってから次を予約する
	// ことで、遅い応答でもリクエストが積み重ならないようにする。
	useEffect(() => {
		if (!playing) {
			return;
		}
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout>;
		const tick = async () => {
			await useReplayStore.getState().stepForward();
			if (cancelled) {
				return;
			}
			if (useReplayStore.getState().playing) {
				timer = setTimeout(tick, 1000 / speed);
			}
		};
		timer = setTimeout(tick, 1000 / speed);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [playing, speed]);

	const selectMachine = (m: Machine) => {
		setSelectedId(m.id);
		setInputText(m.input);
		startMachine(m);
	};

	const currentState = frame?.config.state ?? machine.spec.start;

	return (
		<main className="relative h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
			{/* 状態図(全面)。操作クラスタ(縦ズーム + 履歴トグル)は右下・帯の上。
			    履歴を出すとドロワー幅ぶん左へ寄る(rightInset)。 */}
			<div className="absolute inset-0">
				{frame && (
					<AutomatonDiagram
						key={machine.id}
						spec={machine.spec}
						current={currentState}
						fired={frame.fired}
						bottomInset={bottomInset}
						rightInset={historyOpen ? HISTORY_W : 0}
						historyOpen={historyOpen}
						onToggleHistory={() => setHistoryOpen((o) => !o)}
					/>
				)}
			</div>

			{/* 操作板(機械選択・ドラッグで移動可) */}
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
					<label htmlFor="input-str" className="mt-2 text-gray-500 text-xs">
						入力(記号を並べる)
					</label>
					<div className="flex gap-1">
						<input
							id="input-str"
							type="text"
							value={inputText}
							onChange={(e) => setInputText(e.target.value)}
							onKeyDown={(e) => {
								// IME 変換確定の Enter で誤って実行しない。
								if (e.nativeEvent.isComposing) {
									return;
								}
								if (e.key === "Enter") {
									runInput();
								}
							}}
							className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 font-mono text-sm dark:border-gray-600 dark:bg-gray-700"
						/>
						<button type="button" className={CTRL} onClick={runInput}>
							実行
						</button>
					</div>
				</div>
			</div>

			{/* 下部: 再生コントロール + テープ + (履歴) */}
			{frame && (
				<div
					ref={bottomRef}
					className="absolute inset-x-0 bottom-0 z-20 border-gray-200 border-t bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-800/90"
				>
					<div className="flex flex-col">
						{error && (
							<div className="border-red-300 border-b bg-red-50 px-3 py-1.5 text-red-700 text-sm dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
								{error}
							</div>
						)}
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

			{/* 遷移履歴(右ドロワー)。下端はテープ帯の上で止め(bottomInset)、z を
			    下部帯より下(z-10)にしてテープの描画を優先する。 */}
			{frame && historyOpen && (
				<section
					className="absolute top-0 right-0 z-10 flex flex-col border-gray-200 border-l bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-800/90"
					style={{ width: HISTORY_W, bottom: bottomInset }}
					aria-labelledby="history-heading"
				>
					<h2
						id="history-heading"
						className="border-gray-200 border-b px-3 py-2 font-medium text-gray-600 text-xs dark:border-gray-700 dark:text-gray-300"
					>
						遷移履歴(⊢。行をクリックでその状態へ)
					</h2>
					<div className="flex-1 overflow-y-auto px-3 py-2">
						<TraceHistory frames={frames} current={cursor} onSelect={goto} />
					</div>
				</section>
			)}
		</main>
	);
}
