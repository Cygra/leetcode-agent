#!/usr/bin/env node
/**
 * Tests for browser.js submission error detection:
 * 1. Submit wrong code → getSubmissionResult returns 'wrong_answer'
 * 2. getSubmissionError extracts input/output/expected
 * 3. Submit syntax error → detects compilation/runtime error + extracts error text
 * 4. isAlreadySolved detects a previously-accepted problem
 */

const browser = require('../src/browser');

let passed = 0;
let failed = 0;

function assert(condition, name, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testWrongAnswer() {
  console.log('\n[Test] wrong answer detection');
  await browser.open('https://leetcode.cn/problems/two-sum/');
  browser.selectLanguage('python3');
  await wait(500);
  browser.fillCode('class Solution:\n    def twoSum(self, nums, target):\n        return [0]  # wrong');
  browser.clickSubmit();
  const result = await browser.waitForSubmissionResult(30000, 2000);
  assert(result === 'wrong_answer', 'result is wrong_answer', `got: ${result}`);

  const err = browser.getSubmissionError();
  assert(err !== null, 'getSubmissionError returns non-null');
  assert(typeof err.output !== 'undefined', 'has output field', JSON.stringify(err));
  assert(typeof err.expected !== 'undefined', 'has expected field', JSON.stringify(err));
  console.log('  Error details:', JSON.stringify(err));
}

async function testRuntimeError() {
  console.log('\n[Test] runtime/compilation error detection');
  await browser.open('https://leetcode.cn/problems/two-sum/');
  browser.selectLanguage('python3');
  await wait(500);
  browser.fillCode('def wrong syntax ???');
  browser.clickSubmit();
  const result = await browser.waitForSubmissionResult(30000, 2000);
  assert(
    result === 'compilation_error' || result === 'runtime_error' || result.startsWith('runtime_error'),
    'result is a compilation/runtime error', `got: ${result}`
  );

  const err = browser.getSubmissionError();
  assert(err !== null, 'getSubmissionError returns non-null');
  assert(err.errorText && err.errorText.length > 0, 'has errorText', JSON.stringify(err));
  console.log('  Error details:', JSON.stringify(err));
}

async function testIsAlreadySolved() {
  console.log('\n[Test] isAlreadySolved detection');
  // two-sum should now be in our submission history (we submitted above)
  await browser.open('https://leetcode.cn/problems/two-sum/');
  await wait(2000);
  const solved = browser.isAlreadySolved();
  // We can't guarantee it's solved (depends on prior runs), just verify it returns a boolean
  assert(typeof solved === 'boolean', 'isAlreadySolved returns boolean', `got: ${typeof solved} = ${solved}`);
  console.log('  isAlreadySolved:', solved);
}

async function main() {
  console.log('=== submission.test.js ===');
  await testWrongAnswer();
  await testRuntimeError();
  await testIsAlreadySolved();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Test error:', e); process.exit(1); });
