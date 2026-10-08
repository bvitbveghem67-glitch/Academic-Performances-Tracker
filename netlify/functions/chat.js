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

function isWebRequest(obj) {
  return !!(obj && typeof obj.json === 'function' && typeof obj.text === 'function');
}

async function extractBody(reqOrEvent) {
  if (!reqOrEvent) return {};
  if (reqOrEvent.body && typeof reqOrEvent.body === 'object') {
    return reqOrEvent.body;
  }
  if (typeof reqOrEvent.body === 'string') {
    try {
      return JSON.parse(reqOrEvent.body);
    } catch {
      return {};
    }
  }
  if (typeof reqOrEvent.json === 'function') {
    try {
      return await reqOrEvent.json();
    } catch {}
  }
  if (typeof reqOrEvent.text === 'function') {
    try {
      const text = await reqOrEvent.text();
      return JSON.parse(text);
    } catch {}
  }
  return {};
}

function sendResponse(reqOrEvent, context, data, status = 200) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Express server (context is res)
  if (context && typeof context.status === 'function' && typeof context.json === 'function') {
    return context.status(status).json(data);
  }

  // Netlify v2 (Standard Web Response)
  if (isWebRequest(reqOrEvent)) {
    return new Response(JSON.stringify(data), {
      status,
      headers: corsHeaders,
    });
  }

  // Netlify v1 (AWS Lambda event format)
  return {
    statusCode: status,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
}

async function chatService(reqOrEvent, context) {
  const method = (reqOrEvent?.method || reqOrEvent?.httpMethod || 'POST').toUpperCase();

  if (method === 'OPTIONS') {
    return sendResponse(reqOrEvent, context, {}, 200);
  }

  if (method !== 'POST') {
    return sendResponse(reqOrEvent, context, { error: 'Method not allowed' }, 405);
  }

  try {
    const body = await extractBody(reqOrEvent);
    const { message, history = [], context: studyContext = {} } = body;

    if (!message && !studyContext.weakestTopics) {
      return sendResponse(reqOrEvent, context, { error: 'Message or topic context is required.' }, 400);
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return sendResponse(
        reqOrEvent,
        context,
        { error: 'GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY in your Netlify site settings under Environment variables.' },
        503
      );
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
    if (studyContext.weakestTopics && studyContext.weakestTopics.length > 0) {
      const topicsStr = studyContext.weakestTopics
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

    return sendResponse(reqOrEvent, context, { response: response.text }, 200);
  } catch (err) {
    let errorMsg = err.message || 'Error generating study advice.';
    try {
      const parsed = JSON.parse(errorMsg);
      if (parsed?.error?.message) errorMsg = parsed.error.message;
    } catch {}
    return sendResponse(reqOrEvent, context, { error: errorMsg }, 500);
  }
}

// Netlify v1 handler
export const handler = chatService;

// Netlify v2 handler / Express default export
export default chatService;

// Netlify v2 path config
export const config = {
  path: ['/api/chat', '/.netlify/functions/chat'],
};
