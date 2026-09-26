#!/usr/bin/env bash
#
# 上游 PR 审核工具（agegr/pi-web -> kano）
#
#   scripts/prs.sh sync            拉取 upstream/main
#   scripts/prs.sh list            列出上游 open PR，附带台账里的审核状态
#   scripts/prs.sh show N          查看单个 PR 的说明与改动文件
#   scripts/prs.sh take N          把 PR N cherry-pick 到 kano，并写入台账
#   scripts/prs.sh drop N 理由     把 PR N 记为拒绝，写入台账
#   scripts/prs.sh mark N          冲突手动解决后，把当前 HEAD 补记为 PR N 的摘取
#
set -euo pipefail

UPSTREAM_REPO="agegr/pi-web"
PR_REF="refs/remotes/upstream-pr"
LEDGER="PRS.md"
BRANCH="kano"

cd "$(git rev-parse --show-toplevel)" 2>/dev/null || {
  echo "error: 不在 git 仓库内" >&2
  exit 1
}

pr_url() { printf 'https://github.com/%s/pull/%s' "$UPSTREAM_REPO" "$1"; }

pr_title() { gh pr view "$1" --repo "$UPSTREAM_REPO" --json title --jq .title; }

# 台账里 PR 的状态列；没有记录则输出空
ledger_status() {
  [ -f "$LEDGER" ] || return 0
  awk -v n="$1" '
    index($0, "| [#" n "](") == 1 {
      k = split($0, part, "|")
      s = part[k - 1]
      gsub(/^[ \t]+|[ \t]+$/, "", s)
      print s
    }
  ' "$LEDGER"
}

ledger_init() {
  cat > "$LEDGER" <<'EOF'
# 上游 PR 台账

记录 `agegr/pi-web` 每个 PR 的取舍，避免重复审核。由 `scripts/prs.sh` 读写。

| 标记 | 含义 |
| --- | --- |
| ⏸️ 待审 | 尚未判断 |
| ✅ 已摘取 | 已 cherry-pick 进 `kano`，括号内是提交 |
| ❌ 拒绝 | 不采用，括号内是理由 |

| PR | 标题 | 状态 |
| --- | --- | --- |
EOF
}

# 有则替换、无则追加
ledger_upsert() {
  local n="$1" title="$2" status="$3" row
  [ -f "$LEDGER" ] || ledger_init
  row="| [#${n}]($(pr_url "$n")) | ${title} | ${status} |"
  if awk -v n="$n" 'index($0, "| [#" n "](") == 1 { f = 1 } END { exit !f }' "$LEDGER"; then
    awk -v n="$n" -v row="$row" '
      index($0, "| [#" n "](") == 1 { print row; next }
      { print }
    ' "$LEDGER" > "${LEDGER}.tmp"
    mv "${LEDGER}.tmp" "$LEDGER"
  else
    printf '%s\n' "$row" >> "$LEDGER"
  fi
}

require_kano() {
  local b
  b=$(git rev-parse --abbrev-ref HEAD)
  [ "$b" = "$BRANCH" ] || { echo "error: 当前分支是 '$b'，请在 '$BRANCH' 上操作" >&2; exit 1; }
}

cmd_sync() {
  git fetch --quiet upstream main
  echo "upstream/main = $(git rev-parse --short upstream/main)"
}

cmd_list() {
  local n title author files add del draft status mark
  while IFS=$'\t' read -r n title author files add del draft; do
    status=$(ledger_status "$n")
    case "$status" in
      *已摘取*) mark="已摘取" ;;
      *拒绝*)   mark="已拒绝" ;;
      *)        mark="待审"   ;;
    esac
    printf '%-6s %-12s %-16s %sf +%s/-%s  %s\n' \
      "#$n" "$mark$([ "$draft" = "true" ] && echo ' [draft]')" "$author" "$files" "$add" "$del" "$title"
  done < <(gh pr list --repo "$UPSTREAM_REPO" --state open --limit 200 \
    --json number,title,author,changedFiles,additions,deletions,isDraft \
    --jq '.[] | [.number, .title, .author.login, .changedFiles, .additions, .deletions, .isDraft] | @tsv')
}

cmd_show() {
  local n="$1"
  gh pr view "$n" --repo "$UPSTREAM_REPO"
  echo
  echo "--- 改动文件 ---"
  gh pr diff "$n" --repo "$UPSTREAM_REPO" --name-only
}

cmd_take() {
  local n="$1" base count sha title
  require_kano
  # 台账是本脚本自己的产物，允许它处于未提交状态
  [ -z "$(git status --porcelain -- . ":(exclude)${LEDGER}")" ] || { echo "error: 工作区不干净" >&2; exit 1; }
  git fetch --quiet upstream main
  echo "拉取 PR #$n ..."
  git fetch --quiet upstream "+refs/pull/${n}/head:${PR_REF}/${n}"
  base=$(git merge-base upstream/main "${PR_REF}/${n}")
  count=$(git rev-list --count "${base}..${PR_REF}/${n}")
  echo "cherry-pick $count 个提交 ..."
  if ! git cherry-pick -x "${base}..${PR_REF}/${n}"; then
    echo
    echo "冲突了。解决后执行："
    echo "  git cherry-pick --continue && scripts/prs.sh mark $n"
    echo "放弃则执行："
    echo "  git cherry-pick --abort"
    exit 1
  fi
  sha=$(git rev-parse --short HEAD)
  title=$(pr_title "$n")
  ledger_upsert "$n" "$title" "✅ 已摘取 ${sha}"
  echo "已记录 #$n -> ✅ 已摘取 ${sha}"
}

cmd_drop() {
  local n="$1" reason="${2:-}" title
  title=$(pr_title "$n")
  if [ -n "$reason" ]; then
    ledger_upsert "$n" "$title" "❌ 拒绝（${reason}）"
  else
    ledger_upsert "$n" "$title" "❌ 拒绝"
  fi
  echo "已记录 #$n -> ❌ 拒绝"
}

cmd_mark() {
  local n="$1" sha title
  sha=$(git rev-parse --short HEAD)
  title=$(pr_title "$n")
  ledger_upsert "$n" "$title" "✅ 已摘取 ${sha}"
  echo "已记录 #$n -> ✅ 已摘取 ${sha}"
}

usage() {
  sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'
}

case "${1:-help}" in
  sync)  cmd_sync ;;
  list)  cmd_list ;;
  show)  [ $# -ge 2 ] || { echo "用法: scripts/prs.sh show N" >&2; exit 1; }; cmd_show "$2" ;;
  take)  [ $# -ge 2 ] || { echo "用法: scripts/prs.sh take N" >&2; exit 1; }; cmd_take "$2" ;;
  drop)  [ $# -ge 2 ] || { echo "用法: scripts/prs.sh drop N [理由]" >&2; exit 1; }; cmd_drop "$2" "${3:-}" ;;
  mark)  [ $# -ge 2 ] || { echo "用法: scripts/prs.sh mark N" >&2; exit 1; }; cmd_mark "$2" ;;
  help|-h|--help) usage ;;
  *) echo "未知命令: $1" >&2; usage >&2; exit 1 ;;
esac
