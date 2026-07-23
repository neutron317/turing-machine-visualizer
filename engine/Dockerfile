# 開発用イメージ: GHC 9.6 + cabal(Docker 公式 haskell イメージ)。
# ソースは compose のバインドマウントで渡すため、ここではツールチェーンと
# パッケージインデックスの用意だけ行う。
FROM haskell:9.6.6

# この cabal(3.12.1.0)は hackage-security の bootstrap で廃止済みミラー
# (objects-us-east-1.dream.io)を参照し `cabal update` が 404 で失敗する
# (特に amd64=CI 環境)。TUF bootstrap を使わず https で直接インデックスを
# 取得する設定を書いてから update する(転送は TLS で保護される)。
RUN mkdir -p /root/.config/cabal \
 && printf 'repository hackage.haskell.org\n  url: https://hackage.haskell.org/\n  secure: False\n' > /root/.config/cabal/config \
 && cabal update

WORKDIR /work/engine
