import { cleanup } from "@testing-library/react";
// Vitest の expect に @testing-library/jest-dom のマッチャ(toBeInTheDocument 等)を
// 追加し、型の拡張も読み込む。
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// globals:false では Testing Library の自動 cleanup(グローバル afterEach 依存)が
// 登録されないため、各テスト後に明示的にアンマウントして DOM の残留を防ぐ。
afterEach(() => {
	cleanup();
});
