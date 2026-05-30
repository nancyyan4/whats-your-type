/**
 * Vercel serverless function — Claude API proxy
 *
 * POST /api/analyze
 * Body: { characters: string[], notes?: string }
 *
 * Requires env var: ANTHROPIC_API_KEY
 */

const MODEL = 'claude-sonnet-4-20250514';
const MAX_CHARACTERS = 10;
const MAX_CHARACTER_LENGTH = 100;
const MAX_NOTES_LENGTH = 500;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { characters, notes } = req.body ?? {};

  const validationError = validateInput(characters, notes);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const sanitizedCharacters = characters
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, MAX_CHARACTERS);

  const sanitizedNotes =
    typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, MAX_NOTES_LENGTH) : null;

  try {
    const prompt = buildPrompt(sanitizedCharacters, sanitizedNotes);

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errorBody = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errorBody);
      return res.status(502).json({ error: 'Analysis service unavailable' });
    }

    const claudeData = await claudeResponse.json();
    const results = parseClaudeResponse(claudeData);

    if (!results) {
      return res.status(502).json({ error: 'Could not parse analysis results' });
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('Analyze error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @param {unknown} characters
 * @param {unknown} notes
 * @returns {string | null}
 */
function validateInput(characters, notes) {
  if (!Array.isArray(characters) || characters.length === 0) {
    return 'Missing or invalid characters — provide a non-empty list of names';
  }

  if (characters.length > MAX_CHARACTERS) {
    return `Too many characters — maximum is ${MAX_CHARACTERS}`;
  }

  for (const name of characters) {
    if (typeof name !== 'string' || !name.trim()) {
      return 'Each character must be a non-empty string';
    }
    if (name.trim().length > MAX_CHARACTER_LENGTH) {
      return `Character names must be ${MAX_CHARACTER_LENGTH} characters or fewer`;
    }
  }

  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return 'Notes must be a string';
  }

  if (typeof notes === 'string' && notes.length > MAX_NOTES_LENGTH) {
    return `Notes must be ${MAX_NOTES_LENGTH} characters or fewer`;
  }

  return null;
}

/**
 * @param {string[]} characters
 * @param {string | null} notes
 * @returns {string}
 */
function buildPrompt(characters, notes) {
  const characterList = characters.map((name, i) => `${i + 1}. ${name}`).join('\n');

  const notesSection = notes
    ? `\nThe user added these notes about their picks:\n"""${notes}"""\n`
    : '';

  return `You are a witty, pop-culture-savvy relationship analyst for a fun quiz called "What's your type?" A user has listed fictional characters they have a crush on. Your job is to read the tea leaves and tell them what their choices reveal about their romantic type.

Be playful, sharp, and affectionate — like a best friend who's also obsessed with personality typology. Not clinical, not preachy. Roast them gently if warranted. Make them laugh while still feeling seen.

Characters they chose:
${characterList}
${notesSection}
Analyze what these choices say about the user's romantic type. For each character, infer their most likely MBTI type (use standard four-letter codes). Look for patterns across the roster — what keeps showing up? What does this person clearly go for, and what might that mean for their real-life love life?

Return ONLY valid JSON — no markdown fences, no preamble — in exactly this shape:

{
  "title": "A fun, specific type label like 'The Brooding Intellectual' or 'Chaos Gremlin Collector'",
  "summary": "2-3 witty sentences summarizing their romantic type and what draws them in",
  "characters": [
    {
      "name": "Character name exactly as provided",
      "mbti": "XXXX",
      "blurb": "One witty sentence on why this character fits their type"
    }
  ],
  "patterns": [
    "A recurring personality pattern you spotted across their picks",
    "Another pattern",
    "A third pattern if there is one"
  ],
  "greenFlags": [
    "A positive trait their taste suggests they value in partners",
    "Another green flag"
  ],
  "redFlags": [
    "A playful warning about a pattern that might cause drama",
    "Another red flag",
    "A third red flag if warranted"
  ]
}

Rules:
- Include every character from the list in the "characters" array
- "patterns" should have at least 2 entries
- "greenFlags" must have exactly 2 entries
- "redFlags" must have 2 or 3 entries
- Keep blurbs and flags concise and punchy`;
}

/**
 * @param {object} claudeData
 * @returns {object | null}
 */
function parseClaudeResponse(claudeData) {
  const text = claudeData.content?.[0]?.text ?? '';
  if (!text) return null;

  const jsonText = extractJson(text);

  try {
    const parsed = JSON.parse(jsonText);
    return normalizeResults(parsed);
  } catch {
    console.error('Failed to parse Claude JSON:', text.slice(0, 500));
    return null;
  }
}

/**
 * Strip markdown code fences if Claude wraps the JSON.
 * @param {string} text
 * @returns {string}
 */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return text.slice(start, end + 1);
  }

  return text.trim();
}

/**
 * Ensure the response has the expected shape.
 * @param {object} raw
 * @returns {object}
 */
function normalizeResults(raw) {
  return {
    title: String(raw.title ?? 'Mystery Type'),
    summary: String(raw.summary ?? ''),
    characters: Array.isArray(raw.characters)
      ? raw.characters.map((c) => ({
          name: String(c.name ?? ''),
          mbti: String(c.mbti ?? ''),
          blurb: String(c.blurb ?? ''),
        }))
      : [],
    patterns: Array.isArray(raw.patterns) ? raw.patterns.map(String) : [],
    greenFlags: Array.isArray(raw.greenFlags) ? raw.greenFlags.map(String).slice(0, 2) : [],
    redFlags: Array.isArray(raw.redFlags) ? raw.redFlags.map(String).slice(0, 3) : [],
  };
}
