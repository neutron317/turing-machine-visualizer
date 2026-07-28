import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/ / https://vitest.dev/config/
// dev サーバは相対 /api を Haskell バックエンド(既定 :3000)へプロキシする。
// これにより同一オリジン扱いになり CORS 不要。API_TARGET で差し替え可能。
const apiTarget = process.env.API_TARGET ?? "http://localhost:3000";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		proxy: {
			"/api": { target: apiTarget, changeOrigin: true },
		},
	},
	test: {
		environment: "jsdom",
		globals: false,
		setupFiles: ["./src/test/setup.ts"],
	},
});
