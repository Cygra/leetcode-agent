#!/usr/bin/env node

const { execFile } = require('child_process');

const LANG_MAP = {
  'python3': 'Python', 'python': 'Python',
  'java': 'Java', 'cpp': 'C++', 'c++': 'C++',
  'javascript': 'JavaScript', 'js': 'JavaScript',
  'typescript': 'TypeScript', 'ts': 'TypeScript',
  'go': 'Go', 'golang': 'Go',
  'kotlin': 'Kotlin', 'swift': 'Swift',
  'rust': 'Rust', 'ruby': 'Ruby',
  'php': 'PHP', 'csharp': 'C#', 'c#': 'C#'
};

function stripMarkdown(code) {
  return code.trim()
    .replace(/^```[\w]*\n?/i, '')
    .replace(/\n?```$/,  '')
    .trim();
}

function callClaude(prompt, maxRetries = 3) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    function tryOnce() {
      if (attempt > 0) console.log(`Retry ${attempt + 1}/${maxRetries}...`);
      attempt++;

      const proc = execFile('claude', ['-p', '--output-format', 'text'], (err, stdout, stderr) => {
        if (err) {
          console.error('claude error:', err.message);
          if (attempt < maxRetries) return tryOnce();
          return reject(err);
        }
        resolve(stripMarkdown(stdout));
      });

      proc.stdin.write(prompt);
      proc.stdin.end();
    }

    tryOnce();
  });
}

/**
 * Generate a fresh solution for a LeetCode problem
 */
async function generateSolution(description, language = 'python3') {
  console.log(`Generating ${language} solution...`);
  const lang = LANG_MAP[language.toLowerCase()] || language;
  const prompt = `You are an expert competitive programmer. Return ONLY raw ${lang} code with no explanation, no markdown, no backticks. The code must be complete and directly runnable as a LeetCode submission.\n\nSolve this LeetCode problem in ${lang}:\n\n${description}`;
  const code = await callClaude(prompt);
  if (code) console.log(`Solution generated (${code.length} chars)`);
  return code;
}

/**
 * Fix a solution given the submission error feedback
 */
async function fixSolution(code, errorMessage, description, language = 'python3') {
  console.log(`Fixing ${language} solution based on error...`);
  const lang = LANG_MAP[language.toLowerCase()] || language;
  const prompt = `You are an expert competitive programmer. Return ONLY raw ${lang} code with no explanation, no markdown, no backticks. The code must be complete and directly runnable as a LeetCode submission.\n\nThis ${lang} LeetCode solution has an error. Fix it.\n\nProblem:\n${description}\n\nCurrent code:\n${code}\n\nError/failure:\n${errorMessage}\n\nReturn ONLY the fixed code.`;
  const fixed = await callClaude(prompt);
  if (fixed) console.log(`Fixed solution generated (${fixed.length} chars)`);
  return fixed;
}

/**
 * Basic validation that the code looks usable
 */
function validateCode(code) {
  if (!code || typeof code !== 'string') return false;
  if (code.length < 20) return false;
  if (code.startsWith('Error:') || code.startsWith('Sorry')) return false;
  return true;
}

module.exports = { generateSolution, fixSolution, validateCode };
