// Vitest の expect に @testing-library/jest-dom のマッチャ(toBeInTheDocument 等)を
// 追加し、型の拡張も読み込む。vite.config.ts の test.setupFiles で読み込まれる。
import "@testing-library/jest-dom/vitest";
