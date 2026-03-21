# LeetCode Auto Solver Agent

自动刷 LeetCode 的 Agent。自动打开随机题目，用 AI 生成答案，填入编辑器并提交，循环往复。

## 功能

- 🔀 自动打开随机题目（跳过会员专享题、已解答题目）
- 🤖 使用 GitHub Copilot（`gpt-4o-mini`）生成代码答案
- ✏️ 自动填写 Monaco 编辑器并提交
- 🔧 提交出错时自动提取错误信息，让 AI 修复，最多重试 3 次
- 🔁 失败自动重试，支持无限循环模式
- 🌐 支持有头浏览器，Session 持久化（只需登录一次）
- 🌍 支持多种编程语言

## 前提条件

- [Node.js](https://nodejs.org/) 18+
- [agent-browser](https://github.com/AgentBrowser/agent-browser) CLI
- [GitHub CLI](https://cli.github.com/)（`gh`）并已登录（用于获取 Copilot API Token）
- LeetCode CN 账号

## 安装

```bash
npm install -g agent-browser
agent-browser install   # 下载 Chrome
npm install
```

## 配置

### AI API

使用 GitHub Copilot / GitHub Models API，无需额外配置。确保已通过 `gh auth login` 登录 GitHub CLI 即可。

也可通过环境变量 `GITHUB_TOKEN` 指定 Token：

```bash
export GITHUB_TOKEN=your_token_here
```

### Chrome 路径（可选）

默认使用 agent-browser 内置的 Chrome。如需指定自定义路径：

```bash
export AGENT_BROWSER_EXECUTABLE_PATH=/path/to/chrome
```

## 使用

### 首次运行 / 登录

```bash
npm start
# 首次运行会自动打开浏览器并跳转 LeetCode 登录页
# 登录后 Session 会持久化，后续无需重复登录
```

### 常用命令

```bash
npm start                              # 自动解题（最多 5 次重试）
npm run solve                          # 解一道随机题
node src/index.js --continuous         # 无限循环模式（Ctrl+C 停止）
node src/index.js --continuous -l java # 无限循环，使用 Java
node src/index.js two-sum              # 解特定题目（slug）
node src/index.js --lang cpp           # 指定语言（默认 python3）
npm run close                          # 关闭浏览器
npm test                               # 运行测试
```

### 支持的语言

`python3` · `java` · `cpp` · `javascript` · `typescript` · `go` · `kotlin` · `swift` · `rust` · `ruby` · `php` · `csharp`

## 项目结构

```
src/
├── index.js     # 主程序入口，解题流程编排
├── browser.js   # 浏览器控制（agent-browser 封装）
├── leetcode.js  # LeetCode 页面操作
└── solver.js    # AI 代码生成（GitHub Copilot API）
test/
├── solver.test.js      # AI 生成 / 修复代码测试
└── submission.test.js  # 提交结果检测测试
```

## 工作流程

1. 打开 LeetCode 题库页，随机选一道题
2. 跳过会员专享题、已解答过的题目
3. 提取题目描述，调用 AI 生成代码
4. 选择目标语言，填入 Monaco 编辑器并提交
5. 等待结果：
   - ✅ 通过 → 继续下一题
   - ❌ 出错 → 提取错误详情（输出/期望/错误信息），让 AI 修复后重新提交，最多 3 次
   - 3 次修复仍失败 → 换一道新题重试

## License

MIT
