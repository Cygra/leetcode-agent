#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Chrome path: use env var if set, otherwise let agent-browser use its default
const CHROME_PATH = process.env.AGENT_BROWSER_EXECUTABLE_PATH || '';
const LEETCODE_URL = 'https://leetcode.cn';
const PROBLEMSET_URL = `${LEETCODE_URL}/problemset/`;

const SESSION_NAME = 'leetcode';

/**
 * Execute agent-browser command
 */
function ab(args, options = {}) {
  const env = { ...process.env };
  if (CHROME_PATH) env.AGENT_BROWSER_EXECUTABLE_PATH = CHROME_PATH;
  const cmd = `agent-browser --headed --session-name ${SESSION_NAME} ${args}`;
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      env,
      timeout: options.timeout || 30000,
      // Suppress stderr to avoid "--headed ignored" warnings when daemon is already running
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    });
    return output.trim();
  } catch (error) {
    if (options.ignoreError) return null;
    console.error(`Command failed: ${cmd}`);
    console.error(error.message);
    throw error;
  }
}

/**
 * Open a URL in the browser
 */
async function open(url) {
  ab(`open ${url}`);
  ab('wait --load networkidle');
}

/**
 * Get current URL
 */
function getUrl() {
  return ab('get url');
}

/**
 * Get current page snapshot (interactive elements)
 */
function snapshot() {
  return ab('snapshot -i');
}

/**
 * Click an element by ref
 */
function click(ref) {
  ab(`click ${ref}`);
}

/**
 * Execute JavaScript and return the raw string from agent-browser.
 * agent-browser JSON-encodes the return value, so strings come back with outer quotes.
 */
function evalJs(js) {
  const encoded = Buffer.from(js).toString('base64');
  const cmd = `eval "$(printf '%s' "${encoded}" | base64 -d)"`;
  return ab(cmd);
}

/**
 * Execute JavaScript and return the parsed value.
 * Strips the JSON encoding that agent-browser wraps around return values.
 * Use this instead of evalJs when you need the actual JS return value.
 */
function evalJsValue(js) {
  const raw = evalJs(js);
  if (raw === 'null' || raw === 'undefined' || raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Get HTML of an element
 */
function getHtml(ref) {
  return ab(`get html ${ref}`);
}

/**
 * Get text content of an element
 */
function getText(ref) {
  return ab(`get text ${ref}`);
}

/**
 * Tab management
 */
function listTabs() {
  return ab('tab');
}

function switchTab(index) {
  ab(`tab ${index}`);
}

function closeTab(index) {
  ab(`tab close ${index}`);
}

/**
 * Wait for page to load
 */
function waitForLoad() {
  ab('wait --load networkidle');
}

/**
 * Find element by role and name, then execute action
 */
function findAndClick(role, name) {
  ab(`find role ${role} click --name "${name}"`);
}

/**
 * Check if element exists
 */
function exists(ref) {
  try {
    ab(`get html ${ref}`, { ignoreError: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get description content from LeetCode problem page
 */
function getDescriptionContent() {
  const script = `(function() {
    const el = document.querySelector('[data-track-load="description_content"]');
    return el ? el.innerText : null;
  })()`;
  return evalJsValue(script);
}

/**
 * Check if the user is logged in to LeetCode
 */
function isLoggedIn() {
  const script = `(function() {
    const links = Array.from(document.querySelectorAll('a'));
    const hasLoginLink = links.some(function(a) { return a.innerText.trim() === '登录'; });
    const hasRegisterLink = links.some(function(a) { return a.innerText.trim() === '注册'; });
    return !(hasLoginLink || hasRegisterLink);
  })()`;
  return evalJsValue(script) === true;
}

/**
 * If not logged in, open the login page and wait until the user logs in.
 * Polls every 3 seconds up to maxWaitMs.
 */
async function waitForLogin(maxWaitMs = 5 * 60 * 1000) {
  // Navigate to home to properly check session cookies
  ab('open ' + LEETCODE_URL);
  if (isLoggedIn()) return true;

  console.log('⚠️  未登录 LeetCode CN，正在打开登录页面...');
  ab('open ' + LEETCODE_URL + '/accounts/login/');
  console.log('   请在浏览器中登录，程序将自动继续...\n');

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 3000));
    if (isLoggedIn()) {
      console.log('✓ 登录成功！\n');
      return true;
    }
  }
  console.log('登录等待超时。');
  return false;
}

/**
 * Check if current page is a locked/premium problem
 */
function isLockedProblem() {
  const script = `(function() {
    const body = document.body.innerText;
    return body.includes('该题目是 Plus 会员专享题') ||
           body.includes('您需要升级为 Plus 会员来解锁该题目') ||
           body.includes('会员专享') ||
           body.includes('premiumOnly') ||
           body.includes('lockedQuestion');
  })()`;
  return evalJsValue(script) === true;
}

/**
 * Select programming language on LeetCode.
 * Uses a single async microtask yield so React can render the dropdown
 * before we select the item, all within one CDP eval call.
 */
function selectLanguage(lang = 'Python3') {
  const langMap = {
    'python': 'Python3',
    'python3': 'Python3',
    'java': 'Java',
    'cpp': 'C++',
    'c++': 'C++',
    'javascript': 'JavaScript',
    'js': 'JavaScript',
    'typescript': 'TypeScript',
    'ts': 'TypeScript'
  };

  const langName = langMap[lang.toLowerCase()] || lang;

  const script = `(async function() {
    // Find language dropdown button (aria-haspopup=dialog with visible text)
    const buttons = document.querySelectorAll('button');
    let langButton = null;
    for (const btn of buttons) {
      if (btn.getAttribute('aria-haspopup') === 'dialog' && btn.innerText.trim().length > 0) {
        langButton = btn;
        break;
      }
    }
    if (!langButton) return 'error: language button not found';

    // If already the right language, no need to switch
    if (langButton.innerText.trim() === '${langName}') return 'already_selected';

    // Click to open dropdown, yield one microtask so React renders the popup
    langButton.click();
    await Promise.resolve();

    // Find the dropdown popover
    const popover = document.querySelector('.bg-sd-popover');
    if (!popover) return 'error: dropdown did not appear';

    // Find and click the target language item
    const allDivs = popover.querySelectorAll('div');
    for (const div of allDivs) {
      if (div.innerText && div.innerText.trim() === '${langName}') {
        div.click();
        return 'selected';
      }
    }
    return 'error: ${langName} not found in dropdown';
  })()`;

  const result = evalJsValue(script);
  if (result === 'selected' || result === 'already_selected') {
    return 'selected ' + langName;
  }
  return result || 'error: unknown';
}

/**
 * Get Monaco editor element and fill with code
 * Uses getModel().setValue() which is the correct Monaco API
 */
function fillCode(code) {
  const escaped = code
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  const script = `(function() {
    const editors = monaco.editor.getEditors();
    if (!editors || editors.length === 0) return 'no editors';
    const model = editors[0].getModel();
    if (!model) return 'no model';
    model.setValue(\`${escaped}\`);
    return 'filled';
  })()`;
  return evalJsValue(script);
}

/**
 * Click submit button
 */
function clickSubmit() {
  const script = `(function() {
    const submitBtn = document.querySelector('[data-e2e="submit"]');
    if (submitBtn) {
      submitBtn.click();
      return 'clicked via data-e2e';
    }

    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.innerText.includes('提交') && !btn.disabled) {
        btn.click();
        return 'clicked via text: ' + btn.innerText.trim();
      }
    }
    return 'submit button not found';
  })()`;
  return evalJsValue(script);
}

/**
 * Get submission result from current page.
 * Checks definitive results FIRST before checking pending state,
 * because "调试中" is a permanent UI button not a submission status.
 */
function getSubmissionResult() {
  const script = `(function() {
    const body = document.body.innerText;

    // Check for definitive error results first
    if (body.includes('错误解答') || body.includes('Wrong Answer') || body.includes('解答错误')) {
      return 'wrong_answer';
    }
    if (body.includes('编译出错') || body.includes('Compilation Error')) {
      return 'compilation_error';
    }
    if (body.includes('超出时间限制') || body.includes('Time Limit Exceeded')) {
      return 'time_limit_exceeded';
    }
    if (body.includes('执行出错') || body.includes('Runtime Error')) {
      if (body.includes('NameError')) return 'runtime_error_name';
      if (body.includes('TypeError')) return 'runtime_error_type';
      if (body.includes('ValueError')) return 'runtime_error_value';
      return 'runtime_error';
    }

    // Check for "X / Y 个通过的测试用例" pattern
    const passMatch = body.match(/(\\d+)\\s*\\/\\s*(\\d+)\\s*个.*通过的测试用例/);
    if (passMatch) {
      const passed = parseInt(passMatch[1]);
      const total = parseInt(passMatch[2]);
      return (passed === total && total > 0) ? 'success' : 'wrong_answer';
    }

    // Check for standalone success: look for "通过" as a standalone word (not 未通过)
    const lines = body.split('\\n');
    for (const line of lines) {
      const t = line.trim();
      if (t === '通过' || t === 'Accepted') {
        return 'success';
      }
    }

    // Only treat as pending if submission spinner "执行中" is present (not "调试中" which is always on page)
    if (body.includes('执行中')) {
      return 'pending';
    }

    return 'unknown';
  })()`;
  return evalJsValue(script);
}

/**
 * Poll for submission result until definitive answer or timeout
 */
async function waitForSubmissionResult(timeoutMs = 60000, pollIntervalMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    const result = getSubmissionResult();
    if (result !== 'pending' && result !== 'unknown') {
      return result;
    }
    // After 15s still pending/unknown, check if user is not logged in
    if (Date.now() - start > 15000) {
      if (!isLoggedIn()) {
        return 'not_logged_in';
      }
    }
    // After 45s with unknown, give up
    if (result === 'unknown' && Date.now() - start > 45000) {
      return 'unknown';
    }
  }
  return 'timeout';
}

/**
 * Navigate to random problem via /problems/random
 */
async function goToRandomProblem() {
  await open(`${LEETCODE_URL}/problems/random/`);
  await waitForLoad();
  // Wait a bit for JavaScript to render
  await new Promise(r => setTimeout(r, 3000));
}

module.exports = {
  ab,
  open,
  getUrl,
  snapshot,
  click,
  evalJs,
  evalJsValue,
  getHtml,
  getText,
  listTabs,
  switchTab,
  closeTab,
  waitForLoad,
  findAndClick,
  exists,
  getDescriptionContent,
  isLockedProblem,
  isLoggedIn,
  waitForLogin,
  selectLanguage,
  fillCode,
  clickSubmit,
  getSubmissionResult,
  waitForSubmissionResult,
  goToRandomProblem,
  LEETCODE_URL,
  PROBLEMSET_URL
};
