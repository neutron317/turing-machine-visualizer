import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/ / https://vitest.dev/config/
// 1 ステップ実行はブラウザ内で完結する(web/src/engine/step.ts に移植済み)ため、
// バックエンドも /api プロキシも不要。dev はこの静的アプリを配信するだけ。
export default defineConfig(({ mode }) => ({
	// 相対パスで出力する。これにより GitHub Pages のサブパス
	// (/turing-machine-visualizer/)でも、ローカルでビルド物を直接開いた場合でも
	// アセットが正しく解決される(サーバ不要で「どこでも動く」ため)。
	base: "./",
	plugins: [react(), tailwindcss()],
	server: {
		// テスト時のみ、リポジトリ直下 example/・fixtures/ を ?raw で読み込めるよう
		// 親ディレクトリを許可する(dev サーバの権限は広げない)。
		...(mode === "test" ? { fs: { allow: [".."] } } : {}),
	},
	test: {
		environment: "jsdom",
		globals: false,
		setupFiles: ["./src/test/setup.ts"],
	},
}));
