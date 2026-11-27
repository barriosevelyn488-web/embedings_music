import { registrarInteraccionSQLite } from "../src/db.js";

function leerBodyJSON(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string" && req.body.length > 0) return Promise.resolve(JSON.parse(req.body));

  return new Promise((resolve, reject) => {
    let acumulado = "";
    req.on("data", (chunk) => {
      acumulado += chunk;
      if (acumulado.length > 4_096) reject(new Error("Solicitud demasiado grande."));
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

const ACCIONES_PERMITIDAS = new Set(["play", "letra", "favorita_on", "favorita_off"]);

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Método no permitido." }));
  }

  try {
    const body = await leerBodyJSON(req);
    const id = Number(body.id);
    const accion = String(body.accion || "");

    if (!Number.isInteger(id) || id <= 0 || !ACCIONES_PERMITIDAS.has(accion)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "Parámetros de interacción inválidos." }));
    }

    const resultado = await registrarInteraccionSQLite({ id, accion });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: true, ...resultado }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: false, error: error.message }));
  }
}
