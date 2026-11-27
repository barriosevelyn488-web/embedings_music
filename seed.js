import { CATALOGO_CANCIONES, construirTextoSemanticoCancion } from "./data/songs-dataset.js";
import { crearEmbedding, obtenerClienteGemini } from "./src/embeddings-engine.js";
import { guardarCancionesVectorizadas, RUTA_SQLITE } from "./src/db.js";

async function poblarBaseVectorialSQLite() {
  console.log("=== INICIANDO VECTORIZACIÓN DEL CATÁLOGO MUSICAL ===");
  console.log(`Total de canciones a transformar en embeddings: ${CATALOGO_CANCIONES.length}\n`);

  const client = obtenerClienteGemini();
  const registrosVectorizados = [];
  const CONCURRENCIA = 4;

  for (let i = 0; i < CATALOGO_CANCIONES.length; i += CONCURRENCIA) {
    const grupo = CATALOGO_CANCIONES.slice(i, i + CONCURRENCIA);
    const procesadas = await Promise.all(
      grupo.map(async (cancion) => {
        const textoSemantico = construirTextoSemanticoCancion(cancion);
        const vector = await crearEmbedding(textoSemantico, client);
        return { ...cancion, vector };
      })
    );

    for (const item of procesadas) {
      registrosVectorizados.push(item);
      console.log(
        `[${String(item.id).padStart(2, "0")}/${CATALOGO_CANCIONES.length}] Vectorizada: "${item.titulo}" — ${item.artista} (${item.vector.length} dims)`
      );
    }
  }

  await guardarCancionesVectorizadas(registrosVectorizados);
  console.log(`\nBase vectorial SQLite generada con éxito en: ${RUTA_SQLITE}`);
}

poblarBaseVectorialSQLite().catch((error) => {
  console.error("\nError al poblar la base vectorial SQLite:", error.message);
  process.exit(1);
});
