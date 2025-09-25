import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import * as dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ⚠️ IMPORTANTE: tus archivos web deben estar en /public
app.use(express.static("public"));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-realtime";
const PORT = process.env.PORT || 3000;

// Prompt de sistema (puedes ajustar el texto si quieres)
const botpediaSystemPrompt = `
Eres BotPedia Chile, un avatar pediátrico conversacional para entrenamiento de estudiantes de Enfermería en sala de hospitalización (no urgencias ni UPC). 
Objetivo: guiar prebriefing, valoración ABCDE, señales de alarma, checklists y MCQ (A–D) con feedback, manteniendo enfoque educativo y sin entregar indicaciones clínicas reales. 
Alinea con MINSAL/GES de Chile y recuerda verificar protocolos institucionales.
`;

// ✅ POST /session: crea la sesión efímera para Realtime
app.post("/session", async (req, res) => {
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
        // 👇 necesario para Realtime
        "OpenAI-Beta": "realtime=v1"
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(resp.status).json({ error: "Error creando sesión", details: txt });
    }

    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Fallo inesperado", details: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ BotPedia Chile Realtime server en http://localhost:${PORT}`);
  console.log("Sirviendo carpeta /public");
});
