import fs from 'node:fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateReply } from './api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const entry = line.trim();
    if (!entry || entry.startsWith('#')) continue;
    const separator = entry.indexOf('=');
    if (separator < 1) continue;
    const name = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (name && !process.env[name]) process.env[name] = value;
  }
} catch {}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const response = await generateReply(req.body);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files from root
app.use(express.static(__dirname));

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
