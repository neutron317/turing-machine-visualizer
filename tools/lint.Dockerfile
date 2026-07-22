# Haskell 用 lint/format ツール(hlint + ormolu)を最新版で用意する。
# arm64-linux の配布バイナリが無いため x86_64-linux 版を使い、
# linux/amd64 で emulation 実行する(ファイル解析用途なので十分速い)。
FROM debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl unzip \
 && rm -rf /var/lib/apt/lists/*

ARG HLINT_VERSION=3.10
ARG ORMOLU_VERSION=0.8.1.1

# hlint(ヒント用 data ディレクトリごと配置し、シンボリックリンクで PATH に通す)
RUN curl -fsSL "https://github.com/ndmitchell/hlint/releases/download/v${HLINT_VERSION}/hlint-${HLINT_VERSION}-x86_64-linux.tar.gz" \
      | tar -xz -C /opt \
 && ln -s "/opt/hlint-${HLINT_VERSION}/hlint" /usr/local/bin/hlint

# ormolu(単一バイナリ)
RUN curl -fsSL "https://github.com/tweag/ormolu/releases/download/${ORMOLU_VERSION}/ormolu-x86_64-linux.zip" -o /tmp/ormolu.zip \
 && unzip -o /tmp/ormolu.zip -d /usr/local/bin \
 && chmod +x /usr/local/bin/ormolu \
 && rm /tmp/ormolu.zip

WORKDIR /work/engine
