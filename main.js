/**
 * What's your type? — Client-side logic
 *
 * index.html: handles form submission and API call
 * results.html: reads stored results and renders them
 */

const STORAGE_KEY = 'whatsYourTypeResults';

// ============================================
// Page detection
// ============================================

const isInputPage = document.getElementById('analyze-form') !== null;
const isResultsPage = document.getElementById('results') !== null;

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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const conversation = document.getElementById('conversation').value.trim();

    // TODO: Add client-side validation beyond required attribute
    if (!conversation) {
      showError(errorMessage, 'Please paste a conversation to analyze.');
      return;
    }

    hideError(errorMessage);
    setLoading(submitBtn, true);

    try {
      const results = await analyzeConversation(conversation);

      // TODO: Validate response shape before storing
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(results));

      window.location.href = 'results.html';
    } catch (error) {
      // TODO: Handle specific error codes (rate limit, invalid input, etc.)
      showError(errorMessage, error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/**
 * Send conversation to the Vercel API proxy.
 * @param {string} conversation
 * @returns {Promise<object>} Parsed analysis results
 */
async function analyzeConversation(conversation) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Analysis failed.');
  }

  // TODO: Map API response to the shape expected by renderResults()
  return data;
}

// ============================================
// Results page (results.html)
// ============================================

function initResultsPage() {
  const loadingEl = document.getElementById('results-loading');
  const contentEl = document.getElementById('results-content');
  const emptyEl = document.getElementById('results-empty');

  const raw = sessionStorage.getItem(STORAGE_KEY);

  loadingEl.hidden = true;

  if (!raw) {
    emptyEl.hidden = false;
    return;
  }

  try {
    const results = JSON.parse(raw);

    // TODO: Validate stored results shape
    renderResults(results);
    contentEl.hidden = false;
  } catch {
    emptyEl.hidden = false;
  }
}

/**
 * Render analysis results into the DOM.
 * @param {{ label: string, description: string, traits: string[] }} results
 */
function renderResults(results) {
  document.getElementById('type-label').textContent = results.label ?? '';
  document.getElementById('type-description').textContent = results.description ?? '';

  const traitsList = document.getElementById('type-traits');
  traitsList.innerHTML = '';

  // TODO: Customize how traits (or other fields) are displayed
  (results.traits ?? []).forEach((trait) => {
    const li = document.createElement('li');
    li.textContent = trait;
    traitsList.appendChild(li);
  });
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

function setLoading(button, isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Analyzing…' : 'Analyze';
}
