async function connect() {
  log("🔄 Conectando...");
  try {
    const resp = await fetch("/session");
    if (!resp.ok) throw new Error("Error al crear sesión");
    const data = await resp.json();
    log("✅ Sesión creada");
    console.log("Sesión:", data);
  } catch (err) {
    log("❌ Error al conectar: " + err.message);
  }
}

function mute() {
  log("🔇 Silenciado (demo)");
}

function hangup() {
  log("📴 Llamada terminada (demo)");
}

function log(msg) {
  const logDiv = document.getElementById("log");
  logDiv.innerHTML += `<p>${msg}</p>`;
}
