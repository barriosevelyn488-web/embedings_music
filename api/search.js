import { buscarCancionesSemanticamente } from "../src/embeddings-engine.js";
import { CATEGORIAS_MUSICALES } from "../data/songs-dataset.js";

function leerBodyJSON(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string" && req.body.length > 0) return Promise.resolve(JSON.parse(req.body));

  return new Promise((resolve, reject) => {
    let acumulado = "";
    req.on("data", (chunk) => {
      acumulado += chunk;
      if (acumulado.length > 16_384) reject(new Error("Solicitud demasiado grande."));
    });
    req.on("end", () => {
      try {
        resolve(acumulado ? JSON.parse(acumulado) : {});
      } catch {
        reject(new Error("Formato JSON inválido."));
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
    const consulta = String(body.query || "").trim();
    const categoria = String(body.categoria || "Todas").trim();

    if (!consulta) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "Escribe qué canción, artista o género buscas." }));
    }

    if (consulta.length > 300) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "La búsqueda es demasiado extensa." }));
    }

    if (categoria !== "Todas" && !CATEGORIAS_MUSICALES.includes(categoria)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "Género seleccionado no válido." }));
    }

    const resultados = await buscarCancionesSemanticamente({
      consultaUsuario: consulta,
      categoria,
      limite: 12,
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(
      JSON.stringify({
        ok: true,
        consulta,
        categoria,
        resultados,
      })
    );
  } catch (error) {
    res.statusCode = error.codigoEstado || 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(
      JSON.stringify({
        ok: false,
        error: error.message || "No se pudo realizar la búsqueda.",
      })
    );
  }
}
