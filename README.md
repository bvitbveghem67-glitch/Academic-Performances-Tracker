# Academic Performances Tracker

A clean grade tracker with visual bar charts and an interactive study assistant to help you focus on your lowest-scoring topics.

## Features

- **Visual Grade Charting**: Automatically plots your grades with Chart.js and highlights your two lowest-scoring topics.
- **Study Focus Assistant**: Powered by the Gemini API (`gemini-3.8-flash`) to generate practice recall quizzes, review plans, and concept explanations.
- **Scrollable Chat Panel**: Message box with sticky controls so long answers scroll neatly without stretching the layout.
- **Sample Data**: Single-click "Sample data" button to test the tracker immediately.

---

## Deploy to Vercel

1. **Push this repository to GitHub**.
2. **Import into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new) and select this repository.
   - Framework preset: **Other** (Vercel automatically detects the static files and `/api/chat.js` serverless function).
3. **Add Environment Variable**:
   - In **Project Settings > Environment Variables**, add:
     - `GEMINI_API_KEY`: Your Gemini API key.
4. **Deploy**:
   - Click **Deploy**. Vercel serves the frontend statically and runs the `/api/chat` serverless function.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Add your Gemini API key in .env
echo "GEMINI_API_KEY=your_key_here" > .env

# 3. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
