# turing-machine-visualizer

DFA / DTM(決定性チューリング機械)が動く様子を眺めるための Web アプリ。

機械をブラウザで定義・編集し、入力を与えて 1 ステップずつ実行させ、状態遷移図(DFA)やテープ(DTM)のアニメーションで挙動を観察できる。判定ロジックは既存の Haskell 実装 [`neutron317/D-Turing-Machine-made-by-haskell`](https://github.com/neutron317/D-Turing-Machine-made-by-haskell) を活用する。

## 仕組み(概要)

- **サーバ(Haskell)はステートレスな「1 ステップ関数」**。現在のコンフィグを受け取り、1 ステップだけ進めて返す。
- **フロント(React)は「トレースの再生機」**。進めたコンフィグを履歴に貯め、前後スクラブ・速度変更・一時停止で眺める。無限に動く機械も追える。

詳細は [`docs/architecture.md`](docs/architecture.md)、両者が共有する JSON 仕様は [`docs/contract.md`](docs/contract.md) を参照。

## 技術スタック

| 分類 | 採用 |
|---|---|
| ツール管理 | mise |
| バックエンド | Haskell + Scotty + aeson |
| フロント | Vite + React + TypeScript / pnpm |
| 可視化 | React Flow(状態遷移図)/ SVG + motion(テープ) |
| その他 | Zustand・Zod・Tailwind CSS・Biome・Vitest |

## リポジトリ構成

```
docs/       設計ドキュメント(architecture / contract)
fixtures/   契約の実例(機械 spec・ゴールデントレース)
engine/     Haskell バックエンド(予定)
web/        フロントエンド(予定)
```

## 開発ステージ

小さく積んでレビューしやすくする(詳細は [`docs/architecture.md`](docs/architecture.md))。

- [x] 1. 契約 — JSON 仕様を docs + fixtures で確定
- [ ] 2. エンジン中核 — spec→遷移関数のアダプタ + 1 ステップ実行 + CLI
- [ ] 3. HTTP — Scotty で `/step` を公開
- [ ] 4. フロント骨組み — fixture を再生する UI
- [ ] 5. API 接続
- [ ] 6. 描画と編集 — DFA 状態遷移図 / DTM テープ / エディタ
