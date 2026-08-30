// worker.js — deployed to Cloudflare Workers (free tier).
// Holds the Groq API key as a secret, builds the tutor prompt from the
// learner's progress state, calls Groq, and returns clean JSON.
//
// Set the secret with: wrangler secret put GROQ_API_KEY

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

// Restrict this to your actual GitHub Pages origin once deployed, e.g.
// 'https://yourusername.github.io'
const ALLOWED_ORIGIN = '*';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function buildSystemPrompt(progress) {
  return `You are Sounder, a patient, encouraging morse code tutor inside a chat app.

The learner drives their own lesson plan — they ask what they want to learn or practice next.
You decide, based on their message and their progress data below, what to teach, quiz, or explain.

LEARNER PROGRESS (JSON, character -> {introduced, attempts, correct}):
${JSON.stringify(progress.chars)}

Current mode: ${progress.mode}
Recent turns: ${JSON.stringify(progress.recentHistory)}

RULES:
- Keep replies short and conversational (2-5 sentences), like a real tutor texting, not a textbook.
- When you want the learner to hear/see morse for a letter, word, or practice phrase, put the raw
  morse strings (dots/dashes, letters separated by spaces, "/" for word breaks) in the "morse" array.
  Do NOT try to describe timing yourself — the app plays it.
- When the learner answers a quiz question correctly or incorrectly, or you introduce a new character,
  update "progressPatch.chars" with ONLY the characters that changed, e.g.
  {"E": {"introduced": true, "attempts": 3, "correct": 2}}.
- Set "progressPatch.mode" if the lesson mode should change: "learn", "quiz", "decode_practice", "send_practice".
- Never invent morse codes — use standard international morse only.
- If the learner seems to want a fully open-ended chat unrelated to morse, gently steer back.

RESPOND WITH ONLY VALID JSON, NO MARKDOWN FENCES, NO PREAMBLE, in this exact shape:
{
  "message": "string, what you say to the learner",
  "morse": ["optional", "array of morse strings"],
  "progressPatch": { "mode": "optional string", "chars": { "OPTIONAL_CHAR": {"introduced": true, "attempts": 1, "correct": 1} } }
}`;
}

function safeParseModelJson(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // fallback: surface the raw text so the conversation doesn't just break
    return { message: raw, morse: [], progressPatch: {} };
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const { message, progress } = body;
    if (!message || !progress) {
      return new Response(JSON.stringify({ error: 'Missing message or progress' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const systemPrompt = buildSystemPrompt(progress);

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.6,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return new Response(JSON.stringify({ error: 'Groq API error', detail: errText }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    const groqData = await groqRes.json();
    const rawText = groqData.choices?.[0]?.message?.content || '{}';
    const parsed = safeParseModelJson(rawText);

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  }
};
