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
const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-4o-realtime-preview"; // <- AUDIO OK
const PORT = process.env.PORT || 3000;

// Negociación WebRTC con OpenAI Realtime
app.post("/session", async (req, res) => {
  try {
    const { sdp } = req.body;
    if (!sdp) return res.status(400).json({ error: "Missing SDP offer" });

    const r = await fetch(
      `https://api.openai.com/v1/realtime?model=${encodeURIComponent(REALTIME_MODEL)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
          "Content-Type": "application/sdp",
        },
        body: sdp,
      }
    );

    const answer = await r.text(); // la API responde SDP en texto
    if (!r.ok) {
      console.error("Realtime error:", r.status, answer);
      return res.status(r.status).json({ error: answer });
    }
    return res.json({ sdp: answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});
