# Sounder — a self-directed morse code tutor

Zero-cost stack: static frontend on GitHub Pages, a Cloudflare Worker as
the only backend (hides the API key), Groq's free-tier LLM as the brain,
and all learner progress stored in the browser (`localStorage`) — no database.

## 1. Deploy the Worker (backend)

The worker code lives in the sibling folder `morse-tutor-worker/`. It needs
its own Cloudflare project — it does **not** go on GitHub Pages.

1. Get a free Groq API key: https://console.groq.com
2. Install wrangler if you don't have it: `npm install -g wrangler`
3. From inside `morse-tutor-worker/`:
   ```
   wrangler login
   wrangler secret put GROQ_API_KEY
   # paste your Groq key when prompted
   wrangler deploy
   ```
4. Wrangler prints a URL like `https://sounder-morse-tutor.<you>.workers.dev`.
   Keep it — you'll paste it into the frontend's settings panel.
5. Optional but recommended: open `worker.js` and change `ALLOWED_ORIGIN`
   from `'*'` to your actual GitHub Pages URL once you know it, so random
   sites can't call your worker and burn your Groq free-tier quota.

## 2. Deploy the frontend (GitHub Pages)

This folder (`morse-tutor/`) is a plain static site.

1. Push this folder's contents to a new GitHub repo.
2. In the repo: **Settings → Pages → Source → Deploy from branch → main
   (root)**.
3. GitHub gives you a URL like `https://yourusername.github.io/repo-name/`.
4. Open the site, click the ⚙ icon top-right, paste your Worker URL from
   step 1, save.

## 3. Use it

Just start typing — e.g. "I want to learn the alphabet from scratch" or
"quiz me on the letters I've done so far." The tutor decides what to
teach next based on your stored progress; you're driving the pace.

## How progress works

- Stored entirely in `localStorage` under `sounder_progress_v1` — per
  browser, no login.
- Each reply from the tutor can include a small JSON patch
  (`progressPatch`) noting which characters were introduced/tested and
  whether the mode changed (learn / quiz / decode practice / send practice).
- Use the "Reset my progress" button in settings to start over.

## Extending later

- Progress is a clean serializable object (see `progress.js`), so if you
  ever want cross-device sync, you can swap the `localStorage` calls for
  calls to a small database (e.g. Supabase) without touching the tutor
  logic or the Worker's prompt.
- `morse.js` is self-contained — the LLM never computes timing, it just
  requests which morse strings to play, so playback rhythm stays exact.
