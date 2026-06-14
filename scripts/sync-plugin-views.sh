#!/usr/bin/env bash
# sync-plugin-views.sh — copy the canonical hull_plot.py + preview_view.py
# from vfClamp/shared/plugin-views/ to both the Glyphs and RoboFont plugin
# bundles, then commit + push each submodule that actually changed.
#
# The two NSView modules are framework-agnostic (no GlyphsApp, no
# RoboFont imports) which is why we can share them. Without this sync
# script a hand-edit in one bundle silently drifts from the other — the
# two plugins started diverging within minutes of being copied for the
# robofont v1.0.0 ship.
#
# Usage:
#   bash scripts/sync-plugin-views.sh           # sync, commit, push
#   bash scripts/sync-plugin-views.sh --dry-run # report what would change
#
# Run from the vfClamp parent repo root.

set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
	DRY_RUN=1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT/shared/plugin-views"

if [ ! -d "$SRC_DIR" ]; then
	echo "Error: $SRC_DIR not found" >&2
	exit 1
fi

# Each entry: "source-file:submodule-dir:destination-relative-path"
TARGETS=(
	"hull_plot.py:plugins/glyphs:vf-clamp.glyphsPlugin/Contents/Resources/hull_plot.py"
	"preview_view.py:plugins/glyphs:vf-clamp.glyphsPlugin/Contents/Resources/preview_view.py"
	"hull_plot.py:plugins/robofont:vf-clamp.roboFontExt/lib/vfClamp/hull_plot.py"
	"preview_view.py:plugins/robofont:vf-clamp.roboFontExt/lib/vfClamp/preview_view.py"
)

# Track which submodules had any file changed. Bash 3.x on macOS doesn't
# support associative arrays, so we use a space-separated string list.
SUB_CHANGED=""

for entry in "${TARGETS[@]}"; do
	IFS=':' read -r src_file sub_dir dst_path <<< "$entry"
	src_full="$SRC_DIR/$src_file"
	dst_full="$ROOT/$sub_dir/$dst_path"

	if [ ! -f "$src_full" ]; then
		echo "Error: missing canonical source $src_full" >&2
		exit 1
	fi

	# Skip if identical.
	if [ -f "$dst_full" ] && cmp -s "$src_full" "$dst_full"; then
		echo "  $sub_dir/$dst_path: up to date"
		continue
	fi

	echo "  $sub_dir/$dst_path: needs sync"
	if [ "$DRY_RUN" = "1" ]; then
		continue
	fi

	mkdir -p "$(dirname "$dst_full")"
	cp "$src_full" "$dst_full"
	(cd "$ROOT/$sub_dir" && git add "$dst_path")
	# Add to SUB_CHANGED iff not already present (idempotent).
	case " $SUB_CHANGED " in
		*" $sub_dir "*) ;;
		*) SUB_CHANGED="$SUB_CHANGED $sub_dir" ;;
	esac
done

if [ "$DRY_RUN" = "1" ]; then
	echo ""
	echo "Dry run — no changes written."
	exit 0
fi

# Commit + push each changed submodule.
PUSHED=0
SKIPPED=0
for sub_dir in $SUB_CHANGED; do
	cd "$ROOT/$sub_dir"
	branch="$(git rev-parse --abbrev-ref HEAD)"
	git -c user.name="Liiift" -c user.email="hello@liiift.studio" \
		commit -m "Sync shared plugin-views (hull_plot.py / preview_view.py)"
	if git push origin "$branch" 2>&1 | tail -1 | grep -q "rejected\|error"; then
		echo "  $sub_dir: committed but push failed"
		SKIPPED=$((SKIPPED + 1))
	else
		git push origin "$branch" >/dev/null 2>&1 || true
		echo "  $sub_dir: synced and pushed ($branch)"
		PUSHED=$((PUSHED + 1))
	fi
done

echo ""
echo "Done — $PUSHED submodule(s) synced + pushed${SKIPPED:+, $SKIPPED skipped}."
