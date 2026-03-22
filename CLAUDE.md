# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LeetCode Auto Solver Agent - automatically opens LeetCode problems, generates solutions via local Claude Code CLI (`claude -p`), fills the Monaco editor, and submits.

## Commands

```bash
npm start           # Auto-solve with 5 retries
npm run solve       # Solve one random problem
npm run test        # Test browser connection
node src/index.js --once --lang python3        # Solve one with specific language
node src/index.js --continuous --lang java     # Continuous mode (infinite loop)
node src/index.js two-sum                      # Solve specific problem by slug
node src/index.js --list problems.json         # Solve problems from JSON list file
node src/index.js --list problems.json -l java # List mode with specific language
```

## Architecture

```
src/
├── index.js    # Main orchestrator - coordinates the solve flow
├── browser.js  # Wraps agent-browser CLI - browser automation (open, click, evalJs, Monaco fill)
├── leetcode.js # LeetCode-specific ops - random problem, description, language selection, submission
└── solver.js   # Claude API integration - generates code solutions
```

**Module dependencies:** `index.js` → `leetcode.js` + `solver.js`; `leetcode.js` → `browser.js`

### src/browser.js
- Wraps `agent-browser` CLI tool for browser control
- Key functions: `open()`, `click()`, `evalJs()`, `snapshot()`, `fillCode()`, `clickSubmit()`, `getSubmissionResult()`
- Monaco editor filling via `monaco.editor.getEditors()[0].getModel().setValue()`
- Chrome path configured at top of file (`CHROME_PATH`)

### src/leetcode.js
- LeetCode page operations: `openRandomProblem()`, `getProblemDescription()`, `getProblemTitle()`
- Language selection via `browser.selectLanguage()`
- Submission and result checking via `browser`

### src/solver.js
- Calls local Claude Code CLI via `execFile('claude', ['-p', '--output-format', 'text'])` with 120s timeout
- Two-step generation: first analyzes algorithm, then generates code with starter code in prompt
- `validateSyntax(code, language)` does pre-submission syntax check (Python: ast.parse, JS: new Function)
- Prompt passed via stdin; no API key or env vars needed
- Returns raw code (strips markdown, backticks)

## Key Implementation Details

- The `maybeAwait()` helper in `leetcode.js` handles both sync return values and promises from `browser.js` functions
- Language mapping in `solver.js` maps user-friendly names (python3, java) to API format
- `browser.evalJs()` uses base64 encoding to safely pass special characters
- `browser.getStarterCode()` reads Monaco editor content to pass function signature to the AI
- Language dropdown detected via `.fa-chevron-down` SVG child inside `button[aria-haspopup="dialog"]`
- Submission result parsing checks for success/error patterns in page text
- Premium-only problems (会员专享) are detected and skipped automatically
- `openRandomProblem()` loops infinitely on skips (locked/solved/hard/medium); only real errors count toward maxAttempts
- `--list/-f` mode reads a JSON array of `{ url, solved? }`, marks `solved:true` + `solvedAt` after each success, persists after every attempt
- `formatError()` in `index.js` builds structured error messages (input/expected/got) for fix prompts
