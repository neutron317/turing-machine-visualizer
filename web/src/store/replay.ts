import { create } from "zustand";
import type {
	DFAConfig,
	DFATrace,
	DTMConfig,
	DTMTrace,
	FiredDFA,
	FiredDTM,
	Status,
} from "../contract/schemas.ts";

export type Kind = "dfa" | "dtm";
export type Config = DFAConfig | DTMConfig;
export type Fired = FiredDFA | FiredDTM | null;

// 履歴の 1 コマ。config と、そのコマに至った時点の status / 発火した遷移。
export interface Frame {
	config: Config;
	status: Status;
	fired: Fired;
}

export interface ReplayState {
	kind: Kind | null;
	frames: Frame[];
	cursor: number;
	playing: boolean;
	speed: number; // 1 秒あたりのステップ数
	load: (trace: DFATrace | DTMTrace) => void;
	stepForward: () => void;
	stepBack: () => void;
	reset: () => void;
	play: () => void;
	pause: () => void;
	setSpeed: (speed: number) => void;
}

// ゴールデントレースを再生用のコマ列に変換する。
// 先頭は初期コンフィグ(status=running・fired=null)、以降は各ステップ応答。
function framesFromTrace(trace: DFATrace | DTMTrace): Frame[] {
	const initial: Frame = {
		config: trace.initial,
		status: "running",
		fired: null,
	};
	const rest: Frame[] = trace.steps.map((step) => ({
		config: step.config,
		status: step.status,
		fired: step.fired,
	}));
	return [initial, ...rest];
}

export const useReplayStore = create<ReplayState>()((set, get) => ({
	kind: null,
	frames: [],
	cursor: 0,
	playing: false,
	speed: 2,
	load: (trace) =>
		set({
			kind: trace.kind,
			frames: framesFromTrace(trace),
			cursor: 0,
			playing: false,
		}),
	stepForward: () => {
		const { cursor, frames } = get();
		if (cursor < frames.length - 1) {
			set({ cursor: cursor + 1 });
		} else {
			set({ playing: false }); // 終端では前進せず、自動再生を止める
		}
	},
	stepBack: () => {
		const { cursor } = get();
		if (cursor > 0) {
			set({ cursor: cursor - 1 });
		}
	},
	reset: () => set({ cursor: 0, playing: false }),
	play: () => {
		const { cursor, frames } = get();
		if (frames.length === 0) {
			return; // 未 load。再生状態に入らない。
		}
		// 終端から再生した場合は先頭へ戻す(でないと即停止してしまう)。
		set(
			cursor >= frames.length - 1
				? { cursor: 0, playing: true }
				: { playing: true },
		);
	},
	pause: () => set({ playing: false }),
	setSpeed: (speed) => set({ speed }),
}));

// セレクタ。
export const selectCurrentFrame = (s: ReplayState): Frame | null =>
	s.frames[s.cursor] ?? null;
export const selectCanStepForward = (s: ReplayState): boolean =>
	s.cursor < s.frames.length - 1;
export const selectCanStepBack = (s: ReplayState): boolean => s.cursor > 0;
