import { consultarCancionesSQLite } from "../src/db.js";
import { CATEGORIAS_MUSICALES } from "../data/songs-dataset.js";

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Método no permitido. Usa GET." }));
  }

  try {
    const urlObj = new URL(req.url, "http://localhost");
    const categoria = urlObj.searchParams.get("categoria") || "Todas";

    if (categoria !== "Todas" && !CATEGORIAS_MUSICALES.includes(categoria)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "Categoría musical no válida." }));
    }

    const datos = await consultarCancionesSQLite({ categoria, incluirVectores: false });
    const apiKeyConfigurada = Boolean(
      process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("pega_aqui")
    );

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(
      JSON.stringify({
        ok: true,
        apiKeyConfigurada,
        motorBaseDatos: datos.motor,
        categorias: datos.categorias,
        total: datos.canciones.length,
        canciones: datos.canciones,
      })
    );
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(
      JSON.stringify({
        ok: false,
        error: error.message || "Error al consultar el catálogo SQLite.",
      })
    );
  }
}
