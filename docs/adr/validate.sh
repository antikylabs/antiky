#!/bin/sh

set -eu

usage() {
  echo "Usage: $0 ADR_FILE_OR_DIRECTORY" >&2
  exit 64
}

[ "$#" -eq 1 ] || usage

target=$1

if [ ! -e "$target" ]; then
  echo "ADR path not found: $target" >&2
  exit 66
fi

if [ -d "$target" ]; then
  references=$(rg -n \
    --glob '*_H.md' \
    --glob '!README.md' \
    '(objectives/|\]\([^)]*(goal|plan)\.md([)#][^)]*)?\))' \
    "$target" || true)
else
  references=$(rg -n \
    '(objectives/|\]\([^)]*(goal|plan)\.md([)#][^)]*)?\))' \
    "$target" || true)
fi

if [ -n "$references" ]; then
  echo "ADRs must not reference objective or planning documents:" >&2
  printf '%s\n' "$references" >&2
  exit 1
fi

echo "PASS: ADR references are self-contained"
