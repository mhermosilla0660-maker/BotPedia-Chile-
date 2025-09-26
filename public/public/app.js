const log = (msg) => {
  document.getElementById("log").textContent += msg + "\n";
};

const connectBtn = document.getElementById("connectBtn");
const muteBtn = document.getElementById("muteBtn");
const hangupBtn = document.getElementById("hangupBtn");

let pc, localStream;

connectBtn.addEventListener("click", async () => {
  log("🔗 Conectando...");
  pc = new RTCPeerConnection();

  // Captura micrófono
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // Reproduce audio remoto
  pc.ontrack = (event) => {
    const audio = document.createElement("audio");
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    document.body.appendChild(audio);
  };

  // Crea oferta y envía al backend
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const res = await fetch("/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sdp: offer.sdp })
  });

  const data = await res.json();
  await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });

  log("✅ Conectado");
});

muteBtn.addEventListener("click", () => {
  localStream.getTracks().forEach(track => track.enabled = !track.enabled);
  log("🔇 Micrófono " + (localStream.getTracks()[0].enabled ? "activado" : "silenciado"));
});

hangupBtn.addEventListener("click", () => {
  pc.close();
  log("📴 Conexión finalizada");
});
