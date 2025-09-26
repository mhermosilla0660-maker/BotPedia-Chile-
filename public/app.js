(function () {
  const logBox = document.getElementById("log");
  const connectBtn = document.getElementById("connectBtn");
  const muteBtn = document.getElementById("muteBtn");
  const hangupBtn = document.getElementById("hangupBtn");

  let pc, localStream, dc;

  const log = (m) => {
    const t = new Date().toLocaleTimeString();
    logBox.textContent += `[${t}] ${m}\n`;
    logBox.scrollTop = logBox.scrollHeight;
  };

  window.addEventListener("error", e => log(`JS error: ${e.message}`));
  window.addEventListener("unhandledrejection", e => log(`Promise error: ${e.reason}`));

  connectBtn.addEventListener("click", async () => {
    try {
      // 1) RTCPeerConnection
      pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // 2) Canal de datos para eventos Realtime
      dc = pc.createDataChannel("oai-events");
      dc.onopen = () => {
        log("🛰️ DataChannel abierto, pidiendo respuesta de audio…");
        // Envia el comando para que el modelo HABLE en español
        const msg = {
          type: "response.create",
          response: {
            modalities: ["audio"],      // queremos audio de salida
            instructions:
              "Habla en español chileno, claro y breve. " +
              "Eres BotPedia Chile, avatar de simulación educativa. " +
              "Si detectas audio de usuario, salúdale y pídele que te cuente el caso.",
            voice: "alloy"              // voz del modelo (si tu cuenta la soporta)
          }
        };
        dc.send(JSON.stringify(msg));
      };
      dc.onmessage = (ev) => log(`📩 DC: ${ev.data}`);
      dc.onerror = (ev) => log(`❌ DC error: ${ev.message || ev}`);

      // 3) Audio local (micrófono) -> envío al modelo
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

      // 4) Audio remoto -> reproducir
      pc.ontrack = (ev) => {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.srcObject = ev.streams[0];
        document.body.appendChild(audio);
        log("🔊 Audio remoto conectado");
      };

      // Recibir y enviar audio (full duplex)
      pc.addTransceiver("audio", { direction: "sendrecv" });

      // 5) Oferta SDP -> backend -> OpenAI
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      log("🌐 Enviando SDP offer a /session…");
      const r = await fetch("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: offer.sdp }),
      });
      const data = await r.json();
      log(`↩️ /session status: ${r.status}`);

      if (!data?.sdp) throw new Error("No llegó SDP desde el servidor");
      await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      log("✅ Conectado a modelo Realtime. ¡Habla cerca del micrófono!");

    } catch (err) {
      log(`❌ Error al conectar: ${err.message}`);
    }
  });

  muteBtn.addEventListener("click", () => {
    if (!localStream) return;
    const t = localStream.getTracks()[0];
    t.enabled = !t.enabled;
    log(t.enabled ? "🔊 Micrófono ACTIVADO" : "🔇 Micrófono SILENCIADO");
  });

  hangupBtn.addEventListener("click", () => {
    if (pc) {
      pc.getSenders().forEach(s => s.track && s.track.stop());
      pc.close();
      pc = null;
      log("📴 Llamada colgada");
    }
  });
})();
