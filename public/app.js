(function () {
  const logBox = document.getElementById("log");
  const connectBtn = document.getElementById("connectBtn");
  const muteBtn = document.getElementById("muteBtn");
  const hangupBtn = document.getElementById("hangupBtn");

  const log = (msg) => {
    const t = new Date().toLocaleTimeString();
    logBox.textContent += `[${t}] ${msg}\n`;
    logBox.scrollTop = logBox.scrollHeight;
  };

  // Captura errores JS para que aparezcan en pantalla
  window.addEventListener("error", (e) => log(`JS error: ${e.message}`));
  window.addEventListener("unhandledrejection", (e) => log(`Promise error: ${e.reason}`));

  connectBtn.addEventListener("click", async () => {
    try {
      log("🔄 Conectando… llamando a /session");
      const r = await fetch("/session", { method: "GET" });
      log(`↩️ /session status: ${r.status}`);
      const txt = await r.text(); // muestro bruto por si la respuesta no es JSON
      log(`📦 Respuesta: ${txt}`);
      try {
        const data = JSON.parse(txt);
        if (data?.ok) log("✅ Sesión creada correctamente");
      } catch {
        // no era JSON, igual ya lo mostramos arriba
      }
    } catch (err) {
      log(`❌ Error de red: ${err.message}`);
    }
  });

  muteBtn.addEventListener("click", () => log("🔇 Silenciar (demo)"));
  hangupBtn.addEventListener("click", () => log("📴 Colgar (demo)"));
})();
