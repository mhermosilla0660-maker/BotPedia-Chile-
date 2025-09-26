const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";

app.post("/session", async (req, res) => {
  try {
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice: "alloy",         // o "verse", "aria", etc.
        modalities: ["audio"],  // ← si pides audio
      })
    });

    const data = await r.json();
    return res.json({ ok: true, client_secret: data.client_secret });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});
