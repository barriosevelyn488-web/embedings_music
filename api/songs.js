import { consultarCancionesSQLite } from "../src/db.js";
import { CATEGORIAS_MUSICALES } from "../data/songs-dataset.js";

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Método no permitido." }));
  }

  try {
    const urlObj = new URL(req.url, "http://localhost");
    const categoria = urlObj.searchParams.get("categoria") || "Todas";

    if (categoria !== "Todas" && !CATEGORIAS_MUSICALES.includes(categoria)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "Género no válido." }));
    }

    const [filtradasData, todasData] = await Promise.all([
      consultarCancionesSQLite({ categoria, incluirVectores: false }),
      categoria === "Todas"
        ? Promise.resolve(null)
        : consultarCancionesSQLite({ categoria: "Todas", incluirVectores: false }),
    ]);

    const baseCompleta = todasData ? todasData.canciones : filtradasData.canciones;
    const masEscuchadas = [...baseCompleta]
      .sort((a, b) => b.reproducciones - a.reproducciones)
      .slice(0, 5);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(
      JSON.stringify({
        ok: true,
        categorias: CATEGORIAS_MUSICALES,
        canciones: filtradasData.canciones,
        masEscuchadas,
      })
    );
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: false, error: error.message || "Error al cargar canciones." }));
  }
}
