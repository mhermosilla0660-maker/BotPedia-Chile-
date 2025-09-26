// public/app.js
// Cliente WebRTC mínimo para conectar a tu backend y hablar vía TTS del navegador.

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

// ========= TTS =========
function speak(text) {
  try {
    if (!text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-CL";
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch (e) {
    log("⚠️ TTS error:", e);
  }
}

let pc = null;
let dc = null;

document.querySelector("button")?.addEventListener("click", connectRealtime);

async function connectRealtime() {
  log("🌐 Iniciando negociación…");

  pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

  const remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  remoteAudio.playsInline = true;
  document.body.appendChild(remoteAudio);

  pc.ontrack = (ev) => {
    remoteAudio.srcObject = ev.streams[0];
    log("🔊 Audio remoto conectado");
  };

  dc = pc.createDataChannel("oai-events");
  dc.onopen = () => {
    log("📨 DataChannel abierto");
    sendInitialMessage();
  };
  dc.onmessage = (ev) => handleRealtimeMessage(ev.data);

  const offer = await pc.createOffer({ offerToReceiveAudio: true });
  await pc.setLocalDescription(offer);

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
  log("✅ Conectado a modelo Realtime.");
}

function sendInitialMessage() {
  // NO enviamos session.update con input_audio_format inválido
  log("🛠️ Sesión lista, enviando primer turno...");

  const saludo =
    "Soy BotPedia Chile. ¡Listo y conectado! ¿Qué caso clínico pediátrico quieres simular?";

  dc.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: saludo },
    })
  );

  dc.send(JSON.stringify({ type: "response.create" }));
}

function handleRealtimeMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    log("📩", raw);
    return;
  }

  switch (msg.type) {
    case "session.created":
      log("🆗 session.created");
      break;

    case "response.done":
    case "response.completed": {
      const text = msg.response?.output_text?.join(" ") || "";
      if (text) {
        log("🗣️", text);
        speak(text);
      }
      break;
    }

    case "conversation.item.created": {
      const t =
        msg.item?.content?.map((c) => c.text || c)?.join(" ") || "";
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
      break;
  }
}
