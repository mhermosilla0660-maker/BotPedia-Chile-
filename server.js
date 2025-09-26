// server.js
// BotPedia Chile — Backend Express para Realtime (proxy SDP) + estáticos de /public

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// ---------- Config básica ----------
const app = express();
app.disable("x-powered-by");
app.use(cors());

// Necesitamos leer el cuerpo como TEXTO porque es SDP (no JSON)
app.use(
  express.text({
    type: ["application/sdp", "text/plain", "*/*"],
    limit: "10mb",
  })
);

// Rutas de estáticos
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// ---------- Variables de entorno ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const REALTIME_MODEL =
  process.env.REALTIME_MODEL || "gpt-4o-realtime-preview"; // puedes cambiarlo si tu cuenta tiene otra versión
const PORT = process.env.PORT || 3000;

// Validación mínima
if (!OPENAI_API_KEY) {
  console.warn(
    "[WARN] Falta OPENAI_API_KEY. Configúrala en Render → Environment → Variables."
  );
}

// ---------- Salud / raíz ----------
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    model: REALTIME_MODEL,
    staticDir: "/public",
  });
});

// (opcional) Redirigir raíz a index.html por claridad
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// ---------- Negociación WebRTC con Realtime ----------
/**
 * El frontend manda un SDP Offer a /session.
 * Este endpoint reenvía ese SDP a OpenAI Realtime y devuelve el SDP Answer.
 * ¡NO enviamos "modalities: ['audio']" aquí! Eso lo controla el cliente (y en nuestro app.js pedimos TEXTO).
 */
app.post("/session", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ ok: false, error: "OPENAI_API_KEY no configurada" });
    }

    const clientOfferSdp = req.body;
    if (!clientOfferSdp || typeof clientOfferSdp !== "string") {
      return res
        .status(400)
        .json({ ok: false, error: "Cuerpo inválido: se esperaba SDP (texto)" });
    }

    // Llamada al endpoint Realtime de OpenAI (vía WebRTC/SDP)
    // Nota: el parámetro "model" va en la query; "OpenAI-Beta: realtime=v1" es requerido.
    const realtimeUrl = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(
      REALTIME_MODEL
    )}`;

    const upstream = await fetch(realtimeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/sdp",
        "OpenAI-Beta": "realtime=v1",
      },
      body: clientOfferSdp,
    });

    const answerSdp = await upstream.text();

    if (!upstream.ok) {
      console.error("[/session] OpenAI error:", upstream.status, answerSdp);
      return res.status(upstream.status).send(answerSdp);
    }

    // Devolvemos el SDP Answer tal cual, con su Content-Type de SDP
    res.setHeader("Content-Type", "application/sdp");
    return res.status(200).send(answerSdp);
  } catch (err) {
    console.error("[/session] Error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Fallo en negociación /session", detail: String(err) });
  }
});

// ---------- 404 de API (dejar que los estáticos manejen el resto) ----------
app.use((req, res, next) => {
  if (req.method === "GET") {
    // Para SPA simples, servir index.html si no coincide otra ruta
    return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  }
  return res.status(404).json({ ok: false, error: "Not Found" });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`✅ BotPedia backend listo en puerto ${PORT}`);
  console.log(
    `   Modelo Realtime: ${REALTIME_MODEL} | /session y estáticos desde /public`
  );
});
