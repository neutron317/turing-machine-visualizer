# web

Turing Machine Visualizer のフロントエンド(Vite + React + TypeScript)。

開発ツールはすべて Docker コンテナ内で完結する(pnpm)。タスクはリポジトリ
ルートの `make`(一覧は `make help`)。

- `make web-install` — 依存をインストール
- `make web-dev` — 開発サーバ(http://localhost:5173)
- `make web-build` — 本番ビルド
- `make web-typecheck` — 型チェック(tsc -b)

Lint/format(Biome)・テスト(Vitest)・スタイル(Tailwind)は後続の小さな
PR で追加する。
