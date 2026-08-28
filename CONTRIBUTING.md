# 贡献指南

感谢你改进演讲台。项目目前面向 Windows x64，提交应保持本地数据安全、演讲路径确定性和提词窗可用性。

## 开发环境

- Windows x64
- Node.js 22
- npm

```powershell
git clone https://github.com/wuzhuoye666/speech-desk.git
cd speech-desk
npm.cmd ci
npm.cmd run dev
```

## 提交修改

1. 先在 Issue 中描述可复现的问题或用户场景。小型修正可以直接提交 Pull Request。
2. 从 `main` 创建短生命周期分支。
3. 保持改动聚焦，并为演讲链、数据校验或内容迁移等逻辑补充测试。
4. 提交前运行：

   ```powershell
   npm.cmd run check
   ```

5. 在 Pull Request 中写清行为变化、验证证据和界面截图（如果涉及 UI）。

## 代码约定

- TypeScript 保持 `strict`，不要用 `any` 绕过类型边界。
- 渲染进程不得直接访问 Node.js；新能力通过预加载层暴露窄接口，并在主进程使用 Zod 校验输入。
- 数据库写入保持事务性。导入文件必须限制大小、验证结构并拒绝不安全路径。
- 不提交 `release/`、`release-fixed/`、`.qa/`、QA 报告、数据库或用户数据。
- 用户可见的安全与隐私能力必须描述真实边界，不承诺无法验证的保护效果。

## 提交信息

使用简短的命令式信息，例如：

```text
fix: restore prompter bounds after display changes
docs: explain backup format limits
test: cover cyclic playback data
```

提交 Pull Request 即表示你同意按项目的 [MIT 许可证](LICENSE)发布贡献。
