import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIAS_MUSICALES } from "../data/songs-dataset.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RUTA_SQLITE = path.join(__dirname, "..", "data", "music.sqlite");
export const RUTA_CACHE_JSON = path.join(__dirname, "..", "data", "vectors-cache.json");

/**
 * Convierte un arreglo numérico JS en un Buffer binario Float32 compacto para SQLite BLOB.
 */
function vectorABlob(valores) {
  const float32 = new Float32Array(valores);
  return Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);
}

/**
 * Reconstruye un Float32Array desde el BLOB almacenado en SQLite.
 */
function blobAVector(blobUint8) {
  const copia = Uint8Array.from(blobUint8);
  return new Float32Array(copia.buffer);
}

/**
 * Guarda el catálogo completo con sus vectores numéricos dentro de SQLite (node:sqlite nativo)
 * y genera un respaldo JSON sincronizado para entornos serverless de solo lectura.
 */
export async function guardarCancionesVectorizadas(registros) {
  const { DatabaseSync } = await import("node:sqlite");

  if (fs.existsSync(RUTA_SQLITE)) {
    fs.unlinkSync(RUTA_SQLITE);
  }

  const db = new DatabaseSync(RUTA_SQLITE);
  try {
    db.exec("PRAGMA journal_mode = DELETE;");
    db.exec(`
      CREATE TABLE IF NOT EXISTS canciones (
        id INTEGER PRIMARY KEY,
        titulo TEXT NOT NULL,
        artista TEXT NOT NULL,
        categoria TEXT NOT NULL,
        anio INTEGER NOT NULL,
        mood TEXT NOT NULL,
        descripcion TEXT NOT NULL,
        dimensiones INTEGER NOT NULL,
        vector_blob BLOB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_canciones_categoria ON canciones(categoria);
    `);

    const insertStmt = db.prepare(`
      INSERT INTO canciones (id, titulo, artista, categoria, anio, mood, descripcion, dimensiones, vector_blob)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN TRANSACTION;");
    for (const item of registros) {
      insertStmt.run(
        item.id,
        item.titulo,
        item.artista,
        item.categoria,
        item.anio,
        item.mood,
        item.descripcion,
        item.vector.length,
        vectorABlob(item.vector)
      );
    }
    db.exec("COMMIT;");
  } finally {
    db.close();
  }

  // Respaldo compacto redondeado a 6 decimales por si algún contenedor en nube no habilita node:sqlite
  const respaldo = registros.map((item) => ({
    id: item.id,
    titulo: item.titulo,
    artista: item.artista,
    categoria: item.categoria,
    anio: item.anio,
    mood: item.mood,
    descripcion: item.descripcion,
    dimensiones: item.vector.length,
    vector: Array.from(item.vector, (v) => Number(v.toFixed(6))),
  }));
  fs.writeFileSync(RUTA_CACHE_JSON, JSON.stringify(respaldo));
}

/**
 * Consulta las canciones (y opcionalmente sus vectores) desde SQLite usando consultas parametrizadas seguras.
 */
export async function consultarCancionesSQLite({ categoria = "Todas", incluirVectores = false } = {}) {
  const filtrarPorCategoria = Boolean(categoria && categoria !== "Todas");

  if (fs.existsSync(RUTA_SQLITE)) {
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const db = new DatabaseSync(RUTA_SQLITE, { readOnly: true });
      try {
        const columnas = incluirVectores
          ? "id, titulo, artista, categoria, anio, mood, descripcion, dimensiones, vector_blob"
          : "id, titulo, artista, categoria, anio, mood, descripcion, dimensiones";

        const stmt = filtrarPorCategoria
          ? db.prepare(`SELECT ${columnas} FROM canciones WHERE categoria = ? ORDER BY id ASC`)
          : db.prepare(`SELECT ${columnas} FROM canciones ORDER BY id ASC`);

        const filas = filtrarPorCategoria ? stmt.all(categoria) : stmt.all();

        const canciones = filas.map((fila) => {
          const base = {
            id: fila.id,
            titulo: fila.titulo,
            artista: fila.artista,
            categoria: fila.categoria,
            anio: fila.anio,
            mood: fila.mood,
            descripcion: fila.descripcion,
            dimensiones: fila.dimensiones,
          };
          if (incluirVectores && fila.vector_blob) {
            base.vector = blobAVector(fila.vector_blob);
          }
          return base;
        });

        return { motor: "sqlite-nativo", canciones, categorias: CATEGORIAS_MUSICALES };
      } finally {
        db.close();
      }
    } catch {
      // Si el runtime en nube no soporta node:sqlite, cae de forma transparente al snapshot exportado de SQLite
    }
  }

  if (fs.existsSync(RUTA_CACHE_JSON)) {
    const crudo = JSON.parse(fs.readFileSync(RUTA_CACHE_JSON, "utf8"));
    const filtradas = filtrarPorCategoria
      ? crudo.filter((c) => c.categoria === categoria)
      : crudo;

    const canciones = filtradas.map((c) => {
      const copia = { ...c };
      if (!incluirVectores) {
        delete copia.vector;
      }
      return copia;
    });

    return { motor: "sqlite-snapshot", canciones, categorias: CATEGORIAS_MUSICALES };
  }

  throw new Error("La base de datos vectorial aún no está inicializada. Ejecuta: npm run seed");
}
