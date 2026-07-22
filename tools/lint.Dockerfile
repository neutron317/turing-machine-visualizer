# Haskell 用 lint/format ツール(hlint + ormolu)を最新版で用意する。
# arm64-linux の配布バイナリが無いため x86_64-linux 版を使い、
# linux/amd64 で emulation 実行する(ファイル解析用途なので十分速い)。
FROM debian:bookworm-slim

# findutils: lint/format タスクが `find` で .hs を列挙するため明示的に入れる。
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl findutils unzip \
 && rm -rf /var/lib/apt/lists/*

ARG HLINT_VERSION=3.10
ARG HLINT_SHA256=ccabc8802a58154699a3583b8dddc5ea2e6d65753a62c45c0e80088ebb16b42b
ARG ORMOLU_VERSION=0.8.1.1
ARG ORMOLU_SHA256=fde2caaf946c1d3507aebfbf848258c7fb19a0794c0b47ac549f83e556195cf2

# hlint(sha256 検証 → data ディレクトリごと配置 → PATH にシンボリックリンク)
RUN curl -fsSL "https://github.com/ndmitchell/hlint/releases/download/v${HLINT_VERSION}/hlint-${HLINT_VERSION}-x86_64-linux.tar.gz" -o /tmp/hlint.tar.gz \
 && echo "${HLINT_SHA256}  /tmp/hlint.tar.gz" | sha256sum -c - \
 && tar -xz -C /opt -f /tmp/hlint.tar.gz \
 && ln -s "/opt/hlint-${HLINT_VERSION}/hlint" /usr/local/bin/hlint \
 && rm /tmp/hlint.tar.gz

# ormolu(sha256 検証 → 単一バイナリ配置)
RUN curl -fsSL "https://github.com/tweag/ormolu/releases/download/${ORMOLU_VERSION}/ormolu-x86_64-linux.zip" -o /tmp/ormolu.zip \
 && echo "${ORMOLU_SHA256}  /tmp/ormolu.zip" | sha256sum -c - \
 && unzip -o /tmp/ormolu.zip -d /usr/local/bin \
 && chmod +x /usr/local/bin/ormolu \
 && rm /tmp/ormolu.zip

WORKDIR /work/engine
