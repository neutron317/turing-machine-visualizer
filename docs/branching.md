# ブランチ運用・保守ガイド

このリポジトリのブランチモデルと、日々の開発・リリース・保守の手順をまとめる。

## ブランチモデル

| ブランチ | 役割 |
|---|---|
| **`main`** | リリース(公開)ブランチ。ここへの push で GitHub Pages へ自動デプロイされる。常に動く状態を保つ。 |
| **`dev`** | 開発の統合ブランチ。機能はまずここへ集約して試験運用する。`main` から分岐。 |
| **`feat/<name>`** | 機能単位の作業ブランチ。**`dev` から分岐**し、完成したら **`dev` へ PR** して取り込む。1 ブランチ 1 機能。 |

- 修正・雑務・ドキュメントも同様に `dev` から分岐する: `fix/<name>` / `chore/<name>` / `docs/<name>`。
- 例: `feat/replay-128hz`, `feat/example-collatz`, `fix/left-boundary`。

```
feat/<name> ──PR──▶ dev ──PR──▶ main ──push──▶ GitHub Pages(公開)
   (機能)          (統合・試験)   (リリース)
```

## 開発の流れ(feat → dev)

1. `git checkout dev && git pull`
2. `git checkout -b feat/<name>`
3. 実装し、ローカル検証(下記「ローカル検証」)を通す。
4. `git push -u origin feat/<name>`
5. **base を `dev` にして PR**: `gh pr create --base dev --head feat/<name>`
6. レビュー(別エージェントによる敵対的レビュー)で CONFIRMED の指摘に対応する。
7. CI が緑になったら **squash merge** で `dev` へ取り込み、ブランチを削除する。

## リリースの流れ(dev → main)

1. `dev` が安定したら **base を `main` にして PR**: `gh pr create --base main --head dev`
2. CI が緑になったら merge。
3. `main` への push で `.github/workflows/deploy-pages.yml` が `web/` をビルドし GitHub Pages へデプロイする。
   - **初回のみ**リポジトリの **Settings → Pages → Build and deployment → Source** を「**GitHub Actions**」に設定する(未設定だと deploy ジョブが失敗する)。

## ローカル検証(PR を出す前に必ず)

すべて Docker コンテナ + `make`(一覧は `make help`)。

- web を触ったら: `make web-typecheck` / `make web-test` / `make web-check`
- エンジン(参照実装)を触ったら: `make engine-test` / `make engine-lint` / `make engine-fmt-check`
- 本番ビルド確認: `make web-build`

## CI / デプロイ

- **`.github/workflows/ci.yml`**: すべての PR と `main` / `dev` への push で 8 ジョブ(engine の build/test/lint/format + web の build/typecheck/test/check)を実行する。
- **`.github/workflows/deploy-pages.yml`**: `main` への push(または手動 `workflow_dispatch`)で web をビルドして GitHub Pages へデプロイする。

## 規約

- インデントは**タブ**(YAML はスペック上タブ不可なのでスペース)。
- コミットメッセージ・PR・ドキュメントは**日本語**。
- コミットは小さく、1 PR = 1 つの関心事に保つ。

## 保守運用のメモ

- **サンプル機械を追加する**: `example/` に `.tmvdfa` / `.tmvdtm`(コンパクトなテキスト形式。詳細は [`example/README.md`](../example/README.md))を置き、`example/README.md` に説明を追記、`web/src/example.test.ts` の読込回帰テストに 1 行足す。
- **ステップ意味論を変える**: 実行はブラウザ内の [`web/src/engine/step.ts`](../web/src/engine/step.ts) が担う。変更したら [`fixtures/traces/`](../fixtures/) のゴールデントレース(Haskell 参照実装 `engine/` が基準)との一致を `web/src/engine/step.test.ts` で確認する。契約は [`docs/contract.md`](contract.md)。
- **参照実装(Haskell)**: `engine/` は submodule `engine/vendor/dtm-engine`(同じ作者の [`neutron317/D-Turing-Machine-made-by-haskell`](https://github.com/neutron317/D-Turing-Machine-made-by-haskell))に依存する。checkout 時は `git submodule update --init --recursive`。実行時アプリには不要(TS 移植済み)。
- **依存の更新**: web は `web/package.json`(pnpm)。コンテナ内で扱う([Containerized toolchain](architecture.md) 参照)。
- **設計の全体像**: [`docs/architecture.md`](architecture.md)。
