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
| [#963](https://github.com/agegr/pi-web/pull/963) | fix(chat): 自动压缩时显示压缩状态与「停止压缩」，而非「正在等待模型」 | ✅ 已摘取 533e153 |
| [#960](https://github.com/agegr/pi-web/pull/960) | feat(enhancements): add modular frontend enhancement plugins suite & patch tools | ❌ 拒绝（注入式前端插件补丁套件（含 48K 行 JS 与 patch 脚本），与本项目结构不符） |
| [#892](https://github.com/agegr/pi-web/pull/892) | feat: let users customize the Use default directory path | ✅ 已摘取 940596c |
| [#951](https://github.com/agegr/pi-web/pull/951) | feat: open and reveal paths in the OS file manager | ✅ 已摘取 3b04053 |
| [#907](https://github.com/agegr/pi-web/pull/907) | feat(sidebar): open workspace in the system file manager | ❌ 拒绝（功能与已摘取的 #951 重复，由 #951 覆盖） |
