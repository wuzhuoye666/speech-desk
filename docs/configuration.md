# 配置参考

Talk2 把应用设置存入 SQLite `settings` 表的 `app` 键。缺失字段会与源码中的默认值合并。

## 应用主题

| 字段 | 类型 | 默认值 | 允许值 |
| --- | --- | --- | --- |
| `theme` | 字符串 | `system` | `system`、`light`、`dark` |

`system` 会在渲染时读取操作系统的深浅色偏好。

## 提词窗设置

| 字段 | 类型 | 默认值 | 约束或效果 |
| --- | --- | --- | --- |
| `displayId` | 字符串或 `null` | `null` | `null` 使用主显示器；移动或缩放窗口后保存匹配显示器 ID |
| `bounds` | 窗口矩形或 `null` | `null` | 非空时宽度至少 320，高度至少 100；启动时限制到当前工作区 |
| `maxHeightRatio` | 数字 | `0.35` | `0.2` 到 `0.7`；限制自动调整后的窗口高度 |
| `fontScale` | 数字 | `1` | `0.7` 到 `2.5` |
| `opacity` | 数字 | `0.96` | `0.45` 到 `1`，直接传给 Electron 窗口不透明度 |
| `theme` | 字符串 | `dark` | `system`、`light`、`dark` |
| `clickThrough` | 布尔值 | `false` | 启用时忽略鼠标事件并转发移动事件 |
| `contentProtection` | 布尔值 | `true` | 传给 Electron `setContentProtection` 的尽力保护开关 |

设置界面的字号和不透明度滑块使用与上表一致的范围。`maxHeightRatio`、显示器 ID 和窗口边界目前由运行逻辑管理，不在设置面板中直接编辑。

## 全局快捷键

| 字段 | 默认值 | 操作 |
| --- | --- | --- |
| `next` | `Alt+Right` | 下一节点 |
| `previous` | `Alt+Left` | 上一节点 |
| `scrollUp` | `Alt+Up` | 向上滚动提词内容 |
| `scrollDown` | `Alt+Down` | 向下滚动提词内容 |
| `toggleVisibility` | `Alt+Shift+P` | 显示或隐藏提词窗 |
| `toggleClickThrough` | `Alt+Shift+L` | 切换鼠标穿透 |

每个值必须是 1 到 64 个字符。保存时应用会先尝试注册全部组合；任何一个组合失败都会回滚到上一次设置。

## 内容和项目约束

| 对象 | 约束 |
| --- | --- |
| 项目标题 | 1 到 200 个字符 |
| 节点标题 | 最多 200 个字符 |
| 节点数量 | 每个导入或保存包最多 2,000 个 |
| 连线数量 | 每个导入或保存包最多 2,000 条 |
| 节点宽度 | 280 到 2,400；界面缩放器限制为 300 到 1,400 |
| 节点高度 | 180 到 4,000；界面缩放器限制为 200 到 2,200 |
| 画布缩放 | 数据允许 0.1 到 4；界面允许 0.2 到 2.2 |
| 单张导入图片 | 不超过 20 MB，MIME 类型以 `image/` 开头 |
| 备份解压总大小 | 不超过 150 MB |
| 备份版本 | 当前只接受版本 `1` |

## 开发与 QA 环境变量

下列变量在主进程源码中用于本地 QA，不属于普通用户配置：

| 变量 | 用途 |
| --- | --- |
| `SPEECH_DESK_QA_USER_DATA` | 覆盖 Electron 用户数据目录，隔离测试数据库 |
| `SPEECH_DESK_QA_VIEW` | 使用 `editor` 或 `prompter` 创建内置 QA 场景 |
| `SPEECH_DESK_QA_LOG` | 追加渲染控制台、崩溃和截图错误日志 |
| `SPEECH_DESK_QA_SCREENSHOT` | 页面加载后保存目标窗口 PNG 并退出 |
| `SPEECH_DESK_QA_REPORT` | 保存编辑器边、节点和连接点的布局 JSON |

## 相关文档

- [如何使用 Talk2](user-guide.md)
- [架构说明](architecture.md)
