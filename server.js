import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === SERVIR FRONTEND DESDE /public ===
app.use(express.static(path.join(__dirname, "public")));

// Fallback para "/" y rutas de la SPA
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-realtime";
const PORT = process.env.PORT || 3000;

// ✅ POST /session: recibe offer SDP del browser y devuelve answer SDP del modelo
app.post("/session", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Falta OPENAI_API_KEY en Render > Environment" });
    }
    const { sdp } = req.body || {};
    if (!sdp) {
      return res.status(400).json({ error: "Body inválido: falta sdp" });
    }

    // Intercambio SDP con OpenAI Realtime
    const r = await fetch(`https://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/sdp",
        "OpenAI-Beta": "realtime=v1",
      },
      body: sdp,
    });

    const answer = await r.text();
    if (!r.ok) {
      return res.status(r.status).json({ error: "Fallo en OpenAI Realtime", details: answer });
    }

    // El frontend espera JSON { sdp: "<answer sdp>" }
    res.json({ sdp: answer });
  } catch (e) {
    res.status(500).json({ error: "Error inesperado en /session", details: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ BotPedia Chile server en http://localhost:${PORT}`);
  console.log("Sirviendo estáticos desde /public");
});
