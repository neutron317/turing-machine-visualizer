import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.tsx";
import { useReplayStore } from "./store/replay.ts";

// api/step をモックし、機械ごとに最初の 1 ステップを返す(ネットワーク不要)。
vi.mock("./api/step.ts", () => ({
	StepError: class StepError extends Error {},
	// biome-ignore lint/suspicious/noExplicitAny: テスト用の緩いダミー
	stepDfa: vi.fn(async (_spec: any, config: any) => {
		if (config.state === "Even" && config.rest.length === 2) {
			return {
				status: "running",
				config: { state: "Odd", rest: ["a"] },
				fired: { from: "Even", read: "a", to: "Odd" },
			};
		}
		return { status: "accept", config, fired: null };
	}),
	// biome-ignore lint/suspicious/noExplicitAny: テスト用の緩いダミー
	stepDtm: vi.fn(async (_spec: any, config: any) => {
		if (config.state === "P0" && config.head === "a") {
			return {
				status: "running",
				config: { state: "P1", left: ["X"], head: "b", right: ["c"] },
				fired: { from: "P0", read: "a", to: "P1", write: "X", move: "R" },
			};
		}
		return { status: "reject", config, fired: null };
	}),
}));

beforeEach(() => {
	// ストアはシングルトンなのでテスト間で初期状態へ戻す。
	useReplayStore.setState(useReplayStore.getInitialState(), true);
});

describe("App(再生 UI)", () => {
	it("初期表示は even-a を開始し Even 状態と 1/1 を示す", () => {
		render(<App />);
		expect(
			screen.getByRole("heading", { name: "Turing Machine Visualizer" }),
		).toBeInTheDocument();
		expect(screen.getByText(/状態: Even/)).toBeInTheDocument();
		expect(screen.getByText("1 / 1")).toBeInTheDocument();
	});

	it("「進む」で /step を取得し次のコマ(Odd)へ進む", async () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: /進む/ }));
		expect(await screen.findByText(/状態: Odd/)).toBeInTheDocument();
		expect(await screen.findByText("2 / 2")).toBeInTheDocument();
	});

	it("先頭では「戻る」が無効", () => {
		render(<App />);
		expect(screen.getByRole("button", { name: /戻る/ })).toBeDisabled();
	});

	it("DTM を選ぶとテープを表示する", () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: /DTM/ }));
		expect(screen.getByText(/状態: P0/)).toBeInTheDocument();
		expect(screen.getByText(/ヘッド/)).toBeInTheDocument();
	});

	it("入力を編集して「実行」すると新しい入力で開始する", () => {
		render(<App />);
		const input = screen.getByLabelText(/入力/) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "aaa" } });
		fireEvent.click(screen.getByRole("button", { name: "実行" }));
		// 初期コンフィグの残り入力が 3 文字(aaa)になる → 位置は 1/1。
		expect(screen.getByText("1 / 1")).toBeInTheDocument();
		expect(useReplayStore.getState().frames[0]?.config).toEqual({
			state: "Even",
			rest: ["a", "a", "a"],
		});
	});

	it("機械を切り替えると入力欄が既定入力へ戻る", () => {
		render(<App />);
		const input = () => screen.getByLabelText(/入力/) as HTMLInputElement;
		fireEvent.change(input(), { target: { value: "aaa" } });
		fireEvent.click(screen.getByRole("button", { name: /DTM/ }));
		expect(input().value).toBe("abc"); // DTM の既定入力
	});

	it("左パネルに遷移関数エディタを表示する", () => {
		render(<App />);
		// aria-labelledby と h2#editor-heading の結び付き(名前付き region)も検証。
		expect(
			screen.getByRole("region", { name: /遷移関数/ }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /遷移関数/ }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "この定義で実行" }),
		).toBeInTheDocument();
	});

	it("入力欄の id は重複しない(移設で二重にしていない)", () => {
		const { container } = render(<App />);
		expect(container.querySelectorAll("#input-str")).toHaveLength(1);
	});

	it("入力を変えて再生すると新しい入力で実行し直す", () => {
		render(<App />);
		const input = screen.getByLabelText(/入力/) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "aaa" } });
		fireEvent.click(screen.getByRole("button", { name: "再生" }));
		// 再生時に入力変更を検知し、初期テープを "aaa" で作り直す。
		expect(useReplayStore.getState().frames[0]?.config).toEqual({
			state: "Even",
			rest: ["a", "a", "a"],
		});
		// 後片付け: 自動再生を止める。
		useReplayStore.getState().pause();
	});

	it("入力を変えずに再生すると現在位置から継続する(作り直さない)", async () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: /進む/ }));
		expect(await screen.findByText("2 / 2")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "再生" }));
		// 入力未変更 → フレームを作り直さず位置(2/2)を保つ(1/1 に戻らない)。
		expect(screen.getByText("2 / 2")).toBeInTheDocument();
		expect(useReplayStore.getState().frames.length).toBe(2);
		// 後片付け: 自動再生を止める。
		useReplayStore.getState().pause();
	});

	it("ウィンドウを縮小すると操作板が画面内へクランプされる", () => {
		render(<App />);
		const heading = screen.getByRole("heading", {
			name: "Turing Machine Visualizer",
		});
		// 操作板 = 見出しを含む外側の絶対配置 div。
		const panel = heading.closest("div.absolute") as HTMLElement;
		// 幅を PANEL_W(240)より狭くして resize → left は innerWidth-240 へ寄る。
		window.innerWidth = 300;
		fireEvent(window, new Event("resize"));
		expect(panel.style.left).toBe("60px"); // 300 - 240
		// 後片付け: jsdom 既定幅へ戻す。
		window.innerWidth = 1024;
	});

	it("機械を切り替えると状態図と現在状態が切り替わる", async () => {
		const { container } = render(<App />);
		const activeState = () =>
			container
				.querySelector('[data-active="true"]')
				?.getAttribute("data-state");
		// 初期は DFA の Even が active。
		expect(activeState()).toBe("Even");
		// DTM に切替 → P0 が active。
		fireEvent.click(screen.getByRole("button", { name: /DTM/ }));
		expect(activeState()).toBe("P0");
		// 進むと状態図の現在状態が追従(P0 -> P1、取得は非同期)。
		fireEvent.click(screen.getByRole("button", { name: /進む/ }));
		await waitFor(() => expect(activeState()).toBe("P1"));
	});
});
