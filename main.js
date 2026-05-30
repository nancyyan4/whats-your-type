/**
 * What's your type? — Client-side logic
 *
 * index.html: handles form submission and API call
 * results.html: reads stored results and renders them
 */

const STORAGE_KEY = 'whatsYourTypeResults';

const isInputPage = document.getElementById('analyze-form') !== null;
const isResultsPage = document.getElementById('results-content') !== null;

/** @type {object | null} */
let currentResults = null;

if (isInputPage) {
  initInputPage();
}

if (isResultsPage) {
  initResultsPage();
}

// ============================================
// Input page (index.html)
// ============================================

function initInputPage() {
  const form = document.getElementById('analyze-form');
  const submitBtn = document.getElementById('submit-btn');
  const errorMessage = document.getElementById('error-message');
  const loadingOverlay = document.getElementById('loading-overlay');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const charactersRaw = document.getElementById('characters').value.trim();
    const notes = document.getElementById('notes').value.trim();

    const characters = parseCharacters(charactersRaw);

    if (characters.length === 0) {
      showError(errorMessage, 'Add at least one character name, separated by commas.');
      return;
    }

    hideError(errorMessage);
    setLoading(submitBtn, loadingOverlay, true);

    try {
      const results = await analyzeCharacters(characters, notes || undefined);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(results));
      window.location.href = 'results.html';
    } catch (error) {
      showError(errorMessage, error.message || 'Something went wrong. Please try again.');
      setLoading(submitBtn, loadingOverlay, false);
    }
  });
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
function parseCharacters(raw) {
  return raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * @param {string[]} characters
 * @param {string | undefined} notes
 * @returns {Promise<object>}
 */
async function analyzeCharacters(characters, notes) {
  const body = { characters };
  if (notes) body.notes = notes;

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Analysis failed.');
  }

  return data;
}

// ============================================
// Results page (results.html)
// ============================================

function initResultsPage() {
  const contentEl = document.getElementById('results-content');
  const emptyEl = document.getElementById('results-empty');
  const copyBtn = document.getElementById('copy-btn');

  const raw = sessionStorage.getItem(STORAGE_KEY);

  if (!raw) {
    emptyEl.hidden = false;
    return;
  }

  try {
    const results = JSON.parse(raw);
    currentResults = results;
    renderResults(results);
    contentEl.hidden = false;

    copyBtn.addEventListener('click', handleCopyResults);
  } catch {
    emptyEl.hidden = false;
  }
}

/**
 * @param {{
 *   title?: string,
 *   summary?: string,
 *   characters?: { name: string, mbti: string, blurb: string }[],
 *   greenFlags?: string[],
 *   redFlags?: string[]
 * }} results
 */
function renderResults(results) {
  document.getElementById('type-title').textContent = results.title ?? 'Mystery Type';
  document.getElementById('type-summary').textContent = results.summary ?? '';

  renderMbtiList(results.characters ?? []);
  renderFlagList('green-flags', results.greenFlags ?? []);
  renderFlagList('red-flags', results.redFlags ?? []);
}

/**
 * @param {{ name: string, mbti: string, blurb: string }[]} characters
 */
function renderMbtiList(characters) {
  const list = document.getElementById('mbti-list');
  list.innerHTML = '';

  if (characters.length === 0) {
    const li = document.createElement('li');
    li.className = 'mbti-item mbti-item--empty';
    li.textContent = 'No character breakdown available.';
    list.appendChild(li);
    return;
  }

  characters.forEach((character) => {
    const li = document.createElement('li');
    li.className = 'mbti-item';

    const header = document.createElement('div');
    header.className = 'mbti-item-header';

    const name = document.createElement('span');
    name.className = 'mbti-name';
    name.textContent = character.name;

    const badge = document.createElement('span');
    badge.className = 'mbti-badge';
    badge.textContent = character.mbti;

    header.appendChild(name);
    header.appendChild(badge);

    const blurb = document.createElement('p');
    blurb.className = 'mbti-blurb';
    blurb.textContent = character.blurb;

    li.appendChild(header);
    li.appendChild(blurb);
    list.appendChild(li);
  });
}

/**
 * @param {string} listId
 * @param {string[]} flags
 */
function renderFlagList(listId, flags) {
  const list = document.getElementById(listId);
  list.innerHTML = '';

  flags.forEach((flag) => {
    const li = document.createElement('li');
    li.textContent = flag;
    list.appendChild(li);
  });
}

async function handleCopyResults() {
  if (!currentResults) return;

  const text = formatShareText(currentResults);
  const label = document.getElementById('copy-btn-label');

  try {
    await navigator.clipboard.writeText(text);
    label.textContent = 'Copied!';
    setTimeout(() => {
      label.textContent = 'Copy my results';
    }, 2000);
  } catch {
    label.textContent = 'Copy failed — try again';
    setTimeout(() => {
      label.textContent = 'Copy my results';
    }, 2000);
  }
}

/**
 * @param {{
 *   title?: string,
 *   summary?: string,
 *   characters?: { name: string, mbti: string, blurb: string }[],
 *   greenFlags?: string[],
 *   redFlags?: string[]
 * }} results
 * @returns {string}
 */
function formatShareText(results) {
  const lines = [
    '✨ What\'s your type? ✨',
    '',
    results.title ?? 'Mystery Type',
    '',
    results.summary ?? '',
    '',
  ];

  const characters = results.characters ?? [];
  if (characters.length > 0) {
    lines.push('🧠 MBTI Breakdown');
    characters.forEach((c) => {
      lines.push(`• ${c.name} — ${c.mbti}: ${c.blurb}`);
    });
    lines.push('');
  }

  const greenFlags = results.greenFlags ?? [];
  if (greenFlags.length > 0) {
    lines.push('💚 Green flags');
    greenFlags.forEach((flag) => lines.push(`• ${flag}`));
    lines.push('');
  }

  const redFlags = results.redFlags ?? [];
  if (redFlags.length > 0) {
    lines.push('🚩 Red flags');
    redFlags.forEach((flag) => lines.push(`• ${flag}`));
    lines.push('');
  }

  lines.push('—');
  lines.push('Find your type at What\'s your type?');

  return lines.join('\n');
}

// ============================================
// Helpers
// ============================================

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function hideError(el) {
  el.textContent = '';
  el.hidden = true;
}

function setLoading(button, overlay, isLoading) {
  button.disabled = isLoading;
  button.querySelector('.btn-label').textContent = isLoading ? 'Analyzing…' : 'Reveal my type';
  button.querySelector('.btn-spinner').hidden = !isLoading;

  if (overlay) {
    overlay.hidden = !isLoading;
  }
}
