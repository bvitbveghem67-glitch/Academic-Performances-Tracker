import fs from 'fs';
import path from 'path';

function getApiKey() {
  const candidates = [];

  // Check .env files first
  for (const f of ['.env', '.env.local', '.env.example']) {
    try {
      const c = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
      const m = c.match(/GEMINI_API_KEY\s*=\s*([^\r\n]+)/);
      if (m && m[1]) {
        const val = m[1].trim().replace(/^['"]|['"]$/g, '');
        if (val && val !== 'MY_GEMINI_API_KEY') candidates.push(val);
      }
    } catch {}
  }

  // Check /app/.dev.env.json
  try {
    const devEnv = JSON.parse(fs.readFileSync('/app/.dev.env.json', 'utf8'));
    if (devEnv.GEMINI_API_KEY && devEnv.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
      candidates.push(devEnv.GEMINI_API_KEY.trim());
    }
  } catch {}

  // Check process.env
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    candidates.push(process.env.GEMINI_API_KEY.trim());
  }

  candidates.push('GEMINI_API_KEY');



async function callGemini(prompt, history = [], apiKey) {
  // 1. Try @google/genai SDK
  try {
    const { GoogleGenAI } = await import('@google/genai');
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
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const systemInstruction =
      'You are a calm, patient academic study coach. Help the student understand concepts, study their weaker topics, and test their recall. Keep responses focused, encouraging, and clear without robotic jargon or excessive formatting. When quizzing, ask 1 or 2 clear questions at a time and explain answers simply.';

    try {
      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: { systemInstruction },
      });
      if (res?.text) return res.text;
    } catch {
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: { systemInstruction },
      });
      if (res?.text) return res.text;
    }
  } catch (sdkError) {
    console.warn('SDK unavailable, falling back to direct REST fetch:', sdkError.message);
  }

  // 2. Direct REST fallback (native fetch, zero dependencies)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
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
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: {
        parts: [{ text: 'You are a calm, patient academic study coach. Help the student understand concepts, study their weaker topics, and test their recall. Keep responses focused, encouraging, and clear.' }],
      },
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || 'Gemini API error');
  }

  const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidate) throw new Error('No response text received from Gemini.');
  return candidate;
}

async function parseIncoming(reqOrEvent) {
  if (reqOrEvent && reqOrEvent.body && typeof reqOrEvent.body === 'object' && !('json' in reqOrEvent)) {
    return {
      method: (reqOrEvent.method || 'POST').toUpperCase(),
      body: reqOrEvent.body,
    };
  }

  if (reqOrEvent && typeof reqOrEvent.json === 'function') {
    let body = {};
    try {
      body = await reqOrEvent.json();
    } catch {
      body = {};
    }
    return {
      method: (reqOrEvent.method || 'POST').toUpperCase(),
      body,
    };
  }

  let body = {};
  if (reqOrEvent && reqOrEvent.body) {
    if (typeof reqOrEvent.body === 'string') {
      try {
        body = JSON.parse(reqOrEvent.body);
      } catch {
        body = {};
      }
    } else if (typeof reqOrEvent.body === 'object') {
      body = reqOrEvent.body;
    }
  }

  return {
    method: (reqOrEvent?.httpMethod || reqOrEvent?.method || 'POST').toUpperCase(),
    body,
  };
}

function respond(reqOrEvent, context, data, status = 200) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Express server
  if (context && typeof context.status === 'function' && typeof context.json === 'function') {
    return context.status(status).json(data);
  }

  // Netlify v2 (Standard Web Request)
  if (reqOrEvent && typeof reqOrEvent.json === 'function') {
    return new Response(JSON.stringify(data), {
      status,
      headers,
    });
  }

  // Netlify v1 (AWS Lambda event format)
  return {
    statusCode: status,
    headers,
    body: JSON.stringify(data),
  };
}

async function chatService(reqOrEvent, context) {
  const { method, body } = await parseIncoming(reqOrEvent);

  if (method === 'OPTIONS') {
    return respond(reqOrEvent, context, {}, 200);
  }

  if (method !== 'POST') {
    return respond(reqOrEvent, context, { error: 'Method not allowed' }, 405);
  }

  try {
    const { message, history = [], context: studyContext = {} } = body || {};

    if (!message && !studyContext.weakestTopics) {
      return respond(reqOrEvent, context, { error: 'Message or topic context is required.' }, 400);
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return respond(
        reqOrEvent,
        context,
        { error: 'GEMINI_API_KEY is not configured in Netlify environment variables.' },
        503
      );
    }

    let currentPrompt = message || '';
    if (studyContext.weakestTopics && studyContext.weakestTopics.length > 0) {
      const topicsStr = studyContext.weakestTopics
        .map((t) => `${t.name} (${t.grade}%)`)
        .join(', ');
      currentPrompt = `[Context: Student's lower-scoring topics: ${topicsStr}]\n\n${currentPrompt}`;
    }

    const reply = await callGemini(currentPrompt, history, apiKey);
    return respond(reqOrEvent, context, { response: reply }, 200);
  } catch (err) {
    let errorMsg = err.message || 'Error generating study advice.';
    try {
      const parsed = JSON.parse(errorMsg);
      if (parsed?.error?.message) errorMsg = parsed.error.message;
    } catch {}
    return respond(reqOrEvent, context, { error: errorMsg }, 500);
  }
}

// Netlify v1 handler
export const handler = chatService;

// Netlify v2 / Express default export
export default chatService;
