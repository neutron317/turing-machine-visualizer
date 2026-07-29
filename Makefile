# タスクランナー(旧 mise.toml を置換)。実ツールはすべて Docker コンテナ内。
#   build/test  : engine サービス(公式 haskell イメージ / GHC / cabal, arm64 ネイティブ)
#   lint/format : lint サービス(hlint / ormolu。arm64-linux 配布が無いため
#                 x86_64 版を linux/amd64 で emulation 実行)
#   web-*       : web サービス(Node 22 / pnpm。Vite + React + TypeScript)
# 使い方: make <target>(例: make engine-build)。make help で一覧。

COMPOSE := docker compose
PORT ?= 3000

.PHONY: help engine-image engine-build engine-test engine-sh engine-serve engine-fmt engine-fmt-check engine-lint web-image web-install web-dev web-build web-typecheck web-test web-check web-fix ci

help: ## タスク一覧を表示
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) \
		| sed -E 's/:.*## /\t/' | sort | column -t -s "$$(printf '\t')"

engine-image: ## Docker イメージをビルド(engine + lint)
	$(COMPOSE) build engine lint

engine-build: ## エンジンをビルド
	$(COMPOSE) run --rm engine cabal build all --enable-tests

engine-test: ## エンジンのテストを実行
	$(COMPOSE) run --rm engine cabal test all

engine-sh: ## engine コンテナでシェルを開く
	$(COMPOSE) run --rm engine bash

engine-serve: ## HTTP サーバを起動(既定 localhost:3000。PORT=8080 等で変更可)
	$(COMPOSE) run --rm -e PORT=$(PORT) -p $(PORT):$(PORT) engine cabal run -v0 engine-server

engine-fmt: ## Haskell ソースを ormolu で整形(コンテナ内)
	$(COMPOSE) run --rm lint sh -c 'ormolu --mode inplace $$(find src app test -name "*.hs")'

engine-fmt-check: ## 整形崩れがないか確認(コンテナ内)
	$(COMPOSE) run --rm lint sh -c 'ormolu --mode check $$(find src app test -name "*.hs")'

engine-lint: ## hlint で静的解析(コンテナ内)
	$(COMPOSE) run --rm lint hlint src app test

web-image: ## web の Docker イメージをビルド
	$(COMPOSE) build web

web-install: ## web の依存をインストール(node_modules ボリュームを更新)
	$(COMPOSE) run --rm web pnpm install

web-dev: ## web 開発サーバ(http://localhost:5173。1ステップ実行はブラウザ内で完結・サーバ不要)
	$(COMPOSE) run --rm -p 5173:5173 web pnpm dev --host

web-build: ## web を本番ビルド(tsc -b && vite build)
	$(COMPOSE) run --rm web pnpm build

web-typecheck: ## web の型チェック(tsc -b)
	$(COMPOSE) run --rm web pnpm typecheck

web-test: ## web の単体テスト(Vitest)
	$(COMPOSE) run --rm web pnpm test

web-check: ## web を Biome で検査(format + lint、CI 相当・書き込みなし)
	$(COMPOSE) run --rm web pnpm check

web-fix: ## web を Biome で整形・自動修正(書き込み)
	$(COMPOSE) run --rm web pnpm fix

ci: engine-build engine-fmt-check engine-lint engine-test web-build web-typecheck web-test web-check ## CI 相当の検証(イメージビルドは別途)
