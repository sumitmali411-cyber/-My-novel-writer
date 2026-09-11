import { GoogleGenAI } from "@google/genai";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // PWABuilder needs to read the manifest cross-origin, but the API routes
  // must not be callable from arbitrary sites. Open up only the static
  // manifest/icon paths; everything else stays same-origin.
  const publicManifestPaths = ['/manifest.webmanifest', '/manifest.json'];
  app.use(publicManifestPaths, cors({
    origin: '*',
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }));

  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    );
    next();
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Reject oversized bodies before they are buffered into memory.
  app.use(express.json({ limit: '256kb' }));

  const MAX_PROMPT_CHARS = 8000;

  // Rate limit: requests allowed per client per window.
  const RATE_LIMIT_MAX = 60;
  const RATE_LIMIT_WINDOW_MS = 60_000;
  const hits = new Map<string, { count: number; resetAt: number }>();

  function rateLimited(key: string): boolean {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return false;
    }
    entry.count += 1;
    return entry.count > RATE_LIMIT_MAX;
  }

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now >= entry.resetAt) hits.delete(key);
    }
  }, RATE_LIMIT_WINDOW_MS).unref();

  app.use('/api', (req, res, next) => {
    if (rateLimited(req.ip ?? 'unknown')) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    next();
  });

  // The Gemini key lives only in this process. It is never sent to the browser.
  const geminiKey = process.env.GEMINI_API_KEY;
  const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

  app.post("/api/gemini/generate", async (req, res) => {
    if (!ai) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }

    const { prompt } = req.body ?? {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: 'A non-empty "prompt" string is required.' });
    }

    if (prompt.length > MAX_PROMPT_CHARS) {
      return res
        .status(413)
        .json({ error: `"prompt" must be ${MAX_PROMPT_CHARS} characters or fewer.` });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return res.json({ text: response.text || "" });
    } catch (error) {
      // Log server-side; return a generic message so upstream errors never
      // reach the browser.
      console.error("Gemini proxy error:", error);
      return res.status(502).json({ error: "Failed to generate content." });
    }
  });

  app.post("/api/sarvam/translate", async (req, res) => {
    const { input, target_language_code } = req.body ?? {};
    const apiKey = process.env.SARVAM_API_KEY;

    if (typeof input !== "string" || !input.trim()) {
      return res.status(400).json({ error: 'A non-empty "input" string is required.' });
    }

    if (input.length > MAX_PROMPT_CHARS) {
      return res
        .status(413)
        .json({ error: `"input" must be ${MAX_PROMPT_CHARS} characters or fewer.` });
    }

    // Only well-formed BCP-47-ish language tags reach the upstream API.
    if (typeof target_language_code !== "string" || !/^[a-zA-Z]{2,3}-[a-zA-Z]{2,4}$/.test(target_language_code)) {
      return res.status(400).json({ error: "Invalid target_language_code." });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "SARVAM_API_KEY not configured" });
    }

    try {
      const response = await fetch('https://api.sarvam.ai/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey
        },
        body: JSON.stringify({
          input,
          source_language_code: 'en-IN',
          target_language_code,
          speaker_gender: 'Female',
          mode: 'formal'
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Sarvam API error:", errorData);
        return res.status(502).json({ error: "Translation failed." });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Sarvam proxy error:", error);
      res.status(500).json({ error: "Failed to call Sarvam API" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 5 / path-to-regexp 8 rejects a bare '*' pattern.
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
