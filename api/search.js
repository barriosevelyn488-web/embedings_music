import { buscarMusicaConEmbeddings } from "../src/embeddings-engine.js";
import { CATEGORIAS_MUSICALES } from "../data/songs-dataset.js";

function leerBodyJSON(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === "string" && req.body.length > 0) {
    return Promise.resolve(JSON.parse(req.body));
  }

  return new Promise((resolve, reject) => {
    let acumulado = "";
    req.on("data", (chunk) => {
      acumulado += chunk;
      if (acumulado.length > 16_384) {
        reject(new Error("El cuerpo de la solicitud excede el tamaño permitido."));
      }
    });
    req.on("end", () => {
      try {
        resolve(acumulado ? JSON.parse(acumulado) : {});
      } catch {
        reject(new Error("Formato JSON inválido en la solicitud."));
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
    return res.end(JSON.stringify({ error: "Método no permitido. Usa POST." }));
  }

  try {
    const body = await leerBodyJSON(req);
    const consulta = String(body.query || "").trim();
    const categoria = String(body.categoria || "Todas").trim();

    if (!consulta) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(
        JSON.stringify({ error: "Escribe una búsqueda por canción, artista, ánimo o estilo musical." })
      );
    }

    if (consulta.length > 300) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(
        JSON.stringify({ error: "La consulta es demasiado larga (máximo 300 caracteres)." })
      );
    }

    if (categoria !== "Todas" && !CATEGORIAS_MUSICALES.includes(categoria)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "Categoría seleccionada no válida." }));
    }

    const respuesta = await buscarMusicaConEmbeddings({
      consultaUsuario: consulta,
      categoria,
      limite: 6,
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: true, ...respuesta }));
  } catch (error) {
    const status = error.codigoEstado || (error.status === 400 ? 400 : 500);
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(
      JSON.stringify({
        ok: false,
        error: error.message || "No se pudo completar la búsqueda semántica.",
      })
    );
  }
}
