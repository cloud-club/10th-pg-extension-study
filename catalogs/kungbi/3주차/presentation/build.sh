#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

MARP_VERSION='@marp-team/marp-cli@4'
SOURCE='slides.md'
HTML='mvcc-postgresql-innodb.html'
RENDER_DIR='.render'

run_marp() {
  npx -y "$MARP_VERSION" "$@"
}

build_html() {
  run_marp "$SOURCE" --html --template bespoke -o "$HTML"
  printf 'HTML: %s\n' "$HTML"
}

render_images() {
  rm -rf "$RENDER_DIR"
  mkdir -p "$RENDER_DIR"
  run_marp "$SOURCE" --html --images png --image-scale 1.5 \
    --allow-local-files -o "$RENDER_DIR/slide.png"
  printf 'PNG: %s/\n' "$RENDER_DIR"
}

case "${1:-html}" in
  html)
    build_html
    ;;
  images)
    render_images
    ;;
  all)
    build_html
    render_images
    ;;
  clean)
    rm -f "$HTML"
    rm -rf "$RENDER_DIR"
    ;;
  *)
    echo "usage: ./build.sh [html|images|all|clean]" >&2
    exit 2
    ;;
esac
