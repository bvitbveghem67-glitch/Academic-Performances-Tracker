import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

function getApiKey() {
  let k = process.env.GEMINI_API_KEY;
  if (k && k !== 'MY_GEMINI_API_KEY' && k.trim()) return k.trim();
  try {
    const devEnv = JSON.parse(fs.readFileSync('/app/.dev.env.json', 'utf8'));
    if (devEnv.GEMINI_API_KEY && devEnv.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && devEnv.GEMINI_API_KEY.trim()) {
      return devEnv.GEMINI_API_KEY.trim();
    }
  } catch {}
  for (const f of ['.env', '.env.local', '.env.example']) {
    try {
      const c = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
      const m = c.match(/GEMINI_API_KEY\s*=\s*([^\r\n]+)/);
      if (m && m[1]) {
        const val = m[1].trim().replace(/^['"]|['"]$/g, '');
        if (val && val !== 'MY_GEMINI_API_KEY') return val;
      }
    } catch {}
  }
  return null;
}

async function generateStudyResponse(body) {
  const { message, history = [], context = {} } = body || {};

  if (!message && !context.weakestTopics) {
    throw new Error('Message or topic context is required.');
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. In Netlify, go to Site configuration > Environment variables and add GEMINI_API_KEY.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const contents = [];
  if (Array.isArray(history)) {
    for (const turn of history.slice(-8)) {
      if (turn.role && turn.text) {
        contents.push({
          role: turn.role === 'user' ? 'user' : 'model',
          parts: [{ text: turn.text }],
        });
      }
    }
  }

  let currentPrompt = message || '';
  if (context.weakestTopics && context.weakestTopics.length > 0) {
    const topicsStr = context.weakestTopics
      .map((t) => `${t.name} (${t.grade}%)`)
      .join(', ');
    currentPrompt = `[Context: Student's lower-scoring topics: ${topicsStr}]\n\n${currentPrompt}`;
  }

  contents.push({
    role: 'user',
    parts: [{ text: currentPrompt }],
  });

  const systemInstruction =
    'You are a calm, patient academic study coach. Help the student understand concepts, study their weaker topics, and test their recall. Keep responses focused, encouraging, and clear without robotic jargon or excessive formatting. When quizzing, ask 1 or 2 clear questions at a time and explain answers simply.';

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: { systemInstruction },
    });
  } catch (primaryErr) {
    if (primaryErr.message && (primaryErr.message.includes('503') || primaryErr.message.includes('UNAVAILABLE'))) {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: { systemInstruction },
      });
    } else {
      throw primaryErr;
    }
  }

  return response.text;
}

// Netlify classic handler
export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    let body = {};
    if (event.body) {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    }
    const reply = await generateStudyResponse(body);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ response: reply }),
    };
  } catch (err) {
    let errorMsg = err.message || 'Error generating study advice.';
    try {
      const parsed = JSON.parse(errorMsg);
      if (parsed?.error?.message) errorMsg = parsed.error.message;
    } catch {}
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: errorMsg }),
    };
  }
};

// Also support Netlify v2 & default export for Express
export default async function (req, context) {
  // If called by Express server
  if (context && typeof context.status === 'function' && typeof context.json === 'function') {
    const res = context;
    try {
      const reply = await generateStudyResponse(req.body);
      return res.json({ response: reply });
    } catch (err) {
      let errorMsg = err.message || 'Error generating study advice.';
      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed?.error?.message) errorMsg = parsed.error.message;
      } catch {}
      return res.status(500).json({ error: errorMsg });
    }
  }

  // If called as Netlify v2 Web Request
  if (req instanceof Request || (req && typeof req.json === 'function')) {
    if (req.method === 'OPTIONS') {
      return new Response('', {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
    }
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    try {
      const body = await req.json();
      const reply = await generateStudyResponse(body);
      return new Response(JSON.stringify({ response: reply }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      let errorMsg = err.message || 'Error generating study advice.';
      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed?.error?.message) errorMsg = parsed.error.message;
      } catch {}
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  return handler(req, context);
}
