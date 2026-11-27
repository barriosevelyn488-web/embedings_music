import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIAS_MUSICALES } from "../data/songs-dataset.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RUTA_SQLITE = path.join(__dirname, "..", "data", "music.sqlite");
export const RUTA_CACHE_JSON = path.join(__dirname, "..", "data", "vectors-cache.json");

function vectorABlob(valores) {
  const float32 = new Float32Array(valores);
  return Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);
}

function blobAVector(blobUint8) {
  const copia = Uint8Array.from(blobUint8);
  return new Float32Array(copia.buffer);
}

function mapearFilaCancion(fila, incluirVectores = false) {
  const cancion = {
    id: fila.id,
    titulo: fila.titulo,
    artista: fila.artista,
    categoria: fila.categoria,
    anio: fila.anio,
    portada: fila.portada,
    youtubeId: fila.youtube_id ?? fila.youtubeId,
    letra: fila.letra,
    mood: fila.mood,
    descripcion: fila.descripcion,
    reproducciones: Number(fila.reproducciones ?? 0),
    esFavorita: Boolean(fila.es_favorita ?? fila.esFavorita ?? 0),
  };

  if (incluirVectores && fila.vector_blob) {
    cancion.vector = blobAVector(fila.vector_blob);
  } else if (incluirVectores && Array.isArray(fila.vector)) {
    cancion.vector = fila.vector;
  }

  return cancion;
}

/**
 * Crea y puebla la tabla sencilla `canciones` en SQLite con metadatos musicales,
 * letra, video de YouTube, contador de reproducciones, estado favorito y vector numérico.
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
        portada TEXT NOT NULL,
        youtube_id TEXT NOT NULL,
        letra TEXT NOT NULL,
        mood TEXT NOT NULL,
        descripcion TEXT NOT NULL,
        reproducciones INTEGER NOT NULL DEFAULT 0,
        es_favorita INTEGER NOT NULL DEFAULT 0,
        vector_blob BLOB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_canciones_categoria ON canciones(categoria);
      CREATE INDEX IF NOT EXISTS idx_canciones_reproducciones ON canciones(reproducciones DESC);
    `);

    const insertStmt = db.prepare(`
      INSERT INTO canciones (
        id, titulo, artista, categoria, anio, portada, youtube_id,
        letra, mood, descripcion, reproducciones, es_favorita, vector_blob
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN TRANSACTION;");
    for (const item of registros) {
      insertStmt.run(
        item.id,
        item.titulo,
        item.artista,
        item.categoria,
        item.anio,
        item.portada || "",
        item.youtubeId || "",
        item.letra || "",
        item.mood || "",
        item.descripcion || "",
        Number(item.reproduccionesIniciales ?? 0),
        0,
        vectorABlob(item.vector)
      );
    }
    db.exec("COMMIT;");
  } finally {
    db.close();
  }

  const respaldo = registros.map((item) => ({
    id: item.id,
    titulo: item.titulo,
    artista: item.artista,
    categoria: item.categoria,
    anio: item.anio,
    portada: item.portada || "",
    youtubeId: item.youtubeId || "",
    letra: item.letra || "",
    mood: item.mood || "",
    descripcion: item.descripcion || "",
    reproducciones: Number(item.reproduccionesIniciales ?? 0),
    esFavorita: false,
    vector: Array.from(item.vector, (v) => Number(v.toFixed(6))),
  }));
  fs.writeFileSync(RUTA_CACHE_JSON, JSON.stringify(respaldo));
}

/**
 * Consulta las canciones desde SQLite con filtro opcional por género/categoría.
 */
export async function consultarCancionesSQLite({ categoria = "Todas", incluirVectores = false } = {}) {
  const filtrar = Boolean(categoria && categoria !== "Todas");

  if (fs.existsSync(RUTA_SQLITE)) {
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const db = new DatabaseSync(RUTA_SQLITE, { readOnly: true });
      try {
        const cols = incluirVectores
          ? "id, titulo, artista, categoria, anio, portada, youtube_id, letra, mood, descripcion, reproducciones, es_favorita, vector_blob"
          : "id, titulo, artista, categoria, anio, portada, youtube_id, letra, mood, descripcion, reproducciones, es_favorita";

        const stmt = filtrar
          ? db.prepare(`SELECT ${cols} FROM canciones WHERE categoria = ? ORDER BY id ASC`)
          : db.prepare(`SELECT ${cols} FROM canciones ORDER BY id ASC`);

        const filas = filtrar ? stmt.all(categoria) : stmt.all();
        const canciones = filas.map((f) => mapearFilaCancion(f, incluirVectores));
        return { canciones, categorias: CATEGORIAS_MUSICALES };
      } finally {
        db.close();
      }
    } catch {
      // Respaldo automático en entornos serverless sin node:sqlite
    }
  }

  if (fs.existsSync(RUTA_CACHE_JSON)) {
    const crudo = JSON.parse(fs.readFileSync(RUTA_CACHE_JSON, "utf8"));
    const filtradas = filtrar ? crudo.filter((c) => c.categoria === categoria) : crudo;
    return {
      canciones: filtradas.map((f) => mapearFilaCancion(f, incluirVectores)),
      categorias: CATEGORIAS_MUSICALES,
    };
  }

  throw new Error("Base de datos musical no inicializada. Ejecuta: npm run seed");
}

/**
 * Actualiza reproducciones/interacciones o favoritas directamente en SQLite cuando el disco es escribible.
 */
export async function registrarInteraccionSQLite({ id, accion }) {
  const cancionId = Number(id);
  if (!Number.isInteger(cancionId) || cancionId <= 0) {
    throw new Error("ID de canción inválido.");
  }

  if (!fs.existsSync(RUTA_SQLITE)) {
    return { actualizadoEnSQLite: false };
  }

  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(RUTA_SQLITE);
    try {
      db.exec("PRAGMA journal_mode = DELETE;");
      if (accion === "play") {
        db.prepare("UPDATE canciones SET reproducciones = reproducciones + 2 WHERE id = ?").run(cancionId);
      } else if (accion === "letra") {
        db.prepare("UPDATE canciones SET reproducciones = reproducciones + 1 WHERE id = ?").run(cancionId);
      } else if (accion === "favorita_on") {
        db.prepare("UPDATE canciones SET es_favorita = 1, reproducciones = reproducciones + 1 WHERE id = ?").run(cancionId);
      } else if (accion === "favorita_off") {
        db.prepare("UPDATE canciones SET es_favorita = 0 WHERE id = ?").run(cancionId);
      }

      const actualizada = db
        .prepare(
          "SELECT id, titulo, artista, categoria, anio, portada, youtube_id, letra, mood, descripcion, reproducciones, es_favorita FROM canciones WHERE id = ?"
        )
        .get(cancionId);

      return {
        actualizadoEnSQLite: true,
        cancion: actualizada ? mapearFilaCancion(actualizada, false) : null,
      };
    } finally {
      db.close();
    }
  } catch {
    // En Vercel serverless el sistema de archivos es de solo lectura; el cliente sincroniza su estado local
    return { actualizadoEnSQLite: false };
  }
}
