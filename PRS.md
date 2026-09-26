# 上游 PR 台账

记录 `agegr/pi-web` 每个 PR 的取舍，避免重复审核。由 `scripts/prs.sh` 读写。

| 标记 | 含义 |
| --- | --- |
| ⏸️ 待审 | 尚未判断 |
| ✅ 已摘取 | 已 cherry-pick 进 `kano`，括号内是提交 |
| ❌ 拒绝 | 不采用，括号内是理由 |

| PR | 标题 | 状态 |
| --- | --- | --- |
| [#967](https://github.com/agegr/pi-web/pull/967) | fix(chat): branch a history edit only when it is sent | ✅ 已摘取 b7f2f24 |
| [#961](https://github.com/agegr/pi-web/pull/961) | fix(chat): let a long extension dialog title shrink instead of hiding the options | ✅ 已摘取 c924ab2 |
| [#899](https://github.com/agegr/pi-web/pull/899) | feat(files): file management for the explorer — create, rename, delete, download, archives, and in-place editing | ✅ 已摘取 c13bd1c |
