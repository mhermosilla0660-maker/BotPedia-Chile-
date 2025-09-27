// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());

// MUY IMPORTANTE: el body de /session es SDP (texto plano)
app.post("/session", express.text({ type: "*/*" }), async (req, res) => {
  try {
    const offerSdp = req.body || "";
    if (!offerSdp.includes("v=0")) {
      return res.status(400).send("Invalid SDP offer");
    }

    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/sdp",
      },
      body: offerSdp,
    });

    const answerSdp = await r.text();
    if (!r.ok) {
      // Log para Render y respuesta útil al frontend
      console.error("OpenAI error", r.status, answerSdp);
      return res.status(r.status).type("text/plain").send(answerSdp);
    }

    res.status(200).type("application/sdp").send(answerSdp);
  } catch (err) {
    console.error("SESSION ERROR", err);
    res.status(500).type("text/plain").send(String(err?.message || err));
  }
});

// Salud para probar (GET)
app.get("/health", (_req, res) => res.send("ok"));

// Servir frontend
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
// Asegura bind 0.0.0.0 en Render
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on ${PORT}`);
});
