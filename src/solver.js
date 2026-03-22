#!/usr/bin/env node

const { execFile, execFileSync } = require('child_process');

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
 * Validate syntax before submitting.
 * Returns true if syntax is valid (or language not checkable), false if syntax error.
 */
function validateSyntax(code, language) {
  const lang = language.toLowerCase();
  try {
    if (lang === 'python3' || lang === 'python') {
      execFileSync('python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], {
        input: code,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return true;
    }
    if (lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts') {
      // eslint-disable-next-line no-new-func
      new Function(code);
      return true;
    }
    return true; // skip check for other languages
  } catch {
    return false;
  }
}

/**
 * Generate a fresh solution for a LeetCode problem.
 * Two-step: first analyze the algorithm, then generate code.
 */
async function generateSolution(description, language = 'python3', starterCode = '') {
  console.log(`Generating ${language} solution...`);
  const lang = LANG_MAP[language.toLowerCase()] || language;

  // Step 1: analyze algorithm
  const analysisPrompt = `Analyze this LeetCode problem and briefly describe the optimal algorithm in 1-3 sentences. No code, no examples — just the algorithm idea.\n\nProblem:\n${description}`;
  const analysis = await callClaude(analysisPrompt);
  console.log(`   Algorithm: ${analysis}`);

  // Step 2: generate code using analysis + starter code
  const starterSection = starterCode
    ? `\nStarter code (preserve class name, method name, and parameter names exactly):\n${starterCode}\n`
    : '';
  const codePrompt = `You are an expert competitive programmer. Return ONLY raw ${lang} code with no explanation, no markdown, no backticks. The code must be complete and directly runnable as a LeetCode submission. Do NOT change the class name, method name, or parameter names from the starter code. Do NOT add import statements unless strictly necessary.${starterSection}
Algorithm to implement: ${analysis}

Problem:
${description}`;

  const code = await callClaude(codePrompt);
  if (code) console.log(`Solution generated (${code.length} chars)`);
  return code;
}

/**
 * Fix a solution given the submission error feedback.
 */
async function fixSolution(code, errorMessage, description, language = 'python3', starterCode = '') {
  console.log(`Fixing ${language} solution based on error...`);
  const lang = LANG_MAP[language.toLowerCase()] || language;
  const starterSection = starterCode
    ? `\nStarter code (preserve class name, method name, and parameter names exactly):\n${starterCode}\n`
    : '';
  const prompt = `You are an expert competitive programmer. Return ONLY raw ${lang} code with no explanation, no markdown, no backticks. The code must be complete and directly runnable as a LeetCode submission. Do NOT change the class name, method name, or parameter names from the starter code.${starterSection}
This ${lang} LeetCode solution failed. Fix it.

Problem:
${description}

Current code:
${code}

${errorMessage}

Return ONLY the fixed code.`;

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

module.exports = { generateSolution, fixSolution, validateCode, validateSyntax };
