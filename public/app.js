(function () {
  const logBox = document.getElementById("log");
  const connectBtn = document.getElementById("connectBtn");
  const muteBtn = document.getElementById("muteBtn");
  const hangupBtn = document.getElementById("hangupBtn");

  let pc, localStream, dc, remoteAudio;

  const log = (m) => {
    const t = new Date().toLocaleTimeString();
    logBox.textContent += `[${t}] ${m}\n`;
    logBox.scrollTop = logBox.scrollHeight;
  };

  window.addEventListener("error", e => log(`JS error: ${e.message}`));
  window.addEventListener("unhandledrejection", e => log(`Promise error: ${e.reason}`));

  connectBtn.addEventListener("click", async () => {
    try {
      pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Canal de datos para eventos Realtime
      dc = pc.createDataChannel("oai-events");
      dc.onopen = () => {
        log("🛰️ DataChannel abierto");

        // 1) Actualiza la sesión: activa voz y VAD del servidor
        const sessUpdate = {
          type: "session.update",
          session: {
            voice: "alloy",
            turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 250, silence_duration_ms: 600 },
          },
        };
        dc.send(JSON.stringify(sessUpdate));
        log("➡️ session.update enviado (voice alloy, VAD servidor)");

        // 2) Pide una primera respuesta hablada (saludo)
        const sayHi = {
          type: "response.create",
          response: {
            modalities: ["audio"],
            instructions:
              "Habla en español chileno, claro y breve. " +
              "Eres BotPedia Chile, avatar de simulación educativa. " +
              "Saluda y pide que te cuenten el caso clínico.",
          },
        };
        dc.send(JSON.stringify(sayHi));
        log("➡️ response.create enviado (audio)");
      };

      dc.onmessage = (ev) => {
        // Mostrar eventos y errores con detalle
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "error") {
            log(`❌ DC error: ${JSON.stringify(data, null, 2)}`);
          } else {
            log(`DC: ${JSON.stringify(data)}`);
          }
        } catch {
          log(`DC raw: ${ev.data}`);
        }
      };
      dc.onerror = (ev) => log(`❌ DC onerror: ${ev.message || ev}`);

      // micrófono -> enviar
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

      // audio remoto -> reproducir
      pc.ontrack = (ev) => {
        if (!remoteAudio) {
          remoteAudio = document.createElement("audio");
          remoteAudio.autoplay = true;
          remoteAudio.playsInline = true;
          remoteAudio.muted = false;
          document.body.appendChild(remoteAudio);
        }
        remoteAudio.srcObject = ev.streams[0];
        const p = remoteAudio.play();
        if (p && p.catch) p.catch(() => log("ℹ️ Esperando interacción para reproducir audio"));
        log("🔊 Audio remoto conectado");
      };

      pc.addTransceiver("audio", { direction: "sendrecv" });

      // SDP -> backend
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
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);

      await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      log("✅ Conectado a modelo Realtime. Habla cerca del micrófono:");

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
