/**
 * Vercel serverless function — Claude API proxy
 *
 * POST /api/analyze
 * Body: { conversation: string }
 *
 * Requires env var: ANTHROPIC_API_KEY
 */

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { conversation } = req.body ?? {};

  // TODO: Validate and sanitize input (length limits, empty strings, etc.)
  if (!conversation || typeof conversation !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid conversation' });
  }

  try {
    // TODO: Build your prompt and choose model / parameters
    const prompt = buildPrompt(conversation);

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', // TODO: Choose your model
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorBody = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errorBody);
      return res.status(502).json({ error: 'Analysis service unavailable' });
    }

    const claudeData = await claudeResponse.json();

    // TODO: Parse Claude's response into your results shape
    const results = parseClaudeResponse(claudeData);

    return res.status(200).json(results);
  } catch (error) {
    console.error('Analyze error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Build the prompt sent to Claude.
 * @param {string} conversation
 * @returns {string}
 */
function buildPrompt(conversation) {
  // TODO: Write your system / user prompt here
  return `Analyze the following conversation and determine the speaker's communication type.

Conversation:
"""
${conversation}
"""

Respond with JSON only, in this exact shape:
{
  "label": "Type name",
  "description": "One or two sentence summary",
  "traits": ["trait 1", "trait 2", "trait 3"]
}`;
}

/**
 * Extract structured results from Claude's API response.
 * @param {object} claudeData — Raw response from Anthropic Messages API
 * @returns {{ label: string, description: string, traits: string[] }}
 */
function parseClaudeResponse(claudeData) {
  // TODO: Parse the text content from claudeData.content[0].text
  //       Handle malformed JSON gracefully
  const text = claudeData.content?.[0]?.text ?? '';

  try {
    return JSON.parse(text);
  } catch {
    // TODO: Fallback parsing or error handling
    return {
      label: 'Unknown',
      description: text || 'Could not parse analysis.',
      traits: [],
    };
  }
}
