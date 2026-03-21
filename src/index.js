#!/usr/bin/env node

const args = process.argv.slice(2);
const remainingArgs = args;

const browser = require('./browser');

const leetcode = require('./leetcode');
const solver = require('./solver');

// Default language
let selectedLanguage = 'python3';

/**
 * Auto-solve loop - solve problems until success or max retries
 */
async function autoSolve(maxRetries = 5) {
  console.log('Starting LeetCode Auto Solver...');
  console.log(`Language: ${selectedLanguage}`);
  console.log('================================\n');

  // Pre-flight: ensure logged in
  const loggedIn = await browser.waitForLogin();
  if (!loggedIn) {
    console.log('未能登录，退出。');
    return false;
  }

  let attempts = 0;

  while (attempts < maxRetries) {
    attempts++;
    console.log(`--- Attempt ${attempts} ---\n`);

    try {
      // 1. Open random problem
      console.log('1. Opening random problem...');
      const result = await leetcode.openRandomProblem();

      if (!result.success) {
        console.log('Failed to open random problem, retrying...\n');
        continue;
      }

      console.log(`   URL: ${result.url}`);
      console.log(`   Description preview: ${result.description.substring(0, 150)}...\n`);

      // 2. Get problem details
      console.log('2. Getting problem details...');
      const title = await leetcode.getProblemTitle();
      console.log(`   Title: ${title}\n`);

      if (!result.description || result.description.length < 50) {
        console.log('Failed to get problem description, retrying...\n');
        continue;
      }

      // 3. Select language
      console.log(`3. Selecting ${selectedLanguage}...`);
      let langResult = browser.selectLanguage(selectedLanguage);
      if (langResult && typeof langResult.then === 'function') {
        langResult = await langResult;
      }
      console.log(`   Result: ${langResult}\n`);
      await new Promise(r => setTimeout(r, 1000));

      // 4. Generate solution
      console.log('4. Generating solution with AI...');
      let code = await solver.generateSolution(result.description, selectedLanguage);

      console.log(`   code = ${code ? 'truthy (' + code.length + ' chars)' : 'falsy'}, validateCode = ${solver.validateCode(code)}`);
      if (!code || !solver.validateCode(code)) {
        console.log('Failed to generate valid solution, retrying...\n');
        if (code) console.log('   code preview:', code.substring(0, 200));
        continue;
      }

      console.log(`   Generated ${code.length} chars of code\n`);

      // 5. Fill + submit, with up to 3 fix attempts
      let submissionResult;
      const MAX_FIX_ATTEMPTS = 3;
      for (let fix = 0; fix <= MAX_FIX_ATTEMPTS; fix++) {
        // Fill code via Monaco API
        console.log(`5. Filling code into Monaco editor (attempt ${fix + 1})...`);
        browser.fillCode(code);
        await new Promise(r => setTimeout(r, 500));

        // Submit solution
        console.log('6. Submitting solution...');
        browser.clickSubmit();

        // Poll for result (up to 60s)
        console.log('7. Waiting for result...');
        submissionResult = await browser.waitForSubmissionResult();
        console.log(`   Result: ${submissionResult}\n`);

        if (submissionResult === 'success') break;
        if (submissionResult === 'not_logged_in') break;

        if (fix < MAX_FIX_ATTEMPTS) {
          // Extract error details and attempt a fix
          const errDetails = browser.getSubmissionError();
          let errMsg = submissionResult;
          if (errDetails) {
            if (errDetails.errorText) errMsg += `\n${errDetails.errorText}`;
            if (errDetails.output) errMsg += `\nActual output: ${errDetails.output}`;
            if (errDetails.expected) errMsg += `\nExpected: ${errDetails.expected}`;
            if (errDetails.lastInput) errMsg += `\nInput: ${errDetails.lastInput}`;
            if (errDetails.passCount) errMsg += `\n${errDetails.passCount}`;
          }
          console.log(`   Error details: ${errMsg}`);
          console.log(`   Fixing solution (fix ${fix + 1}/${MAX_FIX_ATTEMPTS})...`);
          const fixed = await solver.fixSolution(code, errMsg, result.description, selectedLanguage);
          if (fixed && solver.validateCode(fixed)) {
            code = fixed;
          } else {
            console.log('   Fix failed, stopping retry.');
            break;
          }
        }
      }

      if (submissionResult === 'success') {
        console.log('================================');
        console.log('SUCCESS! Problem solved!');
        console.log('================================\n');

        // Close the problem tab (only if there are multiple tabs)
        const tabs = browser.listTabs();
        if (tabs && tabs.includes('\n')) {
          console.log('8. Closing problem tab...');
          try { browser.closeTab(0); } catch (e) { console.log('   Close tab skipped:', e.message); }
          await new Promise(r => setTimeout(r, 500));
        }

        return true;
      } else if (submissionResult === 'not_logged_in') {
        console.log('Not logged in - please log in to LeetCode CN first.\n');
        return false;
      } else if (submissionResult === 'wrong_answer') {
        console.log('Wrong answer, generating new solution...\n');
        continue;
      } else if (submissionResult === 'compilation_error') {
        console.log('Compilation error, retrying...\n');
        continue;
      } else if (String(submissionResult).startsWith('runtime_error')) {
        console.log(`Runtime error (${submissionResult}), retrying...\n`);
        continue;
      } else if (submissionResult === 'time_limit_exceeded') {
        console.log('Time limit exceeded, retrying...\n');
        continue;
      } else {
        console.log(`Unknown result: ${submissionResult}, retrying...\n`);
        continue;
      }

    } catch (error) {
      console.error('Error during solve attempt:', error.message, '\n');
    }
  }

  console.log('================================');
  console.log(`Failed after ${maxRetries} attempts`);
  console.log('================================\n');
  return false;
}

/**
 * Continuous auto-solve loop - runs forever until stopped
 */
async function autoSolveContinuous() {
  console.log('Starting LeetCode Continuous Auto Solver...');
  console.log(`Language: ${selectedLanguage}`);
  console.log('Press Ctrl+C to stop');
  console.log('================================\n');

  // Pre-flight: ensure logged in
  const loggedIn = await browser.waitForLogin();
  if (!loggedIn) {
    console.log('未能登录，退出。');
    return;
  }

  let totalSolved = 0;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 5;

  while (true) {
    console.log(`\n=== Problem #${totalSolved + 1} ===\n`);

    try {
      // 1. Open random problem
      console.log('1. Opening random problem...');
      const result = await leetcode.openRandomProblem();

      if (!result.success) {
        console.log('Failed to open random problem, retrying...\n');
        consecutiveFailures++;
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.log(`Too many consecutive failures (${consecutiveFailures}), taking a break...`);
          await new Promise(r => setTimeout(r, 10000));
          consecutiveFailures = 0;
        }
        continue;
      }

      console.log(`   URL: ${result.url}`);
      console.log(`   Description preview: ${result.description.substring(0, 150)}...\n`);

      // 2. Get problem details
      console.log('2. Getting problem details...');
      const title = await leetcode.getProblemTitle();
      console.log(`   Title: ${title}\n`);

      if (!result.description || result.description.length < 50) {
        console.log('Failed to get problem description, retrying...\n');
        consecutiveFailures++;
        continue;
      }

      // 3. Select language
      console.log(`3. Selecting ${selectedLanguage}...`);
      let langResult = browser.selectLanguage(selectedLanguage);
      if (langResult && typeof langResult.then === 'function') {
        langResult = await langResult;
      }
      console.log(`   Result: ${langResult}\n`);
      await new Promise(r => setTimeout(r, 1000));

      // 4. Generate solution
      console.log('4. Generating solution with AI...');
      let code = await solver.generateSolution(result.description, selectedLanguage);

      if (!code || !solver.validateCode(code)) {
        console.log('Failed to generate valid solution, retrying...\n');
        consecutiveFailures++;
        continue;
      }

      console.log(`   Generated ${code.length} chars of code\n`);

      // 5. Fill + submit, with up to 3 fix attempts
      let submissionResult;
      const MAX_FIX = 3;
      for (let fix = 0; fix <= MAX_FIX; fix++) {
        console.log(`5. Filling code (attempt ${fix + 1})...`);
        browser.fillCode(code);
        await new Promise(r => setTimeout(r, 500));

        console.log('6. Submitting solution...');
        browser.clickSubmit();

        console.log('7. Waiting for result...');
        submissionResult = await browser.waitForSubmissionResult();
        console.log(`   Result: ${submissionResult}\n`);

        if (submissionResult === 'success') break;
        if (submissionResult === 'not_logged_in') break;

        if (fix < MAX_FIX) {
          const errDetails = browser.getSubmissionError();
          let errMsg = submissionResult;
          if (errDetails) {
            if (errDetails.errorText) errMsg += `\n${errDetails.errorText}`;
            if (errDetails.output) errMsg += `\nActual output: ${errDetails.output}`;
            if (errDetails.expected) errMsg += `\nExpected: ${errDetails.expected}`;
            if (errDetails.lastInput) errMsg += `\nInput: ${errDetails.lastInput}`;
          }
          const fixed = await solver.fixSolution(code, errMsg, result.description, selectedLanguage);
          if (fixed && solver.validateCode(fixed)) {
            code = fixed;
          } else break;
        }
      }

      if (submissionResult === 'success') {
        totalSolved++;
        consecutiveFailures = 0;
        console.log('================================');
        console.log(`SUCCESS! Total solved: ${totalSolved}`);
        console.log('================================\n');

        // Close the problem tab (only if there are multiple tabs)
        const tabs = browser.listTabs();
        if (tabs && tabs.includes('\n')) {
          console.log('8. Closing problem tab...');
          try { browser.closeTab(0); } catch (e) {}
          await new Promise(r => setTimeout(r, 1000));
        }

        await new Promise(r => setTimeout(r, 2000));
        continue;

      } else if (submissionResult === 'not_logged_in') {
        console.log('Not logged in - please log in to LeetCode CN first. Stopping.\n');
        break;
      } else if (submissionResult === 'wrong_answer') {
        console.log('Wrong answer, trying next problem...\n');
        consecutiveFailures++;
      } else if (submissionResult === 'compilation_error') {
        console.log('Compilation error, trying next problem...\n');
        consecutiveFailures++;
      } else if (String(submissionResult).startsWith('runtime_error')) {
        console.log(`Runtime error (${submissionResult}), trying next problem...\n`);
        consecutiveFailures++;
      } else if (submissionResult === 'time_limit_exceeded') {
        console.log('Time limit exceeded, trying next problem...\n');
        consecutiveFailures++;
      } else {
        console.log(`Unknown result: ${submissionResult}, trying next problem...\n`);
        consecutiveFailures++;
      }

      // If too many consecutive failures, take a break
      if (consecutiveFailures >= maxConsecutiveFailures) {
        console.log(`\nToo many consecutive failures (${consecutiveFailures}), taking a 30 second break...\n`);
        await new Promise(r => setTimeout(r, 30000));
        consecutiveFailures = 0;
      }

    } catch (error) {
      console.error('Error during solve attempt:', error.message, '\n');
      consecutiveFailures++;
    }
  }
}

/**
 * Solve a specific problem (by URL or slug)
 */
async function solveOne(urlOrSlug) {
  let url = urlOrSlug;
  if (!url.includes('/')) {
    url = `${browser.LEETCODE_URL}/problems/${url}/`;
  } else if (!url.includes('leetcode.cn')) {
    url = `${browser.LEETCODE_URL}${url}`;
  }

  console.log(`LeetCode Auto Solver - Solving: ${url}`);
  console.log(`Language: ${selectedLanguage}`);
  console.log('================================\n');

  // Pre-flight: ensure logged in
  const loggedIn = await browser.waitForLogin();
  if (!loggedIn) {
    console.log('未能登录，退出。');
    return false;
  }

  try {
    // Open problem
    console.log('1. Opening problem...');
    await browser.open(url);
    await browser.waitForLoad();
    await new Promise(r => setTimeout(r, 3000));

    const title = await leetcode.getProblemTitle();
    let description = browser.getDescriptionContent();
    if (description && typeof description.then === 'function') {
      description = await description;
    }
    console.log(`   Title: ${title}`);
    console.log(`   Description: ${description ? description.substring(0, 200) + '...' : 'NOT FOUND'}\n`);

    if (!description) {
      console.log('Failed to get problem description');
      return false;
    }

    // Select language
    console.log(`2. Selecting ${selectedLanguage}...`);
    let langResult2 = browser.selectLanguage(selectedLanguage);
    if (langResult2 && typeof langResult2.then === 'function') {
      langResult2 = await langResult2;
    }
    console.log(`   Result: ${langResult2}\n`);
    await new Promise(r => setTimeout(r, 1000));

    // Generate solution
    console.log('3. Generating solution...');
    let code = await solver.generateSolution(description, selectedLanguage);
    if (!code) {
      console.log('Failed to generate solution');
      return false;
    }
    console.log(`   Generated ${code.length} chars\n`);

    // Fill + submit with up to 3 fix attempts
    let result;
    const MAX_FIX = 3;
    for (let fix = 0; fix <= MAX_FIX; fix++) {
      console.log(`4. Filling code (attempt ${fix + 1})...`);
      browser.fillCode(code);
      await new Promise(r => setTimeout(r, 500));

      console.log('5. Submitting...');
      browser.clickSubmit();

      console.log('6. Waiting for result (up to 60s)...');
      result = await browser.waitForSubmissionResult();
      console.log(`\n   Result: ${result}\n`);

      if (result === 'success') break;
      if (result === 'not_logged_in') break;

      if (fix < MAX_FIX) {
        const errDetails = browser.getSubmissionError();
        let errMsg = result;
        if (errDetails) {
          if (errDetails.errorText) errMsg += `\n${errDetails.errorText}`;
          if (errDetails.output) errMsg += `\nActual output: ${errDetails.output}`;
          if (errDetails.expected) errMsg += `\nExpected: ${errDetails.expected}`;
        }
        const fixed = await solver.fixSolution(code, errMsg, description, selectedLanguage);
        if (fixed && solver.validateCode(fixed)) {
          code = fixed;
        } else break;
      }
    }

    if (result === 'success') {
      console.log('================================');
      console.log('SUCCESS!');
      console.log('================================');

      // Close the problem tab (only if there are multiple tabs)
      const tabs2 = browser.listTabs();
      if (tabs2 && tabs2.includes('\n')) {
        console.log('\n7. Closing problem tab...');
        try { browser.closeTab(0); } catch (e) { console.log('   Close tab skipped:', e.message); }
      }
    } else if (result === 'not_logged_in') {
      console.log('Not logged in - please log in to LeetCode CN at https://leetcode.cn first.');
    }

    return result === 'success';

  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

// Main entry point
// Parse arguments
const otherArgs = [];
for (let i = 0; i < remainingArgs.length; i++) {
  const arg = remainingArgs[i];
  if (arg === '--lang' && i + 1 < remainingArgs.length) {
    selectedLanguage = remainingArgs[i + 1];
    i++;
  } else if (arg.startsWith('--lang=')) {
    selectedLanguage = arg.substring(7);
  } else if (arg === '-l' && i + 1 < remainingArgs.length) {
    selectedLanguage = remainingArgs[i + 1];
    i++;
  } else {
    otherArgs.push(arg);
  }
}

if (otherArgs.includes('--help') || otherArgs.includes('-h')) {
  console.log(`
LeetCode Auto Solver

Usage:
  node src/index.js [options] [url/slug]

Options:
  --once, -o                 Solve one random problem
  --continuous, -c            Run continuously (infinite loop)
  --lang, -l <language>      Set programming language (default: python3)
  --browser <type>            Browser to use (default: agent-browser)
  --test                     Test browser connection

Languages:
  python3, java, cpp, javascript, typescript, go, kotlin, swift, rust, ruby, php

Examples:
  node src/index.js                        # Auto-solve (5 attempts)
  node src/index.js --once                 # Solve one random problem
  node src/index.js --continuous           # Run forever
  node src/index.js --continuous -l java   # Continuous with Java
  node src/index.js two-sum                # Solve specific problem
  node src/index.js https://leetcode.cn/problems/two-sum/
  node src/index.js --lang java            # Use Java
  node src/index.js --once --lang cpp     # One problem with C++
  `);
  process.exit(0);
}

if (otherArgs.includes('--test')) {
  console.log('Testing browser connection...');
  (async () => {
    await browser.open(browser.LEETCODE_URL);
    console.log('Browser test successful!');
    if (browser.close) await browser.close();
  })().then(() => process.exit(0)).catch(e => {
    console.error('Browser test failed:', e.message);
    process.exit(1);
  });
}

if (otherArgs.includes('--once') || otherArgs.includes('-o')) {
  autoSolve(1).then(success => {
    process.exit(success ? 0 : 1);
  });
} else if (otherArgs.includes('--continuous') || otherArgs.includes('-c')) {
  autoSolveContinuous().catch(err => {
    console.error('Continuous solver error:', err);
    process.exit(1);
  });
} else if (otherArgs.length > 0) {
  solveOne(otherArgs[0]).then(success => {
    process.exit(success ? 0 : 1);
  });
} else {
  autoSolve(5).then(success => {
    process.exit(success ? 0 : 1);
  });
}
