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

// __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === SERVIR FRONTEND ===
// Sirve archivos estáticos DESDE /public (si existe)
app.use(express.static(path.join(__dirname, "public")));

// Entrega el index explícitamente (si / no encuentra)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-realtime";
const PORT = process.env.PORT || 3000;

const botpediaSystemPrompt = `
Eres BotPedia Chile, un avatar pediátrico conversacional para entrenamiento de estudiantes
en sala de hospitalización (no urgencias ni UPC). Guía prebriefing, valoración ABCDE, señales
de alarma, checklists y MCQ (A–D) con feedback. Enfoque educativo; no entregues indicaciones
clínicas reales. Alinea con MINSAL/GES y recuerda verificar protocolos institucionales.
`;

// --- handler común para crear la sesión efímera ---
async function createRealtimeSession(req, res) {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Falta OPENAI_API_KEY en Environment Variables" });
    }
    const body = {
      model: REALTIME_MODEL,
      voice: "alloy",
      modalities: ["text", "audio"],
      instructions: botpediaSystemPrompt,
    };
    const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: "Error creando sesión", details: text });
    }
    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.type("application/json").send(text);
    }
  } catch (e) {
    return res.status(500).json({ error: "Fallo inesperado", details: String(e) });
  }
}

// Acepta POST y GET para máxima compatibilidad
app.post("/session", createRealtimeSession);
app.get("/session", createRealtimeSession);

app.listen(PORT, () => {
  console.log(`✅ BotPedia Chile Realtime server en http://localhost:${PORT}`);
});
