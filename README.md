# LeetCode Auto Solver Agent

自动刷 LeetCode 的 Agent。自动打开随机题目，用 AI 生成答案，填入编辑器并提交，循环往复。

## 功能

- 🔀 自动打开随机题目（跳过会员专享题）
- 🤖 使用 Claude / MiniMax AI 生成代码答案
- ✏️ 自动填写 Monaco 编辑器并提交
- 🔁 失败自动重试，支持无限循环模式
- 🌐 支持有头浏览器，Session 持久化（只需登录一次）
- 🌍 支持多种编程语言

## 前提条件

- [Node.js](https://nodejs.org/) 18+
- [agent-browser](https://github.com/AgentBrowser/agent-browser) CLI
- Anthropic 兼容的 AI API（Claude / MiniMax 等）
- LeetCode CN 账号

## 安装

### 1. 安装依赖

```bash
npm install -g agent-browser
agent-browser install   # 下载 Chrome
npm install
```

### 2. 配置 AI API

在 `~/.claude/settings.json` 中配置 API：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "ANTHROPIC_AUTH_TOKEN": "your-api-key-here",
    "ANTHROPIC_MODEL": "claude-3-5-sonnet-20241022"
  }
}
```

> 也支持 MiniMax 等兼容 Anthropic SDK 的 API。

### 3. 登录 LeetCode

首次运行会自动打开浏览器并跳转登录页，登录后 Session 会持久化，后续无需重复登录。

## 使用

```bash
npm start                          # 自动解题（最多 5 次重试）
npm run solve                      # 解一道随机题
node src/index.js --continuous     # 无限循环模式（Ctrl+C 停止）
node src/index.js two-sum          # 解特定题目（slug）
node src/index.js --lang java      # 指定语言
npm run close                      # 关闭浏览器
```

### 支持的语言

`python3` · `java` · `cpp` · `javascript` · `typescript` · `go` · `kotlin` · `swift` · `rust` · `ruby` · `php` · `csharp`

## 项目结构

```
src/
├── index.js     # 主程序入口，解题流程编排
├── browser.js   # 浏览器控制（agent-browser 封装）
├── leetcode.js  # LeetCode 页面操作
└── solver.js    # AI 代码生成
```

## 工作流程

1. 打开 LeetCode 题库页，随机选一道题
2. 检测是否为会员专享题，是则跳过
3. 提取题目描述，调用 AI 生成代码
4. 选择目标语言，填入 Monaco 编辑器
5. 提交，等待结果
6. 成功则继续下一题；失败则重试

## License

MIT
