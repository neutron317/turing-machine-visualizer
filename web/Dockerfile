# 開発用イメージ: Node 22 + pnpm(corepack)。engine と同じく依存をイメージ層に
# 焼き、ソースは compose のバインドマウントで渡す。node_modules は compose の
# 名前付きボリュームで保持し、バインドマウントに上書きされないようにする。
FROM node:22

# package.json の packageManager 指定に従って pnpm を有効化する。
RUN corepack enable

WORKDIR /work/web

# 依存だけを先に入れてイメージ層に焼く。package.json / pnpm-lock.yaml が
# 変わらない限りこの層は再利用され、CI(GHA レイヤキャッシュ)で高速。
# ソースは実行時にバインドマウントで渡すため、ここでは manifest だけを置く。
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
