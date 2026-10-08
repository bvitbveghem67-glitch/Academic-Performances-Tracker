import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

function resolveKey() {
  let k = process.env.GEMINI_API_KEY;
  if (k && k !== 'MY_GEMINI_API_KEY' && k.trim()) return k.trim();
  try {
    const devEnv = JSON.parse(fs.readFileSync('/app/.dev.env.json', 'utf8'));
    if (devEnv.GEMINI_API_KEY && devEnv.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && devEnv.GEMINI_API_KEY.trim()) {
      return devEnv.GEMINI_API_KEY.trim();
    }
  } catch {}
  for (const f of ['.env', '.env.local']) {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history = [], context = {} } = req.body || {};

  if (!message && !context.weakestTopics) {
    return res.status(400).json({ error: 'Message or topic context is required.' });
  }

  const apiKey = resolveKey();
  if (!apiKey) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured. On Vercel, add GEMINI_API_KEY in your Project Settings > Environment Variables.',
    });
  }

  try {
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

    return res.json({ response: response.text });
  } catch (error) {
    let errorMessage = error.message || 'Error generating tutor response.';
    try {
      const parsed = JSON.parse(errorMessage);
      if (parsed?.error?.message) {
        errorMessage = parsed.error.message;
      }
    } catch {}
    return res.status(500).json({ error: errorMessage });
  }
}
