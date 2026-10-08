# Study Coach Grade Tracker

A static grade tracker that draws a bar chart in the browser and highlights the two lowest scores. No build step, API key, backend, or Vercel function is required. The study-focus panel provides a quiz prompt that can be copied into a separate AI chat.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Select the **Other** framework preset. Leave the Build Command and Output Directory empty.
3. Deploy. Vercel serves the HTML, CSS, and JavaScript directly; `vercel.json` routes `/` to the page.

The chart uses Chart.js from a CDN, so the browser needs internet access to load the chart library. Grade entry, charting, and weakest-topic selection run entirely in the browser.

Any Gemini key previously shared in chat should be revoked. This static version does not use or need a Gemini API key.
