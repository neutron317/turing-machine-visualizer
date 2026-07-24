# タスクランナー(旧 mise.toml を置換)。実ツールはすべて Docker コンテナ内。
#   build/test  : engine サービス(公式 haskell イメージ / GHC / cabal, arm64 ネイティブ)
#   lint/format : lint サービス(hlint / ormolu。arm64-linux 配布が無いため
#                 x86_64 版を linux/amd64 で emulation 実行)
# 使い方: make <target>(例: make engine-build)。make help で一覧。

COMPOSE := docker compose

.PHONY: help engine-image engine-build engine-test engine-sh engine-serve engine-fmt engine-fmt-check engine-lint ci

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

engine-serve: ## HTTP サーバを起動(http://localhost:3000。PORT で変更可)
	$(COMPOSE) run --rm -p 3000:3000 engine cabal run -v0 engine-server

engine-fmt: ## Haskell ソースを ormolu で整形(コンテナ内)
	$(COMPOSE) run --rm lint sh -c 'ormolu --mode inplace $$(find src app test -name "*.hs")'

engine-fmt-check: ## 整形崩れがないか確認(コンテナ内)
	$(COMPOSE) run --rm lint sh -c 'ormolu --mode check $$(find src app test -name "*.hs")'

engine-lint: ## hlint で静的解析(コンテナ内)
	$(COMPOSE) run --rm lint hlint src app test

ci: engine-build engine-fmt-check engine-lint engine-test ## CI 相当の検証(イメージビルドは別途)
