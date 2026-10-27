#!/usr/bin/env bash
# Simulate the uncommitted worktree + scheduled publishes using Git's merge engine.
# Only the temporary clone receives snapshot/merge objects. Source refs/index stay intact.
set -euo pipefail
export LC_ALL=C
root=$(git rev-parse --show-toplevel)
main=$(git -C "$root" rev-parse origin/main)
head=$(git -C "$root" rev-parse HEAD)
scratch=$(mktemp -d "${TMPDIR:-/tmp}/tb-publish-sim.XXXXXX")
trap 'rm -rf "$scratch"' EXIT
git -C "$root" for-each-ref --format='%(refname:short) %(objectname)' \
  --no-merged="$main" refs/remotes/origin/publish/ | sort > "$scratch/queue"
git clone --quiet --shared --no-checkout "$root" "$scratch/repo"
sim=(git -C "$scratch/repo")
"${sim[@]}" config user.name 'Local queue simulation'
"${sim[@]}" config user.email 'queue-simulation@localhost'
"${sim[@]}" config commit.gpgSign false
"${sim[@]}" read-tree "$head"
# Include tracked edits/deletions and non-ignored new files without staging the source.
git --git-dir="$scratch/repo/.git" --work-tree="$root" add -A -- "$root"
tree=$("${sim[@]}" write-tree)
current=$("${sim[@]}" commit-tree "$tree" -p "$head" -m 'Temporary worktree snapshot')
printf 'origin/main=%s\nHEAD=%s\nworktree_tree=%s\n' "$main" "$head" "$tree"
total=0; merged=0; skipped=0; conflicts=0; portfolio=0; baseline_conflicts=0
while read -r branch oid; do
  total=$((total + 1))
  # Limit history to commits absent from main, not shared historical portfolio work.
  touches=$("${sim[@]}" log --format='%h %s' "$main..$oid" -- portfolio/)
  if [[ -n "$touches" ]]; then
    printf 'PORTFOLIO CHANGES %s\n%s\n' "$branch" "$touches"
    portfolio=$((portfolio + 1))
  fi
  # Only these three known obsolete branches may be excluded, and only after
  # independently reproducing a merge conflict against pristine origin/main.
  case "$branch" in
    origin/publish/20261011T1200Z-tw-citations|origin/publish/20261012T1200Z-hallucination|origin/publish/20261013T1200Z-fde)
      if "${sim[@]}" merge-tree --write-tree "$main" "$oid" > "$scratch/baseline"; then
        :
      else
        status=$?
        if [[ "$status" != 1 ]]; then cat "$scratch/baseline"; exit "$status"; fi
        printf 'EXCLUDED (conflicts with pristine origin/main): %s\n' "$branch"
        sed -n '/CONFLICT/p' "$scratch/baseline"
        skipped=$((skipped + 1))
        continue
      fi
      ;;
  esac
  if "${sim[@]}" merge-tree --write-tree "$current" "$oid" > "$scratch/merge"; then
    read -r tree < "$scratch/merge"
    current=$("${sim[@]}" commit-tree "$tree" -p "$current" -p "$oid" -m "Simulate $branch")
    merged=$((merged + 1))
    printf 'PASS %s\n' "$branch"
  else
    status=$?
    cat "$scratch/merge"
    if [[ "$status" != 1 ]]; then exit "$status"; fi
    conflicts=$((conflicts + 1))
    printf 'FAIL %s: branch NOT merged; subsequent checks use the last successful tree.\n' "$branch"
    if "${sim[@]}" merge-tree --write-tree "$main" "$oid" > "$scratch/baseline"; then
      printf 'Baseline main is clean: investigate this worktree or earlier queue merges.\n'
    else
      status=$?
      if [[ "$status" != 1 ]]; then cat "$scratch/baseline"; exit "$status"; fi
      baseline_conflicts=$((baseline_conflicts + 1))
      printf 'ALSO CONFLICTS WITH PRISTINE origin/main (not an allowed exclusion): %s\n' "$branch"
      sed -n '/CONFLICT/p' "$scratch/baseline"
    fi
  fi
done < "$scratch/queue"
printf 'SUMMARY considered=%s merged=%s baseline_excluded=%s conflicts=%s also_conflict_on_main=%s portfolio_branches=%s\n' \
  "$total" "$merged" "$skipped" "$conflicts" "$baseline_conflicts" "$portfolio"
[[ "$conflicts" == 0 ]]
