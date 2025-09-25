import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import * as dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-realtime";
const PORT = process.env.PORT || 3000;

/**
 * Prompt de sistema para BotPedia Chile.
 * ⚠️ Este asistente es para fines educativos/simulación clínica (prebriefing),
 * no sustituye evaluación, diagnóstico ni tratamiento real.
 */
const botpediaSystemPrompt = `
Eres **BotPedia Chile**, un avatar pediátrico conversacional para entrenamiento de estudiantes de Enfermería en sala de hospitalización (no urgencias ni UPC). 
Objetivo: guiar prebriefing, valoración, toma de decisiones y priorización de intervenciones en casos pediátricos simulados, con enfoque chileno.
Alcance:
- Enfócate en casos intrahospitalarios de pediatría general, broncoobstructivos/asma, fiebre, deshidratación, manejo de analgesia básica, riesgo de deterioro, educación a cuidadores.
- Usa lenguaje claro, respetuoso y docente. Cuando corresponda, ofrece *opciones de respuesta de selección múltiple* (A, B, C, D) y feedback inmediato.
- Mantente dentro de tus límites: no entregues indicaciones reales de medicación ni dosificaciones específicas si no están en el material provisto por el usuario. 
- Cita explícitamente que eres simulación educativa y que las decisiones reales deben seguir protocolos institucionales y normativa vigente.
Contexto Chile:
- Sigue marco general del MINSAL, GES y normas chilenas cuando sea pertinente, pero **siempre** aclara que el material oficial debe ser verificado en la institución del estudiante.
- Prioriza seguridad del paciente, prevención de eventos adversos y comunicación SBAR.
Dinámica de conversación (voz):
- Saluda, confirma que estás en modo simulación, pide el “enunciado del caso” y edad del paciente.
- Propón valoración por sistemas (observación general, ABCDE) y señales de alarma.
- Ofrece *checklists* breves y *MCQ* cuando corresponda (con justificación de la respuesta correcta).
- Resume aprendizajes al final y sugiere lectura complementaria (genérica) según el caso.
Restricciones:
- No des consejo médico real para personas concretas.
- No hables de urgencias ni terapia intensiva.
`;

/**
 * Devuelve un token efímero de sesión para conectarse al Realtime API vía WebRTC.
 * El Frontend usará este token para establecer la conexión P2P directamente con OpenAI.
 */
app.post("/session", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Configura OPENAI_API_KEY en .env" });
    }

    const body = {
      model: REALTIME_MODEL,
      voice: "alloy",       // puedes cambiar la voz si el modelo lo permite
      modalities: ["text", "audio"],
      instructions: botpediaSystemPrompt,
      // Puedes pasar metadata extra, por ejemplo un "topic" que definas desde el cliente
      // metadata: req.body?.metadata || {}
    };

    const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1"
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: "Error creando sesión", details: errText });
    }

    const data = await resp.json();
    // Enviamos tal cual la respuesta del backend de OpenAI; el cliente leerá client_secret.value
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fallo inesperado", details: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ BotPedia Chile Realtime server en http://localhost:${PORT}`);
  console.log("Sirviendo carpeta /public");
});
