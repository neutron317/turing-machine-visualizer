import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App.tsx";
import { useReplayStore } from "./store/replay.ts";

beforeEach(() => {
	// ストアはシングルトンなのでテスト間で初期状態へ戻す。
	useReplayStore.setState(useReplayStore.getInitialState(), true);
});

describe("App(再生 UI)", () => {
	it("初期表示は even-a を読み込み Even 状態と 1/4 を示す", () => {
		render(<App />);
		expect(
			screen.getByRole("heading", { name: "Turing Machine Visualizer" }),
		).toBeInTheDocument();
		expect(screen.getByText(/状態: Even/)).toBeInTheDocument();
		expect(screen.getByText("1 / 4")).toBeInTheDocument();
	});

	it("「進む」で次のコマ(Odd)に進む", () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: /進む/ }));
		expect(screen.getByText(/状態: Odd/)).toBeInTheDocument();
		expect(screen.getByText("2 / 4")).toBeInTheDocument();
	});

	it("先頭では「戻る」が無効", () => {
		render(<App />);
		expect(screen.getByRole("button", { name: /戻る/ })).toBeDisabled();
	});

	it("DTM を読み込むとテープを表示する", () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: /DTM/ }));
		expect(screen.getByText(/状態: P0/)).toBeInTheDocument();
		expect(screen.getByText(/ヘッド/)).toBeInTheDocument();
	});
});
