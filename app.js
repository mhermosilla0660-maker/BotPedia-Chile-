const logEl = document.getElementById("log");
const remoteAudio = document.getElementById("remoteAudio");
const connectBtn = document.getElementById("connectBtn");
const muteBtn = document.getElementById("muteBtn");
const hangupBtn = document.getElementById("hangupBtn");
const vuBar = document.getElementById("vuMeter");

let pc;
let localStream;
let isMuted = false;

function log(msg) {
  console.log(msg);
  logEl.textContent = (logEl.textContent + "\n" + msg).trim();
}

async function connect() {
  connectBtn.disabled = true;
  try {
    // 1) Solicita token efímero al backend, que ya incluye el prompt de BotPedia Chile
    const session = await fetch("/session", { method: "POST" }).then(r => r.json());
    if (!session || !session.client_secret || !session.client_secret.value) {
      throw new Error("No se pudo obtener token efímero. Revisa tu API key en el backend.");
    }
    const EPHEMERAL_KEY = session.client_secret.value;

    // 2) WebRTC PeerConnection
    pc = new RTCPeerConnection();
    pc.onconnectionstatechange = () => log(`RTC state: ${pc.connectionState}`);
    pc.oniceconnectionstatechange = () => log(`ICE state: ${pc.iceConnectionState}`);

    // 3) Reproducir el audio remoto del modelo
    const remoteStream = new MediaStream();
    remoteAudio.srcObject = remoteStream;
    pc.ontrack = (event) => {
      remoteStream.addTrack(event.track);
    };

    // 4) Captura micrófono del usuario
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Simple VU meter
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(localStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    function drawVU(){
      analyser.getByteTimeDomainData(dataArray);
      // calculo RMS simple
      let sum = 0;
      for (let i=0;i<dataArray.length;i++){
        const v = (dataArray[i]-128)/128;
        sum += v*v;
      }
      const rms = Math.sqrt(sum/dataArray.length);
      const pct = Math.min(100, Math.max(0, Math.round(rms*160)));
      vuBar.style.width = pct + "%";
      requestAnimationFrame(drawVU);
    }
    drawVU();

    // 5) Crea la oferta local y envíala al Realtime API
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);

    const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model || "gpt-realtime")}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        "Authorization": `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
        "OpenAI-Beta": "realtime=v1"
      },
    });

    const answer = { type: "answer", sdp: await sdpResponse.text() };
    await pc.setRemoteDescription(answer);

    // Botones
    muteBtn.disabled = false;
    hangupBtn.disabled = false;
    log("✅ Conectado. Habla cuando quieras (modelo en modo audio).");
  } catch (err) {
    log("❌ Error al conectar: " + err.message);
    connectBtn.disabled = false;
  }
}

function toggleMute(){
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
  muteBtn.textContent = isMuted ? "Reactivar micrófono" : "Silenciar";
}

function hangup(){
  if (pc) { pc.close(); pc = null; }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  muteBtn.disabled = true;
  hangupBtn.disabled = true;
  connectBtn.disabled = false;
  log("🔚 Llamada finalizada.");
}

connectBtn.addEventListener("click", connect);
muteBtn.addEventListener("click", toggleMute);
hangupBtn.addEventListener("click", hangup);
