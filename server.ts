import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add CORS headers for PWABuilder
  app.use(cors({
    origin: '*',
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use(express.json());

  app.post("/api/sarvam/translate", async (req, res) => {
    const { input, target_language_code } = req.body;
    const apiKey = process.env.SARVAM_API_KEY;

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
        return res.status(response.status).json({ error: "Sarvam API error" });
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
