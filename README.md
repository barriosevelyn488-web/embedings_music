# Sonora · Aplicación Musical (`embedings_music`)

Aplicación web para descubrir, gestionar y disfrutar música con reproducción integrada de videos de YouTube, lectura de letras completas, canciones más escuchadas dinámicas, apartado de favoritas, buscador inteligente por similitud semántica y asistente conversacional con avatar (**Lira**).

## Funcionalidades principales

- **Buscador inteligente de canciones:** Permite buscar por canción, artista, género o estado de ánimo usando similitud semántica en segundo plano sin exponer tecnicismos en la interfaz.
- **Filtrado por géneros musicales:** Acceso directo por categorías (*Pop*, *Rock / Alternativo*, *Urbano / Reggaetón / Hip-Hop*, *Balada / Acústica / Romántica*, *Electrónica / Dance*, *Salsa / Tropical / Regional*, *Cristiana / Gospel*, *Lo-Fi / Instrumental / Clásica*).
- **Canciones más escuchadas en tiempo real:** La portada muestra el ranking de tendencias y actualiza los contadores conforme reproduces videos, consultas letras o guardas canciones.
- **Apartado «Mis Favoritas»:** Guarda y gestiona tus temas preferidos con un clic.
- **Reproductor de YouTube + Letra dentro de la app:** Modal integrado que reproduce el video oficial sin salir de la aplicación junto con la letra completa de cada canción.
- **Chat con Avatar Musical (Lira):** Asistente independiente del buscador para resolver dudas sobre letras, historia de canciones, artistas o recibir recomendaciones con acceso directo para reproducir.
- **Diseño cálido sin tonos azules:** Paleta de alto contraste en tonos **Carbón Vinilo, Crema Marfil, Coral Terracota y Ámbar Oro**, con selector de modo oscuro/claro cálido.

## Cómo ejecutar en local

1. Instala dependencias:

```bash
npm install
```

2. Coloca tu clave en `.env` (a partir de `.env.example`):

```env
GEMINI_API_KEY=AIzaSy...
PORT=3000
```

3. Inicia la aplicación:

```bash
npm start
```

4. Abre en tu navegador: **`http://localhost:3000`**

## Despliegue en Vercel

1. Importa el repositorio **`barriosevelyn488-web/embedings_music`** en [vercel.com/new](https://vercel.com/new).
2. Agrega `GEMINI_API_KEY` en **Environment Variables**.
3. Haz clic en **Deploy**.
