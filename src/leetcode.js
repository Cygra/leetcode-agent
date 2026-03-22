#!/usr/bin/env node

const browser = require('./browser');

// Helper to await promises
async function maybeAwait(val) {
  if (val && typeof val.then === 'function') {
    return await val;
  }
  return val;
}

/**
 * Find and click the random question button on problemset page
 */
async function clickRandomButton() {
  // Get snapshot to find the button
  const snapshot = await maybeAwait(browser.snapshot());

  // Look for the shuffle button (e257 is typically the random button)
  // Parse snapshot to find button refs near "已解答"
  const lines = snapshot.split('\n');
  let randomBtnRef = null;

  for (const line of lines) {
    // The random button is usually near "114/4262 已解答"
    if (line.includes('button') && line.includes('e25')) {
      const match = line.match(/\[ref=(e\d+)\]/);
      if (match) {
        randomBtnRef = match[1];
        break;
      }
    }
  }

  // Fallback: find by JavaScript
  if (!randomBtnRef) {
    const script = `(function() {
      const btn = document.querySelector('[class*="shuffle"]');
      return btn ? 'found' : 'not found';
    })()`;
    const evalResult = await maybeAwait(browser.evalJs(script));
    if (evalResult === 'found') {
      await maybeAwait(browser.evalJs(`(function() {
        document.querySelector('[class*="shuffle"]').closest('button').click();
      })()`));
      return true;
    }
  }

  if (randomBtnRef) {
    await maybeAwait(browser.click(`@${randomBtnRef}`));
    return true;
  }

  return false;
}

/**
 * Open a random problem - gets slugs from problemset page and picks randomly
 */
async function openRandomProblem(maxAttempts = 5) {
  let errorCount = 0;
  while (true) {
    try {
      // Open the problemset page
      await browser.open(browser.PROBLEMSET_URL);
      await maybeAwait(browser.waitForLoad());
      await new Promise(r => setTimeout(r, 3000));

      // Get problem slugs from the page using evalJs
      let slugs = [];
      try {
        const linksResult = await maybeAwait(browser.evalJs(`
(function() {
  const linkElements = document.querySelectorAll('a[href*="/problems/"]');
  const hrefs = [];
  linkElements.forEach(el => hrefs.push(el.getAttribute('href')));
  return hrefs.join('|||');
})()
        `.trim()));

        if (linksResult) {
          const links = linksResult.split('|||');
          for (const href of links) {
            const match = href.match(/\/problems\/([^\/]+)\//);
            if (match && !slugs.includes(match[1]) && !match[1].includes('problemset')) {
              slugs.push(match[1]);
            }
          }
        }
      } catch (e) {
        console.log('Error getting slugs:', e.message);
      }

      if (slugs.length === 0) {
        console.log('No problems found on page');
        continue;
      }

      // Pick a random slug
      const randomSlug = slugs[Math.floor(Math.random() * slugs.length)];
      console.log(`Selected: ${randomSlug}`);

      // Navigate to the problem
      await browser.open(`${browser.LEETCODE_URL}/problems/${randomSlug}/`);
      await maybeAwait(browser.waitForLoad());
      await new Promise(r => setTimeout(r, 3000));

      const url = await maybeAwait(browser.getUrl());
      if (url.includes('/problems/') && !url.includes('/problemset/')) {
        // Skip locked/premium problems
        if (browser.isLockedProblem()) {
          console.log(`Skipping locked problem: ${randomSlug}`);
          continue;
        }
        // Skip already-solved problems
        if (browser.isAlreadySolved()) {
          console.log(`Skipping already-solved problem: ${randomSlug}`);
          continue;
        }
        const description = await maybeAwait(browser.getDescriptionContent());
        if (description && description.length > 50) {
          // Check difficulty - skip hard problems
          const difficulty = await getProblemDifficulty();
          console.log(`   Difficulty: ${difficulty || 'unknown'}`);
          if (difficulty === 'hard') {
            console.log(`Skipping hard problem: ${randomSlug}`);
            continue;
          }
          if(difficulty === 'medium') {
            console.log(`Skipping medium problem: ${randomSlug}`);
            continue;
          }
          return { url, description, difficulty, success: true };
        } else {
          console.log('Description too short or not found');
        }
      } else {
        console.log('Did not navigate to problem page');
      }
    } catch (e) {
      console.log('Error:', e.message);
      if (++errorCount >= maxAttempts) return { success: false };
    }
  }
}

/**
 * Get problem description from current page
 */
async function getProblemDescription() {
  // Try multiple selectors
  const selectors = [
    '[data-track-load="description_content"]',
    '.question-content',
    '.problem-content',
    '#description',
    '[class*="description"]'
  ];

  for (const selector of selectors) {
    const script = `(function() {
      const el = document.querySelector('${selector}');
      return el ? el.innerText : null;
    })()`;
    const result = await maybeAwait(browser.evalJs(script));
    if (result && result.length > 100) {
      return result;
    }
  }

  return null;
}

/**
 * Get problem difficulty from current page
 * Returns 'easy', 'medium', 'hard', or null if not found
 */
async function getProblemDifficulty() {
  const script = `(function() {
    // Try class-based selectors first
    const selectors = [
      '[class*="text-difficulty-hard"]',
      '[class*="text-difficulty-medium"]',
      '[class*="text-difficulty-easy"]',
      '[class*="difficulty"]',
      '[class*="Difficulty"]',
      '[class*="diff-tag"]',
      '[class*="DiffTag"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText.trim();
        if (text) return text;
      }
    }
    // Fallback: scan all elements for difficulty keywords
    const all = document.querySelectorAll('span, div');
    for (const el of all) {
      const t = el.innerText.trim();
      if (t === '简单' || t === '中等' || t === '困难') return t;
    }
    return null;
  })()`;
  const result = await maybeAwait(browser.evalJs(script));
  if (!result) return null;
  const text = result.trim();
  if (text === '简单') return 'easy';
  if (text === '中等') return 'medium';
  if (text === '困难') return 'hard';
  // English fallback
  const lower = text.toLowerCase();
  if (lower.includes('easy')) return 'easy';
  if (lower.includes('medium')) return 'medium';
  if (lower.includes('hard')) return 'hard';
  return null;
}

async function getProblemTitle() {
  const script = `(function() {
    const titleEl = document.querySelector('h1, [class*="title"]');
    return titleEl ? titleEl.innerText : document.title;
  })()`;
  return await maybeAwait(browser.evalJsValue(script));
}

module.exports = {
  clickRandomButton,
  openRandomProblem,
  getProblemDescription,
  getProblemDifficulty,
  getProblemTitle
};
