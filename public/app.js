const estado = {
  categoriaActiva: "Todas",
  consultaActiva: "",
  categorias: [],
  modoResultadosSemantica: false,
};

const el = {
  statusBadge: document.getElementById("statusBadge"),
  statusText: document.getElementById("statusText"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  submitBtn: document.getElementById("submitBtn"),
  submitBtnLabel: document.getElementById("submitBtnLabel"),
  categoriesContainer: document.getElementById("categoriesContainer"),
  alertBox: document.getElementById("alertBox"),
  alertTitle: document.getElementById("alertTitle"),
  alertMessage: document.getElementById("alertMessage"),
  loadingSection: document.getElementById("loadingSection"),
  aiResponseSection: document.getElementById("aiResponseSection"),
  aiResponseText: document.getElementById("aiResponseText"),
  responseMeta: document.getElementById("responseMeta"),
  vectorDimsBadge: document.getElementById("vectorDimsBadge"),
  vectorBars: document.getElementById("vectorBars"),
  vectorPreview: document.getElementById("vectorPreview"),
  vectorCompareCount: document.getElementById("vectorCompareCount"),
  vectorSqliteTime: document.getElementById("vectorSqliteTime"),
  catalogHeading: document.getElementById("catalogHeading"),
  catalogSubtitle: document.getElementById("catalogSubtitle"),
  resetViewBtn: document.getElementById("resetViewBtn"),
  emptyState: document.getElementById("emptyState"),
  songsGrid: document.getElementById("songsGrid"),
};

function mostrarAlerta(titulo, mensaje) {
  el.alertTitle.textContent = titulo;
  el.alertMessage.textContent = mensaje;
  el.alertBox.classList.remove("hidden");
}

function ocultarAlerta() {
  el.alertBox.classList.add("hidden");
}

function renderizarBotonesCategorias(categorias) {
  el.categoriesContainer.replaceChildren();
  const todas = ["Todas", ...categorias];

  for (const cat of todas) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-btn";
    btn.textContent = cat;
    btn.setAttribute("aria-pressed", String(estado.categoriaActiva === cat));

    btn.addEventListener("click", async () => {
      if (estado.categoriaActiva === cat) return;
      estado.categoriaActiva = cat;
      actualizarEstadoCategoriasUI();

      if (estado.consultaActiva.trim()) {
        await ejecutarBusquedaSemantica(estado.consultaActiva);
      } else {
        await cargarCatalogoSQLite();
      }
    });

    el.categoriesContainer.appendChild(btn);
  }
}

function actualizarEstadoCategoriasUI() {
  for (const btn of el.categoriesContainer.querySelectorAll(".cat-btn")) {
    btn.setAttribute("aria-pressed", String(btn.textContent === estado.categoriaActiva));
  }
}

function crearTarjetaCancion(cancion, indice, mostrarSimilitud) {
  const card = document.createElement("article");
  card.className = "song-card";
  if (mostrarSimilitud && indice === 0) {
    card.classList.add("is-top-match");
  }

  const topRow = document.createElement("div");
  topRow.className = "song-card__top";

  const genreTag = document.createElement("span");
  genreTag.className = "genre-tag";
  genreTag.textContent = cancion.categoria;

  const yearSpan = document.createElement("span");
  yearSpan.className = "song-year";
  yearSpan.textContent = String(cancion.anio);

  topRow.append(genreTag, yearSpan);

  const title = document.createElement("h3");
  title.className = "song-title";
  title.textContent = cancion.titulo;

  const artist = document.createElement("p");
  artist.className = "song-artist";
  artist.textContent = cancion.artista;

  card.append(topRow, title, artist);

  if (mostrarSimilitud && typeof cancion.porcentajeSimilitud === "number") {
    const simBox = document.createElement("div");
    simBox.className = "similarity-box";

    const simRow = document.createElement("div");
    simRow.className = "similarity-box__row";

    const simLabel = document.createElement("span");
    simLabel.className = "similarity-label";
    simLabel.textContent = indice === 0 ? "Mejor coincidencia semántica" : "Similitud de coseno";

    const simVal = document.createElement("span");
    simVal.className = "similarity-value";
    simVal.textContent = `${cancion.porcentajeSimilitud.toFixed(2)}%`;

    simRow.append(simLabel, simVal);

    const track = document.createElement("div");
    track.className = "similarity-track";

    const fill = document.createElement("div");
    fill.className = "similarity-fill";
    const ancho = Math.max(8, Math.min(100, cancion.porcentajeSimilitud));
    fill.style.width = `${ancho}%`;

    track.appendChild(fill);
    simBox.append(simRow, track);
    card.appendChild(simBox);
  }

  const desc = document.createElement("p");
  desc.className = "song-desc";
  desc.textContent = cancion.descripcion;

  const mood = document.createElement("p");
  mood.className = "song-mood";
  mood.textContent = `Ambiente: ${cancion.mood}`;

  card.append(desc, mood);
  return card;
}

function renderizarCanciones(canciones, { mostrarSimilitud = false } = {}) {
  el.songsGrid.replaceChildren();

  if (!canciones || canciones.length === 0) {
    el.emptyState.classList.remove("hidden");
    return;
  }

  el.emptyState.classList.add("hidden");
  canciones.forEach((cancion, idx) => {
    el.songsGrid.appendChild(crearTarjetaCancion(cancion, idx, mostrarSimilitud));
  });
}

function renderizarInspectorVectorial(info) {
  el.vectorDimsBadge.textContent = `${info.dimensiones.toLocaleString("es-GT")} dims`;
  el.vectorPreview.textContent = `[ ${info.muestraVector.join(", ")}, ... ]`;
  el.vectorCompareCount.textContent = `Comparadas en SQLite: ${info.totalComparadas} canciones`;
  el.vectorSqliteTime.textContent = `Cálculo vectorial: ${info.tiempoSQLiteMs} ms`;

  el.vectorBars.replaceChildren();
  const maxAbs = Math.max(...info.muestraVector.map((v) => Math.abs(v)), 0.01);
  for (const valor of info.muestraVector) {
    const barra = document.createElement("div");
    barra.className = "v-bar";
    const alturaPct = Math.max(18, Math.round((Math.abs(valor) / maxAbs) * 100));
    barra.style.height = `${alturaPct}%`;
    el.vectorBars.appendChild(barra);
  }
}

async function cargarCatalogoSQLite() {
  ocultarAlerta();
  estado.modoResultadosSemantica = false;
  el.aiResponseSection.classList.add("hidden");
  el.resetViewBtn.classList.add("hidden");

  try {
    const params = new URLSearchParams({ categoria: estado.categoriaActiva });
    const resp = await fetch(`/api/songs?${params.toString()}`);
    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      throw new Error(data.error || "No se pudo consultar la base SQLite.");
    }

    if (estado.categorias.length === 0 && Array.isArray(data.categorias)) {
      estado.categorias = data.categorias;
      renderizarBotonesCategorias(data.categorias);
    }

    if (data.apiKeyConfigurada) {
      el.statusBadge.className = "status-badge is-ready";
      el.statusText.textContent = `SQLite Activo · ${data.total} canciones vectorizadas`;
    } else {
      el.statusBadge.className = "status-badge is-warn";
      el.statusText.textContent = "SQLite listo · Pendiente GEMINI_API_KEY en .env";
    }

    const sufijoCat =
      estado.categoriaActiva === "Todas" ? "todas las categorías" : `la categoría «${estado.categoriaActiva}»`;
    el.catalogHeading.textContent = `Catálogo Vectorial en SQLite (${data.total})`;
    el.catalogSubtitle.textContent = `Mostrando canciones de ${sufijoCat}. Realiza una consulta arriba para calcular similitud semántica.`;

    renderizarCanciones(data.canciones, { mostrarSimilitud: false });
  } catch (err) {
    el.statusBadge.className = "status-badge is-warn";
    el.statusText.textContent = "Error al conectar con SQLite";
    mostrarAlerta("No se pudo cargar el catálogo", err.message);
  }
}

async function ejecutarBusquedaSemantica(consultaTexto) {
  const limpia = consultaTexto.trim();
  if (!limpia) return;

  estado.consultaActiva = limpia;
  ocultarAlerta();
  el.loadingSection.classList.remove("hidden");
  el.submitBtn.disabled = true;
  el.submitBtnLabel.textContent = "Consultando...";

  try {
    const resp = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: limpia,
        categoria: estado.categoriaActiva,
      }),
    });

    const data = await resp.json();
    if (!resp.ok || !data.ok) {
      throw new Error(data.error || "Ocurrió un error al procesar la búsqueda semántica.");
    }

    estado.modoResultadosSemantica = true;
    el.aiResponseText.textContent = data.respuestaIA;
    el.responseMeta.textContent = `${data.modeloGeneracion} · ${data.tiempoTotalMs} ms`;
    renderizarInspectorVectorial(data.transformacionEmbedding);

    el.aiResponseSection.classList.remove("hidden");
    el.resetViewBtn.classList.remove("hidden");

    const filtroTexto =
      data.categoriaActiva === "Todas" ? "todo el catálogo SQLite" : `«${data.categoriaActiva}»`;
    el.catalogHeading.textContent = `Coincidencias por Similitud Semántica (${data.resultados.length})`;
    el.catalogSubtitle.textContent = `Ordenadas de mayor a menor similitud vectorial en ${filtroTexto} para: "${data.consulta}"`;

    renderizarCanciones(data.resultados, { mostrarSimilitud: true });
  } catch (err) {
    mostrarAlerta("No se pudo completar la consulta con IA", err.message);
  } finally {
    el.loadingSection.classList.add("hidden");
    el.submitBtn.disabled = false;
    el.submitBtnLabel.textContent = "Buscar con IA";
  }
}

// Eventos de interfaz
el.searchInput.addEventListener("input", () => {
  const tieneTexto = el.searchInput.value.trim().length > 0;
  el.clearSearchBtn.classList.toggle("hidden", !tieneTexto);
});

el.clearSearchBtn.addEventListener("click", async () => {
  el.searchInput.value = "";
  estado.consultaActiva = "";
  el.clearSearchBtn.classList.add("hidden");
  el.searchInput.focus();
  await cargarCatalogoSQLite();
});

el.resetViewBtn.addEventListener("click", async () => {
  el.searchInput.value = "";
  estado.consultaActiva = "";
  el.clearSearchBtn.classList.add("hidden");
  await cargarCatalogoSQLite();
});

el.searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const consulta = el.searchInput.value.trim();
  if (!consulta) {
    mostrarAlerta("Escribe tu consulta", "Ingresa un artista, canción, emoción o momento para buscar.");
    el.searchInput.focus();
    return;
  }
  await ejecutarBusquedaSemantica(consulta);
});

for (const chip of document.querySelectorAll(".prompt-chip")) {
  chip.addEventListener("click", async () => {
    const query = chip.getAttribute("data-query") || "";
    el.searchInput.value = query;
    el.clearSearchBtn.classList.remove("hidden");
    await ejecutarBusquedaSemantica(query);
  });
}

// Inicialización al abrir la aplicación
cargarCatalogoSQLite();
