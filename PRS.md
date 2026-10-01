# 上游 PR 台账

只记录**我们与上游不同**的取舍，避免重复审核。上游已合并、我们也已同步的 PR 不再记录（那时代码已与上游一致，没有取舍可言）。由 `scripts/prs.sh` 读写。

| 标记 | 含义 |
| --- | --- |
| ⏸️ 待审 | 尚未判断 |
| ✅ 已摘取 | 上游尚未合并，但已 cherry-pick 进 `kano`，括号内是提交 |
| ❌ 拒绝 | 不采用，括号内是理由 |

| PR | 标题 | 状态 |
| --- | --- | --- |
| [#899](https://github.com/agegr/pi-web/pull/899) | feat(files): file management for the explorer — create, rename, delete, download, archives, and in-place editing | ✅ 已摘取 c13bd1c（上游以「超出薄前端范围」关闭该 PR，本地保留，属永久分叉） |
| [#892](https://github.com/agegr/pi-web/pull/892) | feat: let users customize the "Use default directory" path | ✅ 保留本地实现（上游以 #996 的 `~/pi-cwd/YYYYMMDD` 关闭了 #892；我们另立一层「新建项目」目录设置：`lib/default-project.ts` + `GET/PUT/POST /api/default-project` 读写 `~/.pi/agent/pi-web.json` 的 `defaultProjectPath`，目录选择器另有排序与自定义路径入口。不动 #996 的 `/api/default-cwd`，因此与上游不冲突） |
