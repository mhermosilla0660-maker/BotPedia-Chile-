    // public/app.js
const $log = (msg) => {
  const el = document.getElementById("log");
  el.textContent += (typeof msg === "string" ? msg : JSON.stringify(msg)) + "\n";
  el.scrollTop = el.scrollHeight;
};

let pc, dc, remoteAudio;

async function conectar() {
  try {
    $log("🌐 Iniciando negociación…");

    // Elemento de audio remoto (autoplay por gesto del botón)
    if (!remoteAudio) {
      remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.playsInline = true;
      document.body.appendChild(remoteAudio);
    }

    // 1) PeerConnection
    pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // 2) Audio local (micrófono)
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    mic.getTracks().forEach((t) => pc.addTrack(t, mic));

    // 3) Audio remoto → al elemento <audio>
    pc.ontrack = (ev) => {
      $log("🔊 Audio remoto conectado");
      remoteAudio.srcObject = ev.streams[0];
    };

    // 4) DataChannel para eventos Realtime
    dc = pc.createDataChannel("oai-events");
    dc.onopen = () => {
      $log("✉️  DataChannel abierto");
      // Nota: también mandamos cosas cuando llegue "session.created"
    };
    dc.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        // Muestra eventos relevantes
        if (data.type === "session.created") {
          $log("🆗 session.created");
          enviarConfiguracionYPrimerTurno();
        } else if (data.type === "response.output_text.delta") {
          // Texto parcial (por si algún día lo muestras)
        } else if (data.type === "response.error" || data.type === "error") {
          $log("❌ DC error: " + JSON.stringify(data, null, 2));
        }
      } catch {
        // Mensaje no-JSON (ignorar)
      }
    };

    // 5) SDP local
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await pc.setLocalDescription(offer);

    // 6) Llamar a tu servidor para crear la sesión
    const r = await fetch("/session", {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp,
    });

    if (!r.ok) {
      const txt = await r.text();
      $log(`/session status: ${r.status}\n${txt}`);
      return;
    }

    const answerSDP = await r.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });

    $log("✅ Conectado a modelo Realtime.");
  } catch (err) {
    console.error(err);
    $log("❌ Error conectando: " + (err?.message || err));
  }
}

// Envía turn detection + system prompt y un primer response.create que hable
function enviarConfiguracionYPrimerTurno() {
  if (!dc || dc.readyState !== "open") return;

  // a) Configuración de la sesión (detección de voz en servidor + prompt)
  dc.send(
    JSON.stringify({
      type: "session.update",
      session: {
        turn_detection: { type: "server_vad" },
        instructions:
          "Eres BotPedia Chile. Responde en español de Chile, corto y claro. " +
          "Si el usuario guarda silencio, da una indicación breve para continuar.",
      },
    })
  );
  $log("🛠️  session.update enviado");

  // b) Primer turno para que SALUDE en voz
  dc.send(
    JSON.stringify({
      type: "response.create",
      response: {
        modalities: ["audio"],
        instructions:
          "Hola, soy BotPedia Chile. Estoy listo para escuchar tu caso. " +
          "Por ejemplo: 'Niño de 6 años con ataque de asma'.",
      },
    })
  );
  $log("➡️  response.create enviado");
}

function silenciar() {
  if (!dc || dc.readyState !== "open") return;
  dc.send(JSON.stringify({ type: "response.cancel" }));
  $log("🔇 Silenciar (cancel) enviado");
}

function colgar() {
  try {
    dc && dc.close();
    pc && pc.close();
  } catch {}
  $log("🛑 Llamada finalizada");
}

window.conectar = conectar;
window.silenciar = silenciar;
window.colgar = colgar;
