# アーキテクチャ

DFA / DTM(決定性チューリング機械)が動く様子を「眺める」ための Web アプリの設計。

## 全体像

実行ロジックは既存の Haskell 実装 [`neutron317/D-Turing-Machine-made-by-haskell`](https://github.com/neutron317/D-Turing-Machine-made-by-haskell) を活用する。UI は TypeScript + React + Vite。開発ツールはすべて Docker コンテナ内で完結させ、mise はタスクランナーとして使う。

```
[フロント React/Vite]                         [バックエンド Haskell/Scotty]
   機械を編集して spec を作る
   config ─────────── POST /api/{dfa,dtm}/step ──────────▶  transDFA / transDTM を1回だけ実行
   history[] に push                                        (アダプタで spec→遷移関数を組み立て)
   history[cursor] を描画   ◀──── {status, config, fired} ───
```

## 中心となる考え方

### 1. フロントは「トレースの再生機」に徹する

状態遷移図やテープの絵は、Haskell が返す各ステップのスナップショット(コンフィグ)を順に描くだけ。判定ロジックをフロント側に二重実装しない。**正しさは常に Haskell 側が持つ。**

### 2. サーバはステートレスな「1 ステップ関数」

サーバはセッションを持たない。**「現在のコンフィグを渡すと 1 ステップだけ進めて次のコンフィグを返す」**だけを行う。実行の状態(現在のコンフィグ)はクライアントが保持し、毎リクエストで渡す。

この設計の利点:

- **エンジン中核 = 既存の `transDFA` / `transDTM` そのもの**。1 ステップ関数を薄く HTTP に公開するだけ。
- **サーバに無限ループの危険がない**(1 リクエスト = 1 ステップ)。停止しない DTM でもサーバは固まらない。有界ランナーが不要。
- 逐次オンデマンドなので、**無限に動く機械も延々と眺められる**。

### 3. クライアントが履歴を持つ ⇒ 前後スクラブも可能

前進して得たコンフィグをクライアントの `history[]` に貯める。

- **前進**: `cursor` が履歴末尾なら `/step` を叩いて結果を push、途中なら `cursor++`。
- **後退**: `cursor--`(履歴内なら再計算不要)。

これにより「オンデマンドは前後しにくい」という弱点を解消し、**無限実行**と**見た所までの前後スクラブ**を両立する。自動再生には安全弁(最大ステップ数 or 手動停止)を置く。

## 各層の役割

| 層 | 責務 |
|---|---|
| エンジン中核 (Haskell) | `Spec`(機械定義の型 + JSON)、`Adapt`(spec → `Transfunc`/`DTMTransfunc` を `Data.Map` lookup で構築、既存 `transDFA`/`transDTM` を再利用)、`Step`(config → StepResult を 1 ステップ計算)。まず CLI で検証できるようにする。 |
| HTTP (Scotty) | 上記 `Step` を `/api/dfa/step`・`/api/dtm/step` として薄く公開。CORS 許可。 |
| フロント (React) | Zod で契約を検証。Zustand に `history / cursor / status / playing / speed`。描画コンポーネント(DFA 状態遷移図 / DTM テープ)は `history[cursor]` を描くだけ。編集エディタで spec を作成。 |

## 技術スタック

| 分類 | 採用 | 理由 |
|---|---|---|
| ツール管理 | mise | タスクランナー(実ツールは Docker コンテナ内で完結) |
| 実行環境 | Docker (compose) | GHC/cabal・lint/format をコンテナ内で実行し再現性を確保 |
| バックエンド | Haskell + Scotty + aeson | 小さな API に最適・依存が軽い |
| エンジン | 既存 DFA/DTM を git submodule で取り込み | 原作者の帰属を保持・更新容易 |
| フロント | Vite + React + TypeScript | 指定どおり |
| パッケージ管理 | pnpm | フロントの依存管理(コンテナ内) |
| 状態遷移図 | @xyflow/react (React Flow) | ノード編集 + アクティブ状態のハイライト |
| テープ描画 | 自作 SVG + motion | テープのシフトを滑らかにアニメーション |
| 再生状態管理 | Zustand | history / cursor / playing / speed を軽量に管理 |
| API 境界の型安全 | Zod | spec と応答を実行時バリデーション |
| スタイル | Tailwind CSS v4 | 素早くクリーンな UI |
| Lint/Format | Biome(JS/TS/JSON)・ormolu/hlint(Haskell) | Haskell は arm64-linux 配布が無く x86_64 を emulation |
| テスト | Vitest | フロントの単体テスト |

## リポジトリ構成(予定)

```
turing-machine-visualizer/
├── mise.toml            # タスク定義(実ツールは Docker)
├── docker-compose.yml   # engine(GHC/cabal)/ lint(hlint/ormolu)サービス
├── docs/                # 設計ドキュメント(本ファイルほか)
├── fixtures/            # 契約の実例(機械 spec・ゴールデントレース)
├── engine/              # Haskell バックエンド(cabal プロジェクト)
│   ├── src/Machine/     # Spec / Adapt / Step
│   ├── app/             # CLI + Scotty サーバ
│   └── vendor/          # 既存エンジン(git submodule)
└── web/                 # フロントエンド(Vite + React)
```

## 開発ステージ(レビュー単位)

小さく積んでレビューしやすくする。

1. **契約** — 機械 spec / ステップ実行の JSON 仕様を「ドキュメント + fixture」で確定 ← 現在地
2. **エンジン中核** — `Adapt` + `Step` + CLI。既存 Example と結果一致を確認
3. **HTTP** — Scotty で `/step` を公開
4. **フロント骨組み** — fixture を履歴に入れて再生機 + 操作 UI(バック不要でレビュー可)
5. **API 接続** — フロントを HTTP に繋ぐ
6. **描画と編集** — DFA 状態遷移図 / DTM テープ / 編集エディタを個別に

## 契約

機械 spec とステップ実行の JSON 仕様は [`contract.md`](./contract.md) を参照。
