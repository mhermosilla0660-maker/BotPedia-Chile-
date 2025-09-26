// public/app.js
// Cliente mínimo: negocia WebRTC, recibe texto del modelo por DataChannel
// y lo lee con TTS del teléfono (speechSynthesis).

const logEl = (() => {
  const pre = document.createElement("pre");
  pre.style.whiteSpace = "pre-wrap";
  pre.style.fontSize = "12px";
  pre.style.lineHeight = "1.25";
  document.body.appendChild(pre);
  return pre;
})();

function log(...args) {
  const line = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  console.log(...args);
  logEl.textContent += line + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

// ========= TTS (texto -> voz del teléfono) =========
function speak(text) {
  try {
    if (!text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    // Español de Chile (ajusta si prefieres otra)
    u.lang = "es-CL";
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch (e) {
    log("⚠️ TTS error:", e);
  }
}

// ========= UI =========
const btnConnect = document.getElementById("btnConnect") || (() => {
  // fallback si tu HTML no tiene id
  const b = document.querySelector("button") || document.createElement("button");
  b.textContent = "Conectar";
  document.body.insertBefore(b, document.body.firstChild);
  return b;
})();

const btnMute = document.getElementById("btnMute");
const btnHang = document.getElementById("btnHang");

let pc = null;
let dc = null;
let connected = false;

btnConnect.addEventListener("click", async () => {
  if (connected) {
    log("Ya está conectado.");
    return;
  }
  try {
    await connectRealtime();
  } catch (e) {
    log("❌ Error al conectar:", e);
  }
});

if (btnHang) {
  btnHang.addEventListener("click", () => {
    if (pc) pc.close();
    pc = null;
    connected = false;
    log("☎️ Colgado.");
  });
}

async function connectRealtime() {
  log("🌐 Iniciando negociación…");

  // 1) PeerConnection
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  // (Opcional) crea un MediaStream de salida por si en el futuro recibes audio remoto
  const remoteAudio = document.getElementById("remoteAudio") || (() => {
    const a = document.createElement("audio");
    a.autoplay = true;
    a.playsInline = true;
    a.id = "remoteAudio";
    document.body.appendChild(a);
    return a;
  })();

  pc.ontrack = (ev) => {
    // Si el modelo enviara audio remoto, sonaría aquí
    remoteAudio.srcObject = ev.streams[0];
    log("🔊 Audio remoto conectado");
  };

  // 2) Canal de datos para eventos Realtime
  dc = pc.createDataChannel("oai-events");
  dc.onopen = () => {
    log("📨 DataChannel abierto");
    // Al abrir, configuramos la sesión y forzamos un primer turno de texto
    bootstrapSessionAndAsk();
  };
  dc.onmessage = (ev) => handleRealtimeMessage(ev.data);

  // 3) Oferta SDP local
  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: false,
  });
  await pc.setLocalDescription(offer);

  // 4) Enviar oferta al backend /session (que la reenvía a OpenAI)
  const resp = await fetch("/session", {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: offer.sdp,
  });
  const answerSdp = await resp.text();
  if (!resp.ok) {
    log("❌ /session status:", resp.status);
    log(answerSdp);
    throw new Error("Falló negociación con /session");
  }

  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  connected = true;
  log("✅ Conectado a modelo Realtime.");
}

// Configura la sesión para TEXTO y envía un primer mensaje para que hable
function bootstrapSessionAndAsk() {
  if (!dc || dc.readyState !== "open") return;

  // 1) Asegura que el modelo responderá en TEXTO (no pedimos 'audio')
  const sessionUpdate = {
    type: "session.update",
    session: {
      // No forzamos voice aquí. Dejamos SOLO texto.
      // Si más adelante quieres audio del modelo: response.modalities = ["audio"]
      // y ajustas el server/app acorde.
      input_audio_format: { type: "input_text" },
      turn_detection: null,
    },
  };
  dc.send(JSON.stringify(sessionUpdate));
  log("🛠️ session.update enviado");

  // 2) Primer turno: pedimos que se presente y confirme conexión
  const saludo =
    "Preséntate brevemente como BotPedia Chile. Di 'listo, conectado' y luego pregúntame en qué caso clínico pediátrico quieres practicar.";

  // Crea un item de texto
  dc.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: { type: "input_text", text: saludo, role: "user" },
    })
  );

  // Pide respuesta
  dc.send(JSON.stringify({ type: "response.create" }));
  log("➡️ response.create enviado");
}

// Maneja todos los eventos del Realtime que llegan por DataChannel
function handleRealtimeMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    log("📩", raw);
    return;
  }

  // Descomenta si quieres ver TODO:
  // log("DC:", msg);

  switch (msg.type) {
    case "session.created":
      log("🆗 session.created");
      break;

    case "response.created":
      // comenzó a generar
      break;

    case "response.delta":
      // Algunas versiones envían deltas; si viene texto incremental, lo acumulas aquí si quieres.
      break;

    case "response.completed":
    case "response.done": {
      // En la mayoría de versiones, aquí viene el texto final
      const text =
        msg.response?.output_text?.join(" ") ||
        msg.output_text?.join?.(" ") ||
        extractAnyText(msg) ||
        "";
      if (text) {
        log("🗣️", text);
        speak(text); // TTS del teléfono
      }
      break;
    }

    case "conversation.item.created": {
      // A veces el mensaje viene también aquí:
      const t = extractAnyText(msg) || "";
      if (t) {
        log("🗣️", t);
        speak(t);
      }
      break;
    }

    case "error":
      log("❌ DC error:", msg);
      break;

    default:
      // Otros eventos
      // log("ℹ️", msg.type);
      break;
  }
}

// Intenta encontrar texto en distintas formas (defensivo ante cambios de API)
function extractAnyText(msg) {
  try {
    // 1) output_text directo
    if (msg.response?.output_text?.length)
      return msg.response.output_text.join(" ");

    // 2) item.message.content[*].text u otras variantes
    const content =
      msg.item?.content || msg.response?.content || msg.delta?.content || [];
    const parts = [];
    for (const c of content) {
      if (typeof c === "string") parts.push(c);
      if (c?.text) parts.push(c.text);
      if (c?.delta) parts.push(c.delta);
      if (c?.type?.includes?.("text") && c?.content) parts.push(c.content);
    }
    return parts.join(" ");
  } catch {
    return "";
  }
}
