# 開発用イメージ: GHC 9.6 + cabal(Docker 公式 haskell イメージ)。
# ソースは compose のバインドマウントで渡すため、ここではツールチェーンと
# パッケージインデックスの用意だけ行う。
FROM haskell:9.6.6

# この cabal(3.12.1.0)は hackage-security(TUF)の bootstrap で廃止済みミラー
# (objects-us-east-1.dream.io)を参照するため、amd64(CI)で `cabal update` が
# 404 で失敗する。回避策として hackage-security を無効化(secure: False)し、
# https で hackage.haskell.org から直接インデックス/パッケージを取得する。
#
# トレードオフ: secure: False は後続の cabal build/test を含め TUF による
# 整合性(署名)検証を無効にする。残る保護は https 転送路の TLS のみで、
# パッケージ単位の署名検証は失われる。`cabal update` だけに限定しても
# build/test 側で同じ bootstrap 404 が再発するため、設定はイメージ全体に適用する。
# 取得元が hackage.haskell.org の https 固定である開発/CI 用ツールチェーンとして
# 許容する。将来 cabal がミラー問題を解消したら secure に戻す。
RUN mkdir -p /root/.config/cabal \
 && printf 'repository hackage.haskell.org\n  url: https://hackage.haskell.org/\n  secure: False\n' > /root/.config/cabal/config \
 && cabal update

WORKDIR /work/engine

# 依存だけを先にビルドしてイメージ層に焼く。.cabal が変わらない限りこの層は
# 再利用され、CI(GitHub Actions のレイヤキャッシュ)で依存の再コンパイルを回避できる。
# ソースは実行時にバインドマウントで渡すため、ここでは .cabal だけを置く。
COPY turing-visualizer.cabal ./
RUN cabal build --only-dependencies --enable-tests all
