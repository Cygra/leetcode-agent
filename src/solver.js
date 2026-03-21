#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Load Claude API config from settings file
 */
function loadClaudeConfig() {
  const settingsPath = path.join(process.env.HOME, '.claude/settings.json');
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    const env = settings.env || {};
    return {
      baseUrl: env.ANTHROPIC_BASE_URL || '',
      authToken: env.ANTHROPIC_AUTH_TOKEN || '',
      timeoutMs: parseInt(env.API_TIMEOUT_MS) || 300000,
      model: env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
    };
  } catch (e) {
    console.error('Failed to load ~/.claude/settings.json:', e.message);
    return {
      baseUrl: '',
      authToken: '',
      timeoutMs: 300000,
      model: 'claude-3-5-sonnet-20241022'
    };
  }
}

const config = loadClaudeConfig();

// Create Anthropic client
const clientOptions = { apiKey: config.authToken, timeout: config.timeoutMs };
if (config.baseUrl) clientOptions.baseURL = config.baseUrl;
const client = new Anthropic(clientOptions);

/**
 * Generate solution using Claude API
 */
async function generateSolution(problemDescription, language = 'python3', maxRetries = 3) {
  console.log(`Generating ${language} solution...`);

  const langMap = {
    'python3': 'python',
    'python': 'python',
    'java': 'java',
    'cpp': 'c++',
    'c++': 'c++',
    'javascript': 'javascript',
    'js': 'javascript',
    'typescript': 'typescript',
    'ts': 'typescript',
    'go': 'go',
    'golang': 'go',
    'kotlin': 'kotlin',
    'swift': 'swift',
    'rust': 'rust',
    'ruby': 'ruby',
    'php': 'php',
    'csharp': 'c#',
    'c#': 'c#'
  };

  const langName = langMap[language.toLowerCase()] || language;

  // Clean the problem description - remove special Unicode characters that may cause issues
  const cleanedDescription = problemDescription
    .replace(/[\u2000-\u206F\u3000-\u303F\uFF00-\uFFEF\u0080-\u00FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(`Retry attempt ${attempt + 1}/${maxRetries}...`);
    }

    const prompt = `Solve this LeetCode problem. Return ONLY the code solution in ${langName} without any explanation, markdown formatting, or backticks.

Problem Description:
${cleanedDescription}

Requirements:
- Return ONLY the raw code (no markdown, no backticks, no explanation)
- The code should be complete and ready to run
- Use standard library only unless specified
- Include necessary imports
- Handle edge cases

Your response must be ONLY the code itself.`;

    try {
      const message = await client.messages.create({
        model: config.model,
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      console.log('API response received');

      // Extract content from the response - handle thinking blocks
      let content = '';
      let thinkingContent = '';

      if (message.content && Array.isArray(message.content)) {
        for (const block of message.content) {
          if (block.type === 'text' && block.text) {
            content += block.text;
          } else if (block.type === 'thinking') {
            thinkingContent = block.thinking || '';
          }
        }
      } else if (typeof message.content === 'string') {
        content = message.content;
      }

      // Fallback: if no text content found, try to extract code from thinking block
      if (!content && thinkingContent) {
        const codeFenceMatch = thinkingContent.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeFenceMatch && codeFenceMatch[1]) {
          content = codeFenceMatch[1].trim();
        } else {
          const lines = thinkingContent.split('\n');
          let codeLines = [];
          let inCodeBlock = false;
          for (const line of lines) {
            if (line.match(/^\s{4,}/) || line.match(/^\t/)) {
              inCodeBlock = true;
              codeLines.push(line);
            } else if (inCodeBlock && line.trim() === '') {
              codeLines.push(line);
            } else if (inCodeBlock) {
              inCodeBlock = false;
              if (codeLines.length > 3) break;
              codeLines = [];
            }
          }
          if (codeLines.length > 3) content = codeLines.join('\n').trim();
        }
      }

      if (!content) {
        console.error('Empty content in API response');
        continue;
      }

      // Strip markdown formatting if present
      let code = content.trim()
        .replace(/^```\w*\n?/i, '')
        .replace(/\n?```$/, '')
        .trim();

      if (!code) {
        console.error('Empty code after parsing');
        continue;
      }

      console.log(`Solution generated (${code.length} chars)`);
      return code;
    } catch (error) {
      console.error('[SOLVER ERROR]', error.name || 'Error', ':', error.message);
      if (error.status) console.error('[SOLVER ERROR] Status:', error.status);
      if (error.headers) console.error('[SOLVER ERROR] Headers:', error.headers);
      if (error.request_id) console.error('[SOLVER ERROR] Request ID:', error.request_id);
      if (error.stack) console.error('[SOLVER ERROR] Stack:', error.stack);
      // Log API connection errors separately
      if (error.cause) console.error('[SOLVER ERROR] Cause:', error.cause);
    }
  }

  console.error('All retry attempts failed');
  return null;
}

/**
 * Verify code looks valid (basic check)
 */
function validateCode(code) {
  if (!code || typeof code !== 'string') return false;
  if (code.length < 20) return false;
  if (code.includes('Error:') || code.includes('Exception')) return false;
  return true;
}

module.exports = {
  generateSolution,
  validateCode
};
