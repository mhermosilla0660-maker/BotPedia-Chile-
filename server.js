// server.js (WebRTC con OpenAI Realtime)
import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sirve el frontend
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// POST /session — intercambia SDP con la API Realtime
app.post("/session", async (req, res) => {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-realtime";
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Falta OPENAI_API_KEY" });
    }
    const { sdp } = req.body || {};
    if (!sdp) return res.status(400).json({ error: "Falta sdp en body" });

    const fetchRes = await fetch(
      `https://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1",
        },
        body: sdp,
      }
    );

    const answerSDP = await fetchRes.text(); // la API devuelve SDP en texto
    if (!fetchRes.ok) {
      return res
        .status(fetchRes.status)
        .json({ error: "OpenAI Realtime falló", details: answerSDP });
    }
    // Devolvemos el SDP de respuesta al navegador
    res.json({ sdp: answerSDP });
  } catch (err) {
    res.status(500).json({ error: "Error en /session", details: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server en http://localhost:${PORT}`);
});
