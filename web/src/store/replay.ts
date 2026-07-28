import { create } from "zustand";
import { StepError, stepDfa, stepDtm } from "../api/step.ts";
import type {
	DFAConfig,
	DFASpec,
	DTMConfig,
	DTMSpec,
	FiredDFA,
	FiredDTM,
	Status,
} from "../contract/schemas.ts";

export type Kind = "dfa" | "dtm";
export type Config = DFAConfig | DTMConfig;
export type Spec = DFASpec | DTMSpec;
export type Fired = FiredDFA | FiredDTM | null;

// 履歴の 1 コマ。config と、そのコマに至った時点の status / 発火した遷移。
export interface Frame {
	config: Config;
	status: Status;
	fired: Fired;
}

export interface ReplayState {
	kind: Kind | null;
	spec: Spec | null;
	frames: Frame[];
	cursor: number;
	playing: boolean;
	speed: number; // 1 秒あたりのステップ数
	loading: boolean; // /step リクエスト実行中
	error: string | null; // 直近の失敗(StepError など)
	startRun: (kind: Kind, spec: Spec, initial: Config) => void;
	stepForward: () => Promise<void>;
	stepBack: () => void;
	goto: (index: number) => void;
	reset: () => void;
	play: () => void;
	pause: () => void;
	setSpeed: (speed: number) => void;
}

// tip(履歴末尾)が terminal(accept/reject)なら、それ以上前進しない。
function tipIsTerminal(frames: Frame[]): boolean {
	const tip = frames[frames.length - 1];
	return tip != null && tip.status !== "running";
}

export const useReplayStore = create<ReplayState>()((set, get) => ({
	kind: null,
	spec: null,
	frames: [],
	cursor: 0,
	playing: false,
	speed: 2,
	loading: false,
	error: null,

	// spec と初期コンフィグから新しい実行を開始する。履歴は初期コマ 1 つ。
	startRun: (kind, spec, initial) =>
		set({
			kind,
			spec,
			frames: [{ config: initial, status: "running", fired: null }],
			cursor: 0,
			playing: false,
			loading: false,
			error: null,
		}),

	// 前進。履歴内なら cursor++(再計算しない)。tip かつ running なら /step を
	// 叩いて 1 コマ取得し push する。terminal なら何もしない。
	stepForward: async () => {
		const { cursor, frames, spec, kind, loading } = get();
		if (loading) {
			return; // 多重リクエストを避ける
		}
		// 履歴内の前進(同期)。
		if (cursor < frames.length - 1) {
			const next = cursor + 1;
			// 最終コマが terminal ならそこで自動再生を止める。
			const stop = next >= frames.length - 1 && tipIsTerminal(frames);
			set(stop ? { cursor: next, playing: false } : { cursor: next });
			return;
		}
		// tip での前進(非同期取得)。
		const tip = frames[cursor];
		if (tip?.status !== "running" || !spec) {
			set({ playing: false });
			return;
		}
		// この実行を識別するために frames 参照を捕捉する(取得中に機械が
		// 切り替わったら startRun が frames を差し替えるので破棄する)。
		const runFrames = frames;
		set({ loading: true, error: null });
		try {
			const result =
				kind === "dtm"
					? await stepDtm(spec as DTMSpec, tip.config as DTMConfig)
					: await stepDfa(spec as DFASpec, tip.config as DFAConfig);
			const s = get();
			if (s.frames !== runFrames) {
				return; // 実行が切り替わった。結果は破棄(loading は startRun 側で false)。
			}
			const nextIndex = s.frames.length; // 追加するコマの位置
			const stillAtTip = s.cursor === nextIndex - 1; // ユーザーがスクラブしていない
			set({
				frames: [
					...s.frames,
					{ config: result.config, status: result.status, fired: result.fired },
				],
				cursor: stillAtTip ? nextIndex : s.cursor,
				loading: false,
				// terminal に到達、またはスクラブ済みなら自動再生を止める。
				playing: stillAtTip && result.status === "running" ? s.playing : false,
			});
		} catch (e) {
			const s = get();
			if (s.frames !== runFrames) {
				return;
			}
			set({
				loading: false,
				playing: false,
				error: e instanceof StepError ? e.message : String(e),
			});
		}
	},

	stepBack: () => {
		const { cursor } = get();
		if (cursor > 0) {
			set({ cursor: cursor - 1, playing: false });
		}
	},

	// 任意のコマへジャンプ(履歴からの選択用)。範囲外はクランプ。自動再生は止める。
	goto: (index) => {
		const { frames } = get();
		if (frames.length === 0) {
			return;
		}
		const i = Math.min(Math.max(0, index), frames.length - 1);
		set({ cursor: i, playing: false });
	},

	reset: () => set({ cursor: 0, playing: false }),

	play: () => {
		const { frames, cursor } = get();
		if (frames.length === 0) {
			return; // 未開始。再生状態に入らない。
		}
		// tip かつ terminal から再生した場合は先頭へ戻す(でないと即停止する)。
		if (cursor >= frames.length - 1 && tipIsTerminal(frames)) {
			set({ cursor: 0, playing: true });
		} else {
			set({ playing: true });
		}
	},

	pause: () => set({ playing: false }),
	setSpeed: (speed) => set({ speed }),
}));

// セレクタ。
export const selectCurrentFrame = (s: ReplayState): Frame | null =>
	s.frames[s.cursor] ?? null;
// 前進可能: 履歴内、または tip かつ running(取得中は不可)。
export const selectCanStepForward = (s: ReplayState): boolean => {
	if (s.frames.length === 0) {
		return false;
	}
	if (s.cursor < s.frames.length - 1) {
		return true;
	}
	return !s.loading && (s.frames[s.cursor]?.status ?? "running") === "running";
};
export const selectCanStepBack = (s: ReplayState): boolean => s.cursor > 0;
