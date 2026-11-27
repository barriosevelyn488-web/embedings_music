import { conversarConAvatarMusical } from "../src/embeddings-engine.js";

function leerBodyJSON(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string" && req.body.length > 0) return Promise.resolve(JSON.parse(req.body));

  return new Promise((resolve, reject) => {
    let acumulado = "";
    req.on("data", (chunk) => {
      acumulado += chunk;
      if (acumulado.length > 24_576) reject(new Error("Mensaje demasiado extenso."));
    });
    req.on("end", () => {
      try {
        resolve(acumulado ? JSON.parse(acumulado) : {});
      } catch {
        reject(new Error("JSON inválido."));
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Método no permitido." }));
  }

  try {
    const body = await leerBodyJSON(req);
    const mensaje = String(body.mensaje || "").trim();
    const historial = Array.isArray(body.historial) ? body.historial : [];

    if (!mensaje) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "Escribe tu pregunta para Lira." }));
    }

    if (mensaje.length > 400) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "Tu pregunta supera los 400 caracteres." }));
    }

    const respuestaChat = await conversarConAvatarMusical({
      mensajeUsuario: mensaje,
      historial,
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: true, ...respuestaChat }));
  } catch (error) {
    res.statusCode = error.codigoEstado || 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(
      JSON.stringify({
        ok: false,
        error: error.message || "Lira no pudo responder en este momento.",
      })
    );
  }
}
