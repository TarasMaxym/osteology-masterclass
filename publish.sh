#!/usr/bin/env zsh
set -e
cd "$(dirname "$0")"

echo "1/3 Validating & rebuilding dataset..."
python3 ./build_dataset.py

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init -b main
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin git@github.com:TarasMaxym/osteology-masterclass.git
fi

echo "2/3 Staging & committing latest local changes..."
git add -A
if git diff --cached --quiet; then
  echo "    No new file changes to commit."
else
  MSG="${1:-Update Osteology Masterclass}"
  git commit -m "${MSG}"
fi

echo "3/3 Pushing update to live hosted repository..."
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")
git push -u origin "${BRANCH}"
echo "Done! Your hosted GitHub Pages site will refresh within ~20-30 seconds."
