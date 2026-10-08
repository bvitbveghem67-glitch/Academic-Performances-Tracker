# Academic Performances Tracker

A simple grade tracker that plots your scores on a bar chart and highlights your lowest-scoring topics with practice quizzes and study suggestions.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To use the AI study assistant locally, add your Gemini API key in `.env`:
```bash
GEMINI_API_KEY=your_key_here
```

## Deploy to Netlify

1. **Push this repo to GitHub**.
2. **Import into Netlify**:
   - In Netlify, click **Add new site > Import an existing project** and select your GitHub repo.
   - **Build command**: leave blank (or `echo "Ready"`)
   - **Publish directory**: `.` (or leave blank)
   - **Functions directory**: `netlify/functions` (auto-detected from `netlify.toml`)
3. **Environment Variables**:
   - Go to **Site configuration > Environment variables**.
   - Add `GEMINI_API_KEY` with your Gemini API key value.
4. **Deploy**:
   - Click **Deploy site**.
   - Netlify serves the static site and deploys the serverless study coach function at `/.netlify/functions/chat` (rewritten to `/api/chat`).
