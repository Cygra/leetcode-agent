#!/usr/bin/env node

const { execSync } = require('child_process');
const OpenAI = require('openai');

const GITHUB_MODELS_URL = 'https://models.inference.ai.azure.com';
const DEFAULT_MODEL = 'gpt-4o-mini';

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

/**
 * Get GitHub token from environment or gh CLI
 */
function getGithubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync('gh auth token', { encoding: 'utf-8' }).trim();
  } catch {
    throw new Error('No GitHub token found. Run: gh auth login');
  }
}

function createClient() {
  return new OpenAI({
    baseURL: GITHUB_MODELS_URL,
    apiKey: getGithubToken()
  });
}

function stripMarkdown(code) {
  return code.trim()
    .replace(/^```[\w]*\n?/i, '')
    .replace(/\n?```$/,  '')
    .trim();
}

async function callApi(messages, maxRetries = 3) {
  const client = createClient();
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) console.log(`Retry ${attempt + 1}/${maxRetries}...`);
    try {
      const resp = await client.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
        max_tokens: 4096,
        temperature: 0.2
      });
      const content = resp.choices?.[0]?.message?.content || '';
      return stripMarkdown(content);
    } catch (e) {
      console.error('API error:', e.message);
      if (attempt === maxRetries - 1) throw e;
    }
  }
  return null;
}

/**
 * Generate a fresh solution for a LeetCode problem
 */
async function generateSolution(description, language = 'python3') {
  console.log(`Generating ${language} solution...`);
  const lang = LANG_MAP[language.toLowerCase()] || language;
  const messages = [
    {
      role: 'system',
      content: `You are an expert competitive programmer. Return ONLY raw ${lang} code with no explanation, no markdown, no backticks. The code must be complete and directly runnable as a LeetCode submission.`
    },
    {
      role: 'user',
      content: `Solve this LeetCode problem in ${lang}:\n\n${description}`
    }
  ];
  const code = await callApi(messages);
  if (code) console.log(`Solution generated (${code.length} chars)`);
  return code;
}

/**
 * Fix a solution given the submission error feedback
 */
async function fixSolution(code, errorMessage, description, language = 'python3') {
  console.log(`Fixing ${language} solution based on error...`);
  const lang = LANG_MAP[language.toLowerCase()] || language;
  const messages = [
    {
      role: 'system',
      content: `You are an expert competitive programmer. Return ONLY raw ${lang} code with no explanation, no markdown, no backticks. The code must be complete and directly runnable as a LeetCode submission.`
    },
    {
      role: 'user',
      content: `This ${lang} LeetCode solution has an error. Fix it.\n\nProblem:\n${description}\n\nCurrent code:\n${code}\n\nError/failure:\n${errorMessage}\n\nReturn ONLY the fixed code.`
    }
  ];
  const fixed = await callApi(messages);
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

