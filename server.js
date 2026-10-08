import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Helper to resolve Gemini API key from all available sources
function resolveApiKey() {
  // 1. process.env
  let key = process.env.GEMINI_API_KEY;
  if (key && key !== 'MY_GEMINI_API_KEY' && key.trim()) {
    return key.trim();
  }

  // 2. /app/.dev.env.json
  try {
    const devEnv = JSON.parse(fs.readFileSync('/app/.dev.env.json', 'utf8'));
    if (devEnv.GEMINI_API_KEY && devEnv.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && devEnv.GEMINI_API_KEY.trim()) {
      return devEnv.GEMINI_API_KEY.trim();
    }
  } catch {}

  // 3. Local .env files
  for (const envFile of ['.env', '.env.local', '.env.example']) {
    try {
      const content = fs.readFileSync(path.join(__dirname, envFile), 'utf8');
      const match = content.match(/GEMINI_API_KEY\s*=\s*([^\r\n]+)/);
      if (match && match[1]) {
        const candidate = match[1].trim().replace(/^['"]|['"]$/g, '');
        if (candidate && candidate !== 'MY_GEMINI_API_KEY') {
          return candidate;
        }
      }
    } catch {}
  }

  return null;
}

function getGeminiClient() {
  const key = resolveApiKey();
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API endpoint for Gemini study chat & quiz
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], context = {} } = req.body;

    if (!message && !context.weakestTopics) {
      return res.status(400).json({ error: 'Message or context is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in Settings > Secrets or .env.',
      });
    }

    // Construct conversation contents
    const contents = [];

    // Include recent history if provided
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

    // Append current prompt with grade context if present
    let currentPrompt = message || '';
    if (context.weakestTopics && context.weakestTopics.length > 0) {
      const topicsStr = context.weakestTopics
        .map((t) => `${t.name} (${t.grade}%)`)
        .join(', ');
      currentPrompt = `[Context: Student's weakest topics are: ${topicsStr}]\n\n${currentPrompt}`;
    }

    contents.push({
      role: 'user',
      parts: [{ text: currentPrompt }],
    });

    const systemInstruction =
      'You are an expert AI Study Coach and Academic Tutor. Your goal is to help students improve their academic performance, master their weakest subjects, and build confidence. Provide clear, supportive, and structured guidance. When asked to quiz, ask 1-2 focused questions at a time, wait for answers or give immediate constructive feedback. Use concise paragraphs or bullet points with clean text or markdown formatting.';

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: { systemInstruction },
      });
    } catch (primaryErr) {
      // If 3.8-flash hits a transient spike, fall back to 2.5-flash
      if (primaryErr.message && (primaryErr.message.includes('503') || primaryErr.message.includes('UNAVAILABLE'))) {
        console.warn('gemini-3.8-flash unavailable, trying gemini-2.5-flash fallback...');
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
    console.error('Error generating Gemini response:', error);
    let errorMessage = error.message || 'Failed to generate study advice from Gemini.';
    try {
      const parsed = JSON.parse(errorMessage);
      if (parsed?.error?.message) {
        errorMessage = parsed.error.message;
      }
    } catch {}
    return res.status(500).json({
      error: errorMessage,
    });
  }
});

// Serve static files from root and hacka5thontraining subfolder
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'hacka5thontraining')));

// Route requests to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/websitetestdesignchoosanm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Academic Performances Tracker server running at http://0.0.0.0:${PORT}`);
});
