#!/usr/bin/env bash
set -euo pipefail

# =========================
# Publica pacote npm de tipos no GitHub Container Registry
# =========================

REGISTRY="npm.pkg.github.com"
PACKAGE_NAME="@gsbenevides2/tp-link-center"

echo "==> Preparing types package for publish..."
echo "    Registry: ${REGISTRY}"
echo "    Package:  ${PACKAGE_NAME}"
echo "    Version:  ${VERSION}"

echo "==> Configuring npm auth for ${REGISTRY}..."
cat > .npmrc <<EOF
//${REGISTRY}/:_authToken=${TOKEN_GITHUB}
EOF

echo "==> Building types package..."
bun run tsc -p tsconfig.build.json

echo "==> Publishing package to ${REGISTRY}..."
npm publish

echo "==> Package ${PACKAGE_NAME}@${VERSION} published successfully to ${REGISTRY}"