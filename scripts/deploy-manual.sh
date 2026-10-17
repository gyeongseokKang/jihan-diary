#!/usr/bin/env bash
# 임시 수동 배포: 빌드 결과(dist)를 gh-pages 브랜치에 올립니다.
# GitHub Actions 자동 배포(.github/workflows/deploy.yml)가 켜지면 필요 없어요.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
touch dist/.nojekyll
rev=$(git rev-parse --short HEAD)
tmp=$(mktemp -d)
cp -r dist/. "$tmp"/
cd "$tmp"
git init -q -b gh-pages
git add -A
git -c user.name="jihan-diary deploy" -c user.email="deploy@users.noreply.github.com" commit -qm "deploy: $rev"
git push -f "$(cd - >/dev/null && git remote get-url origin)" gh-pages
rm -rf "$tmp"
echo "✓ gh-pages 배포 완료"
