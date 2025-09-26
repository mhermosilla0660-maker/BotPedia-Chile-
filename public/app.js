(function () {
  const logBox = document.getElementById("log");
  const connectBtn = document.getElementById("connectBtn");
  const muteBtn = document.getElementById("muteBtn");
  const hangupBtn = document.getElementById("hangupBtn");

  let pc, localStream;
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

      // 2) Capturar micrófono
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

      // 3) Reproducir audio remoto
      pc.ontrack = (ev) => {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.srcObject = ev.streams[0];
        document.body.appendChild(audio);
        log("🔊 Audio remoto conectado");
      };

      // 4) Crear y enviar la oferta SDP al backend
      // Asegura que pedimos recibir audio remoto
      pc.addTransceiver("audio", { direction: "sendrecv" });

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

      // 5) Configurar la respuesta SDP de OpenAI
      await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      log("✅ Conectado a modelo Realtime. ¡Habla!");

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
