// public/app.js
// BotPedia Chile — Avatar de Voz (WebRTC + TTS en el navegador)

// ====== UI ======
const btnConnect  = document.getElementById("connect");
const btnMute     = document.getElementById("mute");
const btnHangup   = document.getElementById("hangup");
const logEl       = document.getElementById("log");
const vu          = document.getElementById("vu"); // barra sencilla opcional
const remoteAudio = document.getElementById("remoteAudio"); // puede no existir

function log(msg, emoji="") {
  const t = new Date().toLocaleTimeString();
  logEl.textContent += `\n[${t}] ${emoji ? emoji + " " : ""}${msg}`;
  logEl.scrollTop = logEl.scrollHeight;
}

// ====== Estado global ======
let pc, dc, micStream, micTrack, analysing = false;
let mediaRecorder, audioChunks = [];
let speakingBuffer = "";  // para acumular texto y leerlo al finalizar

// ====== Util ======
function safeJSONParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function speak(text) {
  if (!text || !text.trim()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-CL"; // puedes cambiar a "es-ES" o "es-MX"
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function updateVU(level) {
  if (!vu) return;
  vu.style.width = Math.min(100, Math.max(0, level)) + "%";
}

// ====== Conectar ======
async function connect() {
  try {
    btnConnect.disabled = true;
    log("Conectando… llamando a /session", "🌐");

    // 1) Crear PeerConnection
    pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });

    // 2) Audio remoto (si el backend devuelve audio; no es obligatorio)
    pc.ontrack = (e) => {
      if (remoteAudio) {
        remoteAudio.srcObject = e.streams[0];
        remoteAudio.play().catch(()=>{});
      }
      log("Audio remoto conectado", "🔊");
    };

    // 3) DataChannel para eventos Realtime
    dc = pc.createDataChannel("oai-events");
    dc.onopen = () => {
      log("DataChannel abierto, pidiendo respuesta de texto…", "🛰️");
      // Apenas se abra el canal, pedimos que el modelo hable (texto)
      solicitarRespuesta("Hola, preséntate brevemente y pide el motivo de consulta.");
    };
    dc.onerror = (ev) => log("DataChannel error: " + ev.message, "❌");

    // 4) Manejo de mensajes desde el modelo
    dc.onmessage = (e) => {
      const msg = safeJSONParse(e.data);
      if (!msg) return;

      // Logs “verbosos” en verde para debug fácil:
      if (msg.type && msg.type !== "input_audio_buffer.stream") {
        log("DC: " + JSON.stringify(msg), "✉️");
      }

      // Buffer de texto incremental
      if (msg.type === "response.output_text.delta") {
        speakingBuffer += (msg.delta || "");
      }

      // Cuando termina la respuesta, hablamos con TTS del navegador
      if (msg.type === "response.completed" || msg.type === "response.done") {
        const text = speakingBuffer.trim();
        if (text) {
          speak(text);
          speakingBuffer = "";
        }
      }

      // Errores desde el modelo
      if (msg.type === "error") {
        log("DC error: " + JSON.stringify(msg), "❌");
      }
    };

    // 5) Captura micrófono (opcional; sirve para VU y para activación de voz local)
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micTrack  = micStream.getTracks()[0];
    pc.addTrack(micTrack, micStream);

    // Analizador de nivel (VU)
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = ac.createMediaStreamSource(micStream);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    const data = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    analysing = true;
    (function loop(){
      if (!analysing) return;
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i=0;i<data.length;i++) {
        const v = Math.abs(data[i]-128);
        if (v>peak) peak=v;
      }
      updateVU((peak/128)*100);
      requestAnimationFrame(loop);
    })();

    // 6) SDP Offer → /session → Answer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    log("Enviando SDP offer a /session…", "🛰️");

    const r = await fetch("/session", {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp
    });
    log(`/session status: ${r.status}`, "🅿️");
    const answerSDP = await r.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });

    log("Conectado a modelo Realtime. ¡Habla cerca del micrófono!", "✅");
  } catch (err) {
    console.error(err);
    log("Error al conectar: " + (err?.message || err), "❌");
    btnConnect.disabled = false;
  }
}

// ====== Enviar pedido al modelo ======
function solicitarRespuesta(instructions) {
  if (!dc || dc.readyState !== "open") return;

  // En algunas integraciones se envía un "session.update".
  // Aquí nos aseguramos de no pedir audio (que causaba el error):
  dc.send(JSON.stringify({
    type: "session.update",
    session: {
      // sin 'modalities' aquí; si alguna lib lo requiere, que sea ["text"]
    }
  }));

  // Pedimos una respuesta de TEXTO
  dc.send(JSON.stringify({
    type: "response.create",
    response: {
      modalities: ["text"],       // <- CLAVE: sólo texto
      conversation: "default",
      instructions: instructions || "Continúa la conversación en español chileno."
    }
  }));
  log("response.create enviado (text)", "➡️");
}

// ====== Silenciar micro ======
function toggleMute() {
  if (!micTrack) return;
  micTrack.enabled = !micTrack.enabled;
  btnMute.textContent = micTrack.enabled ? "Silenciar" : "Reactivar";
  log(micTrack.enabled ? "Micrófono activo" : "Micrófono silenciado", micTrack.enabled ? "🎙️" : "🔇");
}

// ====== Colgar ======
function hangup() {
  analysing = false;
  if (dc) try { dc.close(); } catch {}
  if (pc) try { pc.close(); } catch {}
  if (micStream) micStream.getTracks().forEach(t=>t.stop());
  speechSynthesis.cancel();
  btnConnect.disabled = false;
  log("Llamada finalizada", "📵");
}

// ====== Enlazar UI ======
btnConnect?.addEventListener("click", connect);
btnMute?.addEventListener("click", toggleMute);
btnHangup?.addEventListener("click", hangup);

// (Opcional) Enviar una primera instrucción al hacer click en Conectar si el DC ya está abierto
window.solicitarRespuesta = solicitarRespuesta;
