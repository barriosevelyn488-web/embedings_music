import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import songsHandler from "./api/songs.js";
import searchHandler from "./api/search.js";
import interactHandler from "./api/interact.js";
import chatHandler from "./api/chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARPETA_PUBLIC = path.join(__dirname, "public");
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const ORIGENES_LOCALES_PERMITIDOS = new Set([
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
]);

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  const origin = req.headers.origin;
  if (origin && ORIGENES_LOCALES_PERMITIDOS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const ruta = urlObj.pathname;

  if (ruta === "/api/songs") return songsHandler(req, res);
  if (ruta === "/api/search") return searchHandler(req, res);
  if (ruta === "/api/interact") return interactHandler(req, res);
  if (ruta === "/api/chat") return chatHandler(req, res);

  const rutaRelativa = ruta === "/" ? "index.html" : ruta.replace(/^\/+/, "");
  const rutaArchivo = path.normalize(path.join(CARPETA_PUBLIC, rutaRelativa));

  if (!rutaArchivo.startsWith(CARPETA_PUBLIC)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Acceso denegado");
  }

  if (fs.existsSync(rutaArchivo) && fs.statSync(rutaArchivo).isFile()) {
    const ext = path.extname(rutaArchivo).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    return fs.createReadStream(rutaArchivo).pipe(res);
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Recurso no encontrado");
});

server.listen(PORT, () => {
  console.log(`\n🎵 Aplicación musical activa en: http://localhost:${PORT}\n`);
});
