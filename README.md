# Embedings Music

Aplicación web ligera que demuestra el funcionamiento de **Embeddings vectoriales**, **similitud semántica (coseno)**, almacenamiento vectorial en **SQLite** (`node:sqlite`) y respuestas generadas por **Gemini IA** aplicadas a un buscador musical.

## Qué demuestra este proyecto

Partiendo del ejemplo base en consola (`mi-proyecto-ia`), este repositorio incorpora una interfaz visual en **HTML, CSS y JavaScript puro** junto con dos ajustes centrales en [`src/embeddings-engine.js`](./src/embeddings-engine.js):

1. **Ajuste 1 — Transformación de lenguaje natural a vector numérico y búsqueda en SQLite:**
   - Convierte la frase del usuario en un vector de **3,072 dimensiones** con `gemini-embedding-2` (`crearEmbedding`).
   - Consulta los vectores precalculados de las 32 canciones en [`data/music.sqlite`](./data/music.sqlite) (filtrando opcionalmente por cualquiera de las 8 categorías musicales) y calcula la **similitud de coseno** (`calcularSimilitud`).
2. **Ajuste 2 — Respuesta de la IA orientada a curaduría musical:**
   - Ajusta las instrucciones del sistema (`INSTRUCCIONES_MUSICA_IA`) y la función `generarRespuestaMusicalIA` para recomendar canciones y artistas basándose estrictamente en las coincidencias recuperadas de SQLite.

## Estructura del proyecto

```text
embedings_music/
├── api/
│   ├── songs.js              # Endpoint GET /api/songs (catálogo y filtro SQLite)
│   └── search.js             # Endpoint POST /api/search (embedding + similitud + respuesta IA)
├── data/
│   ├── songs-dataset.js      # Dataset semilla de 32 canciones en 8 categorías
│   ├── music.sqlite          # Base de datos SQLite con los vectores binarios (Float32 BLOB)
│   └── vectors-cache.json    # Respaldo sincronizado para runtimes serverless de solo lectura
├── public/
│   ├── index.html            # Interfaz de búsqueda, filtros, inspector vectorial y resultados
│   ├── styles.css            # Estilos responsivos con Design Tokens y contraste accesible
│   └── app.js                # Lógica cliente en JavaScript puro
├── src/
│   ├── db.js                 # Consultas parametrizadas sobre node:sqlite
│   └── embeddings-engine.js  # Transformación de embeddings, similitud de coseno y curador IA
├── seed.js                   # Script para regenerar data/music.sqlite si editas el dataset
├── server.js                 # Servidor local ligero (http://localhost:3000)
├── vercel.json               # Configuración lista para desplegar en Vercel
└── .env.example              # Plantilla de variables de entorno
```

## Ejecución en local

1. Instala las dependencias:

```bash
npm install
```

2. Abre tu archivo `.env` (o créalo desde `.env.example`) y coloca manualmente tu clave de Gemini sin comillas:

```env
GEMINI_API_KEY=AIzaSy...
PORT=3000
```

3. Inicia la aplicación:

```bash
npm start
```

4. Abre en tu navegador: `http://localhost:3000`

*(Opcional: si modificas o agregas canciones en `data/songs-dataset.js`, ejecuta `npm run seed` para volver a vectorizar y actualizar `data/music.sqlite`).*

## Despliegue en Vercel

1. Sube o conecta este repositorio (`embedings_music`) desde tu panel de [Vercel](https://vercel.com/new).
2. En **Environment Variables**, agrega:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** tu API key de Google AI Studio
3. Haz clic en **Deploy** (Vercel detecta automáticamente `public/` y las funciones serverless en `api/` junto con `data/music.sqlite`).
