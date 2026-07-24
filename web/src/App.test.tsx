import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App.tsx";

describe("App", () => {
	it("見出しを表示する", () => {
		render(<App />);
		expect(
			screen.getByRole("heading", { name: "Turing Machine Visualizer" }),
		).toBeInTheDocument();
	});

	// 2 つ目も App を render する。テスト間で cleanup が効かないと DOM が残留し
	// getByText が複数マッチで失敗するため、cleanup 未登録の回帰を検出する。
	it("説明文を表示する", () => {
		render(<App />);
		expect(screen.getByText(/フロントエンドの骨組み/)).toBeInTheDocument();
	});
});
