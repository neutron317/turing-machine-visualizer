import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { AutomatonDiagram } from "./components/AutomatonDiagram.tsx";
import { ConfigView } from "./components/ConfigView.tsx";
import { SpecEditor } from "./components/SpecEditor.tsx";
import { SymbolPalette } from "./components/SymbolPalette.tsx";
import { TraceHistory } from "./components/TraceHistory.tsx";
import { initialDfaConfig, initialDtmConfig } from "./contract/initial.ts";
import type { DFASpec, DTMSpec } from "./contract/schemas.ts";
import { type Machine, machines } from "./fixtures/machines.ts";
import {
	type Spec,
	selectCanStepBack,
	selectCanStepForward,
	selectCurrentFrame,
	useReplayStore,
} from "./store/replay.ts";

const SPEEDS = [1, 2, 4, 8];
// 遷移履歴ドロワーの幅(px)。状態図の操作クラスタはこの分だけ左へ寄せる。
const HISTORY_W = 288;
// 左固定パネル(遷移関数エディタ)の幅(px)。
const EDITOR_W = 288;
const PANEL =
	"rounded-lg border border-gray-200 bg-white/90 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/90";
const CTRL =
	"rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700";
// 移動可能な操作板の幅(px。w-60 と一致)。ドラッグ/初期位置のクランプに使う。
const PANEL_W = 240;
// 左右のサイドパネル(遷移関数エディタ / 遷移履歴)の共通外殻。side ごとに
// `left-0 border-r` / `right-0 border-l` を付け足す。
const SIDE_PANEL =
	"absolute top-0 z-10 flex flex-col border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-800/90";
// サイドパネルの見出し行の共通スタイル。
const PANEL_HEADING =
	"border-gray-200 border-b px-3 py-2 font-medium text-gray-600 text-xs dark:border-gray-700 dark:text-gray-300";

// 操作板の位置をビューポート内へクランプする(画面外に落として掴めなくなるのを防ぐ)。
function clampPanel(x: number, y: number) {
	return {
		x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - PANEL_W)),
		y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - 40)),
	};
}

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
	// 実行中の spec(編集して実行したものを状態図に反映するため)。
	const runningSpec = useReplayStore((s) => s.spec);
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

	// 現在の実行が使っている入力文字列。再生時に入力が変わっていれば実行し直す。
	const runInputRef = useRef(machines[0].input);

	// 機械(spec + 入力)から実行を開始する。
	const startMachine = (m: Machine) => {
		startRun(m.kind, m.spec, machineInitial(m));
		runInputRef.current = m.input;
	};

	// 指定の spec を現在の入力で実行する(入力欄・遷移関数エディタの両方から使う)。
	const runSpec = (spec: Spec) => {
		const initial =
			machine.kind === "dfa"
				? initialDfaConfig(spec as DFASpec, inputText)
				: initialDtmConfig(spec as DTMSpec, inputText);
		startRun(machine.kind, spec, initial);
		runInputRef.current = inputText;
	};
	// 編集した入力文字列で現在の機械(プリセット spec)を実行する。
	const runInput = () => runSpec(machine.spec);
	// 再生/一時停止。入力が変わっていれば、現在の定義で新しい入力から実行し直す。
	const onPlayPause = () => {
		if (playing) {
			pause();
			return;
		}
		if (runInputRef.current !== inputText) {
			runSpec(runningSpec ?? machine.spec);
		}
		play();
	};

	// 操作板の位置(ドラッグで移動可)。既定は左固定エディタと右上の操作クラスタを
	// 避け、エディタ右端〜画面右端の中央へ置く(狭い画面では clampPanel が内へ寄せる)。
	const [panelPos, setPanelPos] = useState(() =>
		clampPanel((EDITOR_W + window.innerWidth - PANEL_W) / 2, 12),
	);
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
		setPanelPos(
			clampPanel(
				e.clientX - panelDrag.current.dx,
				e.clientY - panelDrag.current.dy,
			),
		);
	};
	const onPanelUp = () => {
		panelDrag.current = null;
	};
	// ウィンドウ縮小で操作板が画面外に出たら、掴める位置へ戻す。
	useEffect(() => {
		const onResize = () => setPanelPos((p) => clampPanel(p.x, p.y));
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

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
	// 入力(テープ)に使える記号: DFA は alphabet、DTM は tapeAlphabet(契約 §1)。
	const usableSymbols =
		machine.kind === "dfa" ? machine.spec.alphabet : machine.spec.tapeAlphabet;

	return (
		<main className="relative h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
			{/* 状態図(全面)。操作クラスタ(縦ズーム + 履歴トグル)は右上。
			    履歴を出すとドロワー幅ぶん左へ寄る(rightInset)。 */}
			<div className="absolute inset-0">
				{frame && (
					<AutomatonDiagram
						key={machine.id}
						spec={runningSpec ?? machine.spec}
						current={currentState}
						fired={frame.fired}
						rightInset={historyOpen ? HISTORY_W : 0}
						historyOpen={historyOpen}
						onToggleHistory={() => setHistoryOpen((o) => !o)}
					/>
				)}
			</div>

			{/* 操作板(機械選択・ドラッグで移動可) */}
			<div
				className={`absolute z-20 ${PANEL}`}
				style={{ left: panelPos.x, top: panelPos.y, width: PANEL_W }}
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
				</div>
			</div>

			{/* 左固定パネル: 遷移関数エディタ。テープ帯の上端で止め(bottomInset)、
			    中身は上下スクロール。テープの描画を隠さないよう z を下部帯より下に。 */}
			{frame && (
				<section
					className={`${SIDE_PANEL} left-0 border-r`}
					style={{ width: EDITOR_W, bottom: bottomInset }}
					aria-labelledby="editor-heading"
				>
					<h2 id="editor-heading" className={PANEL_HEADING}>
						遷移関数(編集して実行)
					</h2>
					<div className="flex-1 overflow-y-auto px-3 py-2">
						<SpecEditor key={machine.id} machine={machine} onRun={runSpec} />
					</div>
				</section>
			)}

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
							<button type="button" className={CTRL} onClick={onPlayPause}>
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
						{/* 入力(テープの内容)。ここで書いた記号列が初期テープになる。 */}
						<div className="flex items-center gap-2 px-3 pt-2">
							<label htmlFor="input-str" className="text-gray-500 text-xs">
								入力(テープ)
							</label>
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
						{/* 使える記号の一覧(クリックで入力へ追記)。 */}
						<div className="px-3 pt-1">
							<SymbolPalette
								symbols={usableSymbols}
								onPick={(s) => setInputText((t) => t + s)}
							/>
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
					className={`${SIDE_PANEL} right-0 border-l`}
					style={{ width: HISTORY_W, bottom: bottomInset }}
					aria-labelledby="history-heading"
				>
					<h2 id="history-heading" className={PANEL_HEADING}>
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
