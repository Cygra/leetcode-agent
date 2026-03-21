#!/usr/bin/env node
/**
 * Tests for solver.js:
 * 1. generateSolution returns valid Python code
 * 2. fixSolution improves code given an error message
 */

const solver = require('../src/solver');

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

async function testGenerateSolution() {
  console.log('\n[Test] generateSolution');
  const desc = '给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出和为目标值 target 的那两个整数，并返回它们的数组下标。';
  const code = await solver.generateSolution(desc, 'python3');
  assert(code !== null && code !== undefined, 'returns non-null');
  assert(typeof code === 'string', 'returns string');
  assert(code.length > 30, 'code is non-trivial', `length=${code ? code.length : 0}`);
  assert(!code.includes('```'), 'no markdown backticks');
  assert(code.includes('def '), 'contains a function def');
  assert(solver.validateCode(code), 'validateCode passes');
  console.log('  Generated code preview:', code.substring(0, 80).replace(/\n/g, '|'));
}

async function testFixSolution() {
  console.log('\n[Test] fixSolution');
  const desc = '给定一个整数数组 nums 和一个整数目标值 target，返回下标。';
  const brokenCode = 'class Solution:\n    def twoSum(self, nums, target):\n        return [0]  # wrong';
  const errorMsg = '解答错误: 输入 nums=[2,7,11,15] target=9, 输出 [0], 预期 [0,1]';
  const fixed = await solver.fixSolution(brokenCode, errorMsg, desc, 'python3');
  assert(fixed !== null && fixed !== undefined, 'returns non-null');
  assert(typeof fixed === 'string', 'returns string');
  assert(fixed.length > 30, 'fixed code is non-trivial');
  assert(!fixed.includes('```'), 'no markdown backticks');
  assert(solver.validateCode(fixed), 'validateCode passes');
  // Should not return the exact same broken code
  assert(fixed !== brokenCode, 'code was modified');
  console.log('  Fixed code preview:', fixed.substring(0, 80).replace(/\n/g, '|'));
}

async function main() {
  console.log('=== solver.test.js ===');
  await testGenerateSolution();
  await testFixSolution();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Test error:', e); process.exit(1); });
