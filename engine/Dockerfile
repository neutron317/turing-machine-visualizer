# 開発用イメージ: GHC 9.6 + cabal(Docker 公式 haskell イメージ)。
# ソースは compose のバインドマウントで渡すため、ここではツールチェーンと
# パッケージインデックスの用意だけ行う。
FROM haskell:9.6.6

# 依存解決に必要な Hackage インデックスを取得
# (名前付きボリューム初回作成時にイメージ内容が引き継がれる)。
RUN cabal update

WORKDIR /work/engine
