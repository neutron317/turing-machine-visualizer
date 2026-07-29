# turing-machine-visualizer

DFA / 決定性チューリング機械(DTM)が動く様子を、**状態遷移図**と**テープ**のアニメーション
で眺める Web アプリ。機械をブラウザで定義・編集し、入力を与えて 1 ステップずつ、あるいは
連続再生して挙動を観察できる。**ブラウザだけで完結し、サーバは不要**(公開版でもローカルでも同じ)。

🔗 **公開版**: https://neutron317.github.io/turing-machine-visualizer/

## 使い方

- **機械を選ぶ / 作る**: 左のリストから選択。「新規作成」で DFA / DTM を追加でき、複数を保持・
  切り替え・削除できる。
- **定義を編集**: 状態・遷移表を直接編集。状態遷移図を**クリックで状態追加・ドラッグで遷移追加**
  もできる。使える記号(アルファベット / テープ記号)は遷移から自動導出される。
- **実行して眺める**: 入力語を入れて「1 ステップ」または「再生(▶)」。速度は **Hz**(1〜64)で
  調整でき、前後にスクラブ・一時停止できる。停止しない機械もそのまま追える。
- **保存 / 読込**: 機械を軽量テキスト(`.tmvdfa` / `.tmvdtm`)で保存し、あとから読み込める。

## 収録している例(`example/`)

ダウンロードして「読込」から開ける。詳細は [`example/README.md`](example/README.md)。

| ファイル | 種別 | テーマ |
|---|---|---|
| `dfa-divisible-by-3.tmvdfa` | DFA | 正則言語(2進で 3 の倍数) |
| `dfa-even-a-tri-b.tmvdfa` | DFA | 複雑な DFA(積構成・6 状態) |
| `dtm-palindrome.tmvdtm` | DTM | 非正則言語(回文) |
| `dtm-subset-sum.tmvdtm` | DTM | **NP 完全**を総当たり(指数時間) |
| `dtm-binary-adder.tmvdtm` | DTM | **論理回路**(リップルキャリー加算器) |
| `dtm-collatz.tmvdtm` | DTM | **半決定性**(コラッツ、停止性は未解決) |
| `accdfa.tmvdtm` | DTM | 万能(任意の DFA を実行する) |

## ローカルで動かす

サーバ不要。いずれの方法でも同じアプリが動く。

- **公開版をブラウザで開く**(上記 URL)。
- **開発サーバ**: `make web-dev` → http://localhost:5173
- **ビルドして配信 / 直接開く**: `make web-build` → 生成された `web/dist/` を任意の静的サーバ
  (`npx serve web/dist` 等)で配信、または `web/dist/index.html` をブラウザで直接開く。

## 仕組み

- **1 ステップ実行**(DFA / DTM の遷移意味論・テープ機構)は [`web/src/engine/step.ts`](web/src/engine/step.ts)
  に実装され、ブラウザ内で完結する。フロント(React)はその結果を履歴に貯めて再生する。
- **Haskell 実装**([`engine/`](engine/))は「1 ステップ関数」の**参照実装**として維持している。
  契約のゴールデントレース([`fixtures/traces/`](fixtures/traces/))で TypeScript 移植が同じ列を
  出すことを検証しており(`web/src/engine/step.test.ts`)、実行時には不要。
- 設計は [`docs/architecture.md`](docs/architecture.md)、共有 JSON 仕様は [`docs/contract.md`](docs/contract.md)。

## 技術スタック

| 分類 | 採用 |
|---|---|
| フロント | Vite + React + TypeScript / pnpm |
| 可視化 | React Flow(状態遷移図)/ SVG + motion(テープ) |
| 状態・検証・整形 | Zustand・Zod・Tailwind CSS・Biome・Vitest |
| 参照実装(任意) | Haskell + Scotty + aeson |
| タスク・実行環境 | Make + Docker (compose) |

## 開発

すべて Docker コンテナ内で完結する(タスクは `make`。一覧は `make help`)。

- `make web-dev` — 開発サーバ(http://localhost:5173)
- `make web-typecheck` / `make web-test` / `make web-check` — 型・テスト・整形/lint
- `make web-build` — 本番ビルド(`web/dist/`)
- `make engine-test` — 参照実装(Haskell)のテスト(ゴールデントレース再現含む)

## 公開(GitHub Pages)

`main` への push で [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) が
`web/` をビルドして GitHub Pages へ自動デプロイする。**初回のみ**リポジトリの
**Settings → Pages → Build and deployment → Source** を「**GitHub Actions**」に設定する
(未設定だとデプロイジョブが失敗する)。以降は push で自動更新される。
