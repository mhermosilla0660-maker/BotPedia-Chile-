// server.js
import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Servir el frontend desde /public ===
app.use(express.static(path.join(__dirname, "public")));

// Página principal
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Endpoint de prueba usado por tu app.js actual ===
// (solo devuelve un JSON para que veas "Sesión creada")
app.get("/session", (_req, res) => {
  res.json({ ok: true, message: "Sesión de demo creada" });
});

// Puerto para Render/Heroku/etc.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor iniciado en http://localhost:${PORT}`);
  console.log(`🗂️  Sirviendo estáticos desde: ${path.join(__dirname, "public")}`);
});
