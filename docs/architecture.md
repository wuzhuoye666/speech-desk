# Talk2 架构说明

Talk2 使用 Electron 的主进程、预加载层和 React 渲染进程分离桌面权限与界面代码。项目数据只由主进程访问，渲染进程通过窄 IPC 接口请求操作。

## 组件边界

```text
React renderer
  LibraryView / EditorView / PrompterView
                 |
                 | window.speechDesk (typed API)
                 v
Preload contextBridge
                 |
                 | named IPC channels
                 v
Electron main process
  Zod validation -> SpeechDatabase / backup / windows / shortcuts
                 |
                 v
SQLite WAL + local image files + .speechdesk ZIP backups
```

- `src/renderer/` 负责资料库、节点画布、富文本、设置和提词窗。
- `src/preload/index.ts` 只暴露 `SpeechDeskApi` 定义的操作，不暴露任意 Node.js 能力。
- `src/main/index.ts` 注册 IPC、校验输入、管理窗口、全局快捷键和自定义图片协议。
- `src/main/database.ts` 是 SQLite 和图片资源的唯一持久化入口。
- `src/shared/` 提供跨进程类型、Zod schema、Markdown 判断和演讲图算法。

两个 BrowserWindow 都启用 `contextIsolation` 和 `sandbox`，并关闭 `nodeIntegration`。页面 CSP 将脚本限制为同源，并把图片额外限制到 `data:`、`blob:` 和 `speech-asset:`。

## 演讲链为什么是线性的

演讲操作需要“下一段”和“上一段”有唯一答案。`validateConnection` 因此拒绝：

- 节点连接自己；
- 重复连线；
- 一个节点拥有多个后继；
- 一个节点拥有多个前驱；
- 新连线形成循环；
- 连线引用不存在的节点。

`buildPlaybackChain` 从显式起点开始沿唯一后继遍历。即使持久化数据意外包含循环，`visited` 集合也会终止遍历，避免提词播放无限循环。

取舍：该模型让现场导航确定且错误更容易解释，但不表达分支演讲。分支内容目前需要复制节点或在演讲前调整连线。

## 数据持久化

`SpeechDatabase` 在 Electron 用户数据目录创建：

- `speech-desk.sqlite`：项目、节点、连线、资源索引和设置；
- `assets/<project-id>/`：导入的图片文件。

SQLite 启用 WAL 和外键。`saveProject` 在单个事务中更新项目元数据、重建该项目的节点和连线，并返回统一的更新时间。

取舍：整组事务让当前内存模型和数据库保持一致，代码路径也较短；项目变大时，重建节点与连线会产生比增量更新更多的写入。Schema 将每个项目限制为最多 2,000 个节点和 2,000 条边。

回收站通过 `deleted_at` 实现软删除。永久删除会触发数据库级联，并删除已登记的图片文件。

## 图片协议

渲染进程把图片字节交给 `assets:import`。主进程验证项目 ID、文件名、MIME 类型和 20 MB 上限，写入本地文件并返回：

```text
speech-asset://asset/<asset-id>
```

协议处理器根据资源 ID 查询真实路径，再通过 Electron `net.fetch` 返回文件。渲染进程不会获得本地文件系统路径。

## 备份格式

`.speechdesk` 是 ZIP 容器：

```text
manifest.json
project.json
assets/<asset-id>.<extension>
assets/<asset-id>.meta.json
```

导入器先累计 ZIP entry 的声明大小，拒绝超过 150 MB 的包，并拒绝 `..`、绝对路径和反斜杠路径。随后验证备份版本和项目 schema，只恢复 MIME 类型为 `image/*` 的资源。克隆项目时会重新生成所有项目、节点、连线和资源 ID，并递归改写富文本 JSON 中的资源 URL。

## 提词窗生命周期

主进程按需创建无边框、透明、置顶且不显示在任务栏的窗口。位置优先使用上次保存边界，并通过 `fitBoundsToWorkArea` 限制到当前显示器工作区。

渲染进程挂载后发送 `prompter:ready`，主进程再回复当前状态。这一握手关闭了“主进程先发送、监听器后注册”导致空白窗口的竞态。内容高度由 `ResizeObserver` 监控并请求主进程调整窗口；主进程结合当前显示器工作区和 `maxHeightRatio` 限制最终高度。

## 测试边界

Vitest 当前覆盖：

- 线性连线校验与错误分支；
- 从起点构建播放链及循环数据保护；
- Markdown 与普通文本区分；
- AI 常见 LaTeX 分隔符识别和 Tiptap 节点迁移；
- 显示器布局变化后的提词窗边界恢复。

生产构建由 `electron-vite` 分别生成 main、preload 和 renderer 产物。Windows 分发由 `electron-builder` 生成 x64 NSIS 安装包。

## 相关文档

- [从源码运行 Talk2](getting-started.md)
- [使用指南](user-guide.md)
- [配置参考](configuration.md)
