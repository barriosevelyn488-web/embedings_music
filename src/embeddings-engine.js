import { GoogleGenAI } from "@google/genai";
import { consultarCancionesSQLite } from "./db.js";

/**
 * Obtiene e inicializa el cliente de Gemini validando que GEMINI_API_KEY exista en el entorno (.env o Vercel).
 */
export function obtenerClienteGemini() {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey || apiKey.includes("pega_aqui")) {
    const error = new Error(
      "Falta configurar tu GEMINI_API_KEY en el archivo .env (o en Environment Variables de Vercel)."
    );
    error.codigoEstado = 400;
    throw error;
  }
  return new GoogleGenAI({ apiKey });
}

// ============================================================================
// AJUSTE 1: TRANSFORMACIÓN DE LENGUAJE NATURAL A VECTOR NUMÉRICO Y SIMILITUD
// ============================================================================

/**
 * Convierte cualquier texto en lenguaje natural en el vector numérico (Embedding de 3,072 dimensiones)
 * que comprende el modelo semántico Gemini Embedding 2.
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
        await new Promise((r) => setTimeout(r, 600 * intento));
      }
    }
  }
  throw ultimoError;
}

/**
 * Similitud de Coseno: compara geométricamente dos vectores numéricos (de -1 a 1)
 * midiendo qué tan cercano es el significado entre la consulta del usuario y cada canción en SQLite.
 */
export function calcularSimilitud(vectorA, vectorB) {
  let productoPunto = 0;
  let magnitudA = 0;
  let magnitudB = 0;

  const longitud = Math.min(vectorA.length, vectorB.length);
  for (let i = 0; i < longitud; i++) {
    productoPunto += vectorA[i] * vectorB[i];
    magnitudA += vectorA[i] * vectorA[i];
    magnitudB += vectorB[i] * vectorB[i];
  }

  const denominador = Math.sqrt(magnitudA) * Math.sqrt(magnitudB);
  return denominador === 0 ? 0 : productoPunto / denominador;
}

// ============================================================================
// AJUSTE 2: INSTRUCCIONES Y RESPUESTA DE LA IA ORIENTADA A TEMÁTICA MUSICAL
// ============================================================================

const INSTRUCCIONES_MUSICA_IA = `
Eres un curador musical experto y amable integrado en un buscador vectorial de música.
Reglas obligatorias:
1. Responde siempre en español con un tono cercano, claro y apasionado por la música.
2. Recomienda ÚNICAMENTE canciones y artistas presentes en el CONTEXTO MUSICAL recuperado de nuestra base SQLite.
3. Explica brevemente en 2 a 4 oraciones por qué la canción o canciones principales conectan con el ánimo, género, artista o tema que buscó la persona.
4. Si ninguna canción del contexto se relaciona con lo pedido, indícalo con honestidad y sugiere la opción más cercana disponible en el catálogo.
`.trim();

/**
 * Genera la recomendación conversacional usando el contexto recuperado por similitud semántica desde SQLite.
 */
export async function generarRespuestaMusicalIA({ consultaUsuario, categoria, mejoresCanciones, client }) {
  const resumenContexto = mejoresCanciones
    .slice(0, 3)
    .map(
      (c, idx) =>
        `${idx + 1}. "${c.titulo}" de ${c.artista} (${c.anio}) [${c.categoria}] — Similitud semántica: ${c.porcentajeSimilitud}% | Ambiente: ${c.mood} | Detalle: ${c.descripcion}`
    )
    .join("\n");

  const promptEntrada = [
    `FILTRO DE CATEGORÍA ACTIVO: ${categoria || "Todas"}`,
    `CONTEXTO MUSICAL (mejores coincidencias vectoriales en SQLite):\n${resumenContexto}`,
    `CONSULTA DEL USUARIO: ${consultaUsuario}`,
  ].join("\n\n");

  const modelosRespaldo = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-4-hydrogen"];
  let ultimoError = null;

  for (const modelo of modelosRespaldo) {
    try {
      const interaction = await client.interactions.create({
        model: modelo,
        system_instruction: INSTRUCCIONES_MUSICA_IA,
        input: promptEntrada,
      });
      return {
        texto: interaction.output_text,
        modeloUsado: modelo,
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

/**
 * Flujo completo de búsqueda semántica musical:
 * 1) Transforma la consulta en lenguaje natural a vector numérico (Embedding).
 * 2) Filtra por categoría en SQLite y calcula la similitud de coseno contra cada vector musical.
 * 3) Genera la recomendación musical personalizada con Gemini.
 */
export async function buscarMusicaConEmbeddings({ consultaUsuario, categoria = "Todas", limite = 6 }) {
  const client = obtenerClienteGemini();
  const inicioTotal = performance.now();

  const textoTransformado = `task: question answering | query: ${consultaUsuario}`;
  const vectorConsulta = await crearEmbedding(textoTransformado, client);

  const inicioSQLite = performance.now();
  const { motor, canciones } = await consultarCancionesSQLite({
    categoria,
    incluirVectores: true,
  });

  const resultadosOrdenados = canciones
    .map((cancion) => {
      const similitud = calcularSimilitud(vectorConsulta, cancion.vector);
      return {
        id: cancion.id,
        titulo: cancion.titulo,
        artista: cancion.artista,
        categoria: cancion.categoria,
        anio: cancion.anio,
        mood: cancion.mood,
        descripcion: cancion.descripcion,
        similitud,
        porcentajeSimilitud: Number((similitud * 100).toFixed(2)),
      };
    })
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, limite);

  const tiempoBusquedaVectorialMs = Number((performance.now() - inicioSQLite).toFixed(2));

  const respuestaIA = await generarRespuestaMusicalIA({
    consultaUsuario,
    categoria,
    mejoresCanciones: resultadosOrdenados,
    client,
  });

  const tiempoTotalMs = Number((performance.now() - inicioTotal).toFixed(0));

  return {
    consulta: consultaUsuario,
    categoriaActiva: categoria,
    motorBaseDatos: motor,
    transformacionEmbedding: {
      modeloEmbedding: "gemini-embedding-2",
      textoEntrada: textoTransformado,
      dimensiones: vectorConsulta.length,
      muestraVector: vectorConsulta.slice(0, 8).map((v) => Number(v.toFixed(6))),
      tiempoSQLiteMs: tiempoBusquedaVectorialMs,
      totalComparadas: canciones.length,
    },
    respuestaIA: respuestaIA.texto,
    modeloGeneracion: respuestaIA.modeloUsado,
    tiempoTotalMs,
    resultados: resultadosOrdenados,
  };
}
