import { GoogleGenAI } from "@google/genai";
import { consultarCancionesSQLite } from "./db.js";

export function obtenerClienteGemini() {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey || apiKey.includes("pega_aqui")) {
    const error = new Error("Configura tu GEMINI_API_KEY en el archivo .env para activar las funciones inteligentes.");
    error.codigoEstado = 400;
    throw error;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { retryOptions: { attempts: 1 } },
  });
}

/**
 * Transforma texto en lenguaje natural a su representación vectorial numérica (Embedding).
 */
export async function crearEmbedding(texto, clienteOpcional = null) {
  const client = clienteOpcional || obtenerClienteGemini();
  let ultimoError = null;
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const response = await client.models.embedContent({
        model: "gemini-embedding-2",
        contents: texto,
      });
      return response.embeddings[0].values;
    } catch (err) {
      ultimoError = err;
      if (intento < 3) {
        await new Promise((r) => setTimeout(r, 500 * intento));
      }
    }
  }
  throw ultimoError;
}

/**
 * Similitud de coseno entre dos vectores numéricos.
 */
export function calcularSimilitud(vectorA, vectorB) {
  let productoPunto = 0;
  let magnitudA = 0;
  let magnitudB = 0;

  const n = Math.min(vectorA.length, vectorB.length);
  for (let i = 0; i < n; i++) {
    productoPunto += vectorA[i] * vectorB[i];
    magnitudA += vectorA[i] * vectorA[i];
    magnitudB += vectorB[i] * vectorB[i];
  }

  const denom = Math.sqrt(magnitudA) * Math.sqrt(magnitudB);
  return denom === 0 ? 0 : productoPunto / denom;
}

function normalizarTexto(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ============================================================================
// 1. BUSCADOR MUSICAL SEMÁNTICO (INDEPENDIENTE DEL CHAT)
// ============================================================================

/**
 * Busca canciones por género, canción, artista o descripción emocional/natural
 * combinando coincidencia directa y similitud semántica vectorial sobre SQLite.
 */
export async function buscarCancionesSemanticamente({ consultaUsuario, categoria = "Todas", limite = 12 }) {
  const client = obtenerClienteGemini();
  const vectorConsulta = await crearEmbedding(
    `task: question answering | query: ${consultaUsuario}`,
    client
  );

  const { canciones } = await consultarCancionesSQLite({
    categoria,
    incluirVectores: true,
  });

  const qNorm = normalizarTexto(consultaUsuario);

  const puntuadas = canciones.map((cancion) => {
    const similitudBase = calcularSimilitud(vectorConsulta, cancion.vector);
    let puntajeFinal = similitudBase;

    // Refuerzo cuando el usuario escribe directamente el título, artista o género
    const tituloNorm = normalizarTexto(cancion.titulo);
    const artistaNorm = normalizarTexto(cancion.artista);
    const catNorm = normalizarTexto(cancion.categoria);

    if (tituloNorm.includes(qNorm) || artistaNorm.includes(qNorm)) {
      puntajeFinal = Math.min(0.99, similitudBase + 0.22);
    } else if (catNorm.includes(qNorm)) {
      puntajeFinal = Math.min(0.95, similitudBase + 0.12);
    }

    const { vector, ...datosPublicos } = cancion;
    return {
      ...datosPublicos,
      afinidad: Math.round(puntajeFinal * 100),
      puntajeInterno: puntajeFinal,
    };
  });

  return puntuadas
    .sort((a, b) => b.puntajeInterno - a.puntajeInterno)
    .slice(0, limite)
    .map(({ puntajeInterno, ...resto }) => resto);
}

// ============================================================================
// 2. CHAT CON AVATAR MUSICAL IA ("LIRA") — INDEPENDIENTE DEL BUSCADOR
// ============================================================================

const INSTRUCCIONES_AVATAR_MUSICAL = `
Eres Lira, la guía y compañera musical dentro de una aplicación para descubrir y disfrutar música.
Reglas de estilo y comportamiento:
1. Habla siempre en español de forma cálida, natural, breve y enfocada en el oyente (nunca hables de vectores, embeddings, bases de datos ni SQLite).
2. Usa el CATÁLOGO RELACIONADO para responder dudas sobre letras, de qué trata una canción, datos del artista o recomendar temas según el ánimo de la persona.
3. Si mencionas canciones de la app, escribe su título entre comillas y el artista para que la persona las ubique fácilmente y pueda reproducir su video o ver su letra.
4. Mantén tus respuestas ágiles (máximo 1 o 2 párrafos cortos).
`.trim();

export async function conversarConAvatarMusical({ mensajeUsuario, historial = [] }) {
  const client = obtenerClienteGemini();
  const vectorPregunta = await crearEmbedding(
    `task: question answering | query: ${mensajeUsuario}`,
    client
  );

  const { canciones } = await consultarCancionesSQLite({
    categoria: "Todas",
    incluirVectores: true,
  });

  const qNorm = normalizarTexto(mensajeUsuario);
  const cercanas = canciones
    .map((c) => {
      let score = calcularSimilitud(vectorPregunta, c.vector);
      if (normalizarTexto(c.titulo).includes(qNorm) || normalizarTexto(c.artista).includes(qNorm)) {
        score += 0.25;
      }
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const contextoCanciones = cercanas
    .map(
      (c) =>
        `- "${c.titulo}" de ${c.artista} (${c.anio}, género: ${c.categoria}). Tema/ambiente: ${c.descripcion} | Fragmento de letra: ${(c.letra || "").slice(0, 280).replace(/\s+/g, " ")}`
    )
    .join("\n");

  const resumenHistorial = Array.isArray(historial)
    ? historial
        .slice(-4)
        .map((m) => `${m.rol === "usuario" ? "Oyente" : "Lira"}: ${String(m.texto || "").slice(0, 220)}`)
        .join("\n")
    : "";

  const entrada = [
    resumenHistorial ? `CONVERSACIÓN RECIENTE:\n${resumenHistorial}` : "",
    `CATÁLOGO RELACIONADO EN LA APP:\n${contextoCanciones}`,
    `MENSAJE DEL OYENTE: ${mensajeUsuario}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const modelos = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
  let ultimoError = null;

  for (const modelo of modelos) {
    try {
      const interaction = await client.interactions.create({
        model: modelo,
        system_instruction: INSTRUCCIONES_AVATAR_MUSICAL,
        input: entrada,
      });

      const sugerencias = cercanas.slice(0, 2).map((c) => ({
        id: c.id,
        titulo: c.titulo,
        artista: c.artista,
        categoria: c.categoria,
        portada: c.portada,
      }));

      return {
        respuesta: interaction.output_text,
        sugerencias,
      };
    } catch (err) {
      ultimoError = err;
      if (err.status !== 503 && err.status !== 429) {
        throw err;
      }
    }
  }

  throw ultimoError;
}
