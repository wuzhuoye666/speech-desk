# 从源码运行演讲台

你将启动桌面应用，创建两个讲稿节点，用连线确定讲述顺序，并打开悬浮提词窗。

## 你需要准备

- Windows x64
- Node.js 22
- Git

在 PowerShell 中确认版本：

```powershell
node --version
git --version
```

## 第 1 步：获取代码与依赖

```powershell
git clone https://github.com/wuzhuoye666/speech-desk.git
cd speech-desk
npm.cmd ci
```

`npm.cmd ci` 严格按照 `package-lock.json` 安装依赖，不会改写依赖版本。

## 第 2 步：启动应用

```powershell
npm.cmd run dev
```

Electron 窗口打开后，你会看到本地演讲资料库。这就是第一个可见结果。

## 第 3 步：创建演讲路径

1. 选择“新建演讲”。
2. 在默认“开场”节点中输入或粘贴内容。
3. 双击画布空白处创建第二个节点。
4. 从第一个节点右侧圆点拖到第二个节点左侧圆点。
5. 如需更换起点，打开节点菜单并选择“设为起点”。

每个节点最多有一个上一节点和一个下一节点。应用会拒绝重复连线、自连线、分叉、汇合和循环。

## 第 4 步：打开提词窗

选择顶部“开始演讲”。提词窗会显示起点内容。使用：

- `Alt+Right` 前往下一节点；
- `Alt+Left` 返回上一节点；
- `Alt+Up` / `Alt+Down` 滚动内容；
- `Alt+Shift+P` 隐藏或显示提词窗。

## 验证开发环境

停止开发服务器后运行：

```powershell
npm.cmd run check
```

成功时，命令会完成 TypeScript 类型检查、Vitest 测试和 Electron 生产构建，并在 `out/` 生成构建结果。

## 常见问题

### PowerShell 阻止运行 npm

使用本文中的 `npm.cmd`，不要调用可能被执行策略拦截的 `npm.ps1`。

### 应用启动但快捷键不可用

全局快捷键可能被其他应用占用。关闭冲突应用，或在设置中换用其他 Electron accelerator 字符串。保存失败时，演讲台会恢复上一次有效组合。

### 提词窗出现在屏幕外

应用会在启动提词窗时将已保存位置限制到当前显示器工作区。若显示器布局正在变化，重新开始演讲以重新计算位置。

## 你完成了什么

你已经从源码启动演讲台，建立一条可播放的节点路径并用提词窗导航。继续阅读[使用指南](user-guide.md)，或查看[配置参考](configuration.md)。
