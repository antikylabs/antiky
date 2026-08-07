#!/bin/sh

set -eu

script_dir=$(CDPATH='' cd "$(dirname "$0")" && pwd)
tag_hash="$script_dir/tag-hash.sh"
validate="$script_dir/validate.sh"
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/antiky-tag-hash.XXXXXX")
adr_file="$test_dir/test-adr.md"
bad_adr_file="$test_dir/bad-adr_H.md"

cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  if [ -f "$adr_file" ]; then
    rm "$adr_file"
  fi
  if [ -f "$bad_adr_file" ]; then
    rm "$bad_adr_file"
  fi
  if [ -d "$test_dir" ]; then
    rmdir "$test_dir"
  fi
  exit "$status"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

trap cleanup EXIT HUP INT TERM

usage_output=$("$tag_hash" 2>&1) && usage_status=0 || usage_status=$?
[ "$usage_status" -eq 64 ] || fail "no-argument call should exit 64"
[ "$usage_output" = "Usage: $tag_hash ADR_FILE [NOTE]" ] || fail "usage message changed"

missing_file="$test_dir/missing.md"
missing_output=$("$tag_hash" "$missing_file" 2>&1) && missing_status=0 || missing_status=$?
[ "$missing_status" -eq 66 ] || fail "missing-file call should exit 66"
[ "$missing_output" = "ADR file not found: $missing_file" ] || fail "missing-file message changed"

printf '# 9999: Test decision\n' > "$adr_file"
"$tag_hash" "$adr_file" "First test note."
"$tag_hash" "$adr_file"

git_hash=$(git -C "$script_dir" rev-parse --verify HEAD)
hash_count=$(grep -F -c "$git_hash" "$adr_file")
heading_count=$(grep -c '^## Revision history$' "$adr_file")
first_entry=$(printf -- "- \`%s\` — First test note." "$git_hash")
default_entry=$(printf -- "- \`%s\` — Prior version before this in-place revision." "$git_hash")

[ "$hash_count" -eq 2 ] || fail "expected the current hash in both entries"
[ "$heading_count" -eq 1 ] || fail "expected one revision-history heading"
grep -Fqx -e "$first_entry" "$adr_file" || fail "explicit note was not appended"
grep -Fqx -e "$default_entry" "$adr_file" || fail "default note was not appended"

cat > "$bad_adr_file" <<'EOF'
# 9999: Bad planning dependency

## Status

Accepted

## Context

The [demo game goal](../../objectives/studio/slice-00/demo-game-goal.md) gives this rule.

## Decision

We will use the rule.

## Consequences

- The planning document controls this record.
EOF

bad_output=$("$validate" "$bad_adr_file" 2>&1) && bad_status=0 || bad_status=$?
[ "$bad_status" -eq 1 ] || fail "planning dependency should fail ADR validation"
printf '%s\n' "$bad_output" | grep -Fq 'must not reference objective or planning documents' || \
  fail "planning dependency should have a clear validation error"

"$validate" "$script_dir"

echo "PASS: tag-hash.sh"
