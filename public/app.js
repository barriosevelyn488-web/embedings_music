const ES_LIVE_SERVER =
  (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") &&
  window.location.port &&
  window.location.port !== "3000";

const API_BASE = ES_LIVE_SERVER ? "http://localhost:3000" : "";

const STORAGE_FAVS_KEY = "sonora_favoritas_v1";
const STORAGE_PLAYS_KEY = "sonora_interacciones_v1";
const STORAGE_THEME_KEY = "sonora_tema_v1";

const estado = {
  vista: "home", // "home" | "favoritas"
  generoActivo: "Todas",
  consultaBusqueda: "",
  catalogoCompleto: [],
  cancionesMostradas: [],
  categorias: [],
  favoritasIds: new Set(JSON.parse(localStorage.getItem(STORAGE_FAVS_KEY) || "[]")),
  extraPlaysLocal: JSON.parse(localStorage.getItem(STORAGE_PLAYS_KEY) || "{}"),
  cancionEnModal: null,
  historialChat: [],
  mostrandoAfinidad: false,
};

const el = {
  navHomeBtn: document.getElementById("navHomeBtn"),
  navFavoritesBtn: document.getElementById("navFavoritesBtn"),
  favCountBadge: document.getElementById("favCountBadge"),
  sidebarGenresList: document.getElementById("sidebarGenresList"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  themeToggleText: document.getElementById("themeToggleText"),

  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  searchSubmitBtn: document.getElementById("searchSubmitBtn"),

  toastAlert: document.getElementById("toastAlert"),
  trendingSection: document.getElementById("trendingSection"),
  trendingGrid: document.getElementById("trendingGrid"),
  genreChipsContainer: document.getElementById("genreChipsContainer"),

  songsSectionHeading: document.getElementById("songsSectionHeading"),
  songsSectionSubtitle: document.getElementById("songsSectionSubtitle"),
  backToAllBtn: document.getElementById("backToAllBtn"),
  searchLoading: document.getElementById("searchLoading"),
  emptySongsState: document.getElementById("emptySongsState"),
  emptyTitle: document.getElementById("emptyTitle"),
  emptyMessage: document.getElementById("emptyMessage"),
  songsGrid: document.getElementById("songsGrid"),

  playerModal: document.getElementById("playerModal"),
  playerModalBackdrop: document.getElementById("playerModalBackdrop"),
  modalCoverImg: document.getElementById("modalCoverImg"),
  modalGenreBadge: document.getElementById("modalGenreBadge"),
  modalSongTitle: document.getElementById("modalSongTitle"),
  modalSongArtist: document.getElementById("modalSongArtist"),
  modalPlaysCounter: document.getElementById("modalPlaysCounter"),
  modalFavBtn: document.getElementById("modalFavBtn"),
  modalFavIcon: document.getElementById("modalFavIcon"),
  modalFavLabel: document.getElementById("modalFavLabel"),
  modalAskAiBtn: document.getElementById("modalAskAiBtn"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  youtubeIframe: document.getElementById("youtubeIframe"),
  modalMoodDesc: document.getElementById("modalMoodDesc"),
  externalYoutubeLink: document.getElementById("externalYoutubeLink"),
  modalLyricsContent: document.getElementById("modalLyricsContent"),

  openChatFab: document.getElementById("openChatFab"),
  chatPanel: document.getElementById("chatPanel"),
  closeChatBtn: document.getElementById("closeChatBtn"),
  chatMessages: document.getElementById("chatMessages"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  chatSendBtn: document.getElementById("chatSendBtn"),
};

/* ==========================================================================
   UTILIDADES Y PERSISTENCIA
   ========================================================================== */

function guardarEstadoLocal() {
  localStorage.setItem(STORAGE_FAVS_KEY, JSON.stringify([...estado.favoritasIds]));
  localStorage.setItem(STORAGE_PLAYS_KEY, JSON.stringify(estado.extraPlaysLocal));
}

function mostrarAviso(mensaje) {
  el.toastAlert.textContent = mensaje;
  el.toastAlert.classList.remove("hidden");
  clearTimeout(mostrarAviso._timer);
  mostrarAviso._timer = setTimeout(() => {
    el.toastAlert.classList.add("hidden");
  }, 5000);
}

async function leerJSONSeguro(resp) {
  const txt = await resp.text();
  if (!txt) {
    throw new Error("Asegúrate de tener activo el servidor con «npm start» en http://localhost:3000.");
  }
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error("No se pudo conectar con el catálogo musical. Abre http://localhost:3000.");
  }
}

function esFavorita(id) {
  return estado.favoritasIds.has(Number(id));
}

function totalReproducciones(cancion) {
  const base = Number(cancion.reproducciones || 0);
  const extra = Number(estado.extraPlaysLocal[cancion.id] || 0);
  return base + extra;
}

function actualizarContadorFavoritasUI() {
  el.favCountBadge.textContent = String(estado.favoritasIds.size);
}

/* ==========================================================================
   INTERACCIÓN DINÁMICA (ACTUALIZA "MÁS ESCUCHADAS" Y "FAVORITAS")
   ========================================================================== */

async function registrarInteraccion(cancionId, accion) {
  const id = Number(cancionId);
  const cancion = estado.catalogoCompleto.find((c) => c.id === id);

  try {
    const resp = await fetch(`${API_BASE}/api/interact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, accion }),
    });
    const data = await resp.json();

    if (data.ok && data.actualizadoEnSQLite && data.cancion && cancion) {
      cancion.reproducciones = data.cancion.reproducciones;
    } else if (cancion) {
      const incremento = accion === "play" ? 2 : accion === "letra" || accion === "favorita_on" ? 1 : 0;
      estado.extraPlaysLocal[id] = Number(estado.extraPlaysLocal[id] || 0) + incremento;
      guardarEstadoLocal();
    }
  } catch {
    if (cancion) {
      const incremento = accion === "play" ? 2 : accion === "letra" || accion === "favorita_on" ? 1 : 0;
      estado.extraPlaysLocal[id] = Number(estado.extraPlaysLocal[id] || 0) + incremento;
      guardarEstadoLocal();
    }
  }

  renderizarMasEscuchadas();
  if (estado.cancionEnModal && estado.cancionEnModal.id === id) {
    const actualizada = estado.catalogoCompleto.find((c) => c.id === id) || estado.cancionEnModal;
    el.modalPlaysCounter.textContent = `♪ ${totalReproducciones(actualizada)} escuchas`;
  }
}

async function alternarFavorita(cancion, eventoOpcional = null) {
  if (eventoOpcional) eventoOpcional.stopPropagation();

  const id = Number(cancion.id);
  const activar = !esFavorita(id);

  if (activar) {
    estado.favoritasIds.add(id);
  } else {
    estado.favoritasIds.delete(id);
  }

  guardarEstadoLocal();
  actualizarContadorFavoritasUI();
  await registrarInteraccion(id, activar ? "favorita_on" : "favorita_off");

  if (estado.vista === "favoritas") {
    mostrarVistaFavoritas();
  } else {
    renderizarListadoCanciones(estado.cancionesMostradas, { mostrarAfinidad: estado.mostrandoAfinidad });
  }

  if (estado.cancionEnModal && estado.cancionEnModal.id === id) {
    sincronizarBotonFavModal(cancion);
  }
}

/* ==========================================================================
   RENDERIZADO DE INTERFAZ MUSICAL
   ========================================================================== */

function renderizarControlesGeneros() {
  el.genreChipsContainer.replaceChildren();
  el.sidebarGenresList.replaceChildren();

  const todosGeneros = ["Todas", ...estado.categorias];

  for (const gen of todosGeneros) {
    const etiqueta = gen === "Todas" ? "Todos los géneros" : gen;

    // Chip horizontal
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "genre-chip";
    chip.textContent = etiqueta;
    chip.setAttribute("aria-pressed", String(estado.generoActivo === gen));
    chip.addEventListener("click", () => seleccionarGenero(gen));
    el.genreChipsContainer.appendChild(chip);

    // Acceso en barra lateral
    const sideBtn = document.createElement("button");
    sideBtn.type = "button";
    sideBtn.className = `sidebar-genre-btn${estado.generoActivo === gen ? " is-active" : ""}`;
    sideBtn.textContent = etiqueta;
    sideBtn.addEventListener("click", () => seleccionarGenero(gen));
    el.sidebarGenresList.appendChild(sideBtn);
  }
}

function sincronizarEstadoGenerosUI() {
  const todosGeneros = ["Todas", ...estado.categorias];
  const chips = el.genreChipsContainer.querySelectorAll(".genre-chip");
  const sideBtns = el.sidebarGenresList.querySelectorAll(".sidebar-genre-btn");

  todosGeneros.forEach((gen, idx) => {
    const activo = estado.generoActivo === gen;
    if (chips[idx]) chips[idx].setAttribute("aria-pressed", String(activo));
    if (sideBtns[idx]) sideBtns[idx].classList.toggle("is-active", activo);
  });
}

function renderizarMasEscuchadas() {
  el.trendingGrid.replaceChildren();
  if (estado.catalogoCompleto.length === 0) return;

  const topCinco = [...estado.catalogoCompleto]
    .sort((a, b) => totalReproducciones(b) - totalReproducciones(a))
    .slice(0, 5);

  topCinco.forEach((cancion, idx) => {
    const card = document.createElement("article");
    card.className = "trend-card";
    card.addEventListener("click", () => abrirReproductorModal(cancion, "video"));

    const rank = document.createElement("span");
    rank.className = "trend-rank";
    rank.textContent = `#${idx + 1}`;

    const coverWrap = document.createElement("div");
    coverWrap.className = "trend-cover-wrap";
    const img = document.createElement("img");
    img.src = cancion.portada;
    img.alt = `Portada de ${cancion.titulo}`;
    img.loading = "lazy";
    coverWrap.appendChild(img);

    const info = document.createElement("div");
    info.className = "trend-info";

    const title = document.createElement("h3");
    title.className = "trend-title";
    title.textContent = cancion.titulo;

    const artist = document.createElement("p");
    artist.className = "trend-artist";
    artist.textContent = cancion.artista;

    const plays = document.createElement("span");
    plays.className = "trend-plays";
    plays.textContent = `♪ ${totalReproducciones(cancion)} escuchas`;

    info.append(title, artist, plays);
    card.append(rank, coverWrap, info);
    el.trendingGrid.appendChild(card);
  });
}

function crearTarjetaCancion(cancion, mostrarAfinidad = false) {
  const card = document.createElement("article");
  card.className = "song-card";

  const media = document.createElement("div");
  media.className = "song-card__media";
  media.addEventListener("click", () => abrirReproductorModal(cancion, "video"));

  const img = document.createElement("img");
  img.src = cancion.portada;
  img.alt = `Portada de ${cancion.titulo} por ${cancion.artista}`;
  img.loading = "lazy";
  media.appendChild(img);

  if (mostrarAfinidad && typeof cancion.afinidad === "number") {
    const matchBadge = document.createElement("span");
    matchBadge.className = "match-pill";
    matchBadge.textContent = `${cancion.afinidad}% afín`;
    media.appendChild(matchBadge);
  }

  const favBtn = document.createElement("button");
  favBtn.type = "button";
  const marcada = esFavorita(cancion.id);
  favBtn.className = `card-fav-btn${marcada ? " is-fav" : ""}`;
  favBtn.setAttribute("aria-label", marcada ? "Quitar de favoritas" : "Agregar a favoritas");
  favBtn.textContent = marcada ? "♥" : "♡";
  favBtn.addEventListener("click", (e) => alternarFavorita(cancion, e));

  const playOverlay = document.createElement("button");
  playOverlay.type = "button";
  playOverlay.className = "play-fab-overlay";
  playOverlay.setAttribute("aria-label", `Reproducir ${cancion.titulo}`);
  playOverlay.textContent = "▶";
  playOverlay.addEventListener("click", (e) => {
    e.stopPropagation();
    abrirReproductorModal(cancion, "video");
  });

  media.append(favBtn, playOverlay);

  const title = document.createElement("h3");
  title.className = "song-card__title";
  title.title = cancion.titulo;
  title.textContent = cancion.titulo;

  const artist = document.createElement("p");
  artist.className = "song-card__artist";
  artist.textContent = cancion.artista;

  const metaRow = document.createElement("div");
  metaRow.className = "song-card__meta-row";
  const genreBadge = document.createElement("span");
  genreBadge.className = "genre-pill";
  genreBadge.textContent = cancion.categoria;
  metaRow.appendChild(genreBadge);

  const btnRow = document.createElement("div");
  btnRow.className = "song-card__buttons";

  const btnVideo = document.createElement("button");
  btnVideo.type = "button";
  btnVideo.className = "card-btn";
  btnVideo.textContent = "▶ Video";
  btnVideo.addEventListener("click", () => abrirReproductorModal(cancion, "video"));

  const btnLetra = document.createElement("button");
  btnLetra.type = "button";
  btnLetra.className = "card-btn";
  btnLetra.textContent = "♪ Letra";
  btnLetra.addEventListener("click", () => abrirReproductorModal(cancion, "letra"));

  btnRow.append(btnVideo, btnLetra);
  card.append(media, title, artist, metaRow, btnRow);

  return card;
}

function renderizarListadoCanciones(lista, { mostrarAfinidad = false } = {}) {
  estado.cancionesMostradas = lista;
  estado.mostrandoAfinidad = mostrarAfinidad;
  el.songsGrid.replaceChildren();

  if (!lista || lista.length === 0) {
    el.emptySongsState.classList.remove("hidden");
    return;
  }

  el.emptySongsState.classList.add("hidden");
  for (const cancion of lista) {
    el.songsGrid.appendChild(crearTarjetaCancion(cancion, mostrarAfinidad));
  }
}

/* ==========================================================================
   NAVEGACIÓN, FILTROS Y BUSCADOR SEMÁNTICO
   ========================================================================== */

async function inicializarCatalogo() {
  try {
    const resp = await fetch(`${API_BASE}/api/songs`);
    const data = await leerJSONSeguro(resp);
    if (!resp.ok || !data.ok) throw new Error(data.error || "Error al cargar canciones.");

    estado.catalogoCompleto = data.canciones;
    estado.categorias = data.categorias;

    // Sincronizar favoritas marcadas previamente en SQLite
    for (const c of data.canciones) {
      if (c.esFavorita) estado.favoritasIds.add(c.id);
    }
    guardarEstadoLocal();
    actualizarContadorFavoritasUI();

    renderizarControlesGeneros();
    renderizarMasEscuchadas();
    mostrarVistaExplorar();
  } catch (err) {
    mostrarAviso(err.message);
  }
}

function mostrarVistaExplorar() {
  estado.vista = "home";
  el.navHomeBtn.classList.add("is-active");
  el.navFavoritesBtn.classList.remove("is-active");

  const hayBusqueda = estado.consultaBusqueda.trim().length > 0;
  el.trendingSection.classList.toggle("hidden", hayBusqueda);
  el.backToAllBtn.classList.toggle("hidden", !hayBusqueda && estado.generoActivo === "Todas");

  if (!hayBusqueda) {
    const filtradas =
      estado.generoActivo === "Todas"
        ? estado.catalogoCompleto
        : estado.catalogoCompleto.filter((c) => c.categoria === estado.generoActivo);

    el.songsSectionHeading.textContent =
      estado.generoActivo === "Todas" ? "Todas las canciones" : estado.generoActivo;
    el.songsSectionSubtitle.textContent =
      "Reproduce el video oficial o consulta la letra completa dentro de la aplicación.";
    el.emptyTitle.textContent = "No encontramos canciones en este filtro";
    el.emptyMessage.textContent = "Prueba eligiendo «Todos los géneros».";

    renderizarListadoCanciones(filtradas, { mostrarAfinidad: false });
  }
}

function mostrarVistaFavoritas() {
  estado.vista = "favoritas";
  el.navFavoritesBtn.classList.add("is-active");
  el.navHomeBtn.classList.remove("is-active");
  el.trendingSection.classList.add("hidden");
  el.backToAllBtn.classList.remove("hidden");

  let favs = estado.catalogoCompleto.filter((c) => esFavorita(c.id));
  if (estado.generoActivo !== "Todas") {
    favs = favs.filter((c) => c.categoria === estado.generoActivo);
  }

  el.songsSectionHeading.textContent = `Mis canciones favoritas (${favs.length})`;
  el.songsSectionSubtitle.textContent = "Tus canciones guardadas para escuchar cuando quieras.";
  el.emptyTitle.textContent = "Todavía no tienes canciones favoritas";
  el.emptyMessage.textContent = "Toca el ícono ♡ en cualquier canción para guardarla aquí.";

  renderizarListadoCanciones(favs, { mostrarAfinidad: false });
}

async function seleccionarGenero(genero) {
  estado.generoActivo = genero;
  sincronizarEstadoGenerosUI();

  if (estado.vista === "favoritas") {
    mostrarVistaFavoritas();
    return;
  }

  if (estado.consultaBusqueda.trim()) {
    await ejecutarBusquedaSemantica(estado.consultaBusqueda);
  } else {
    mostrarVistaExplorar();
  }
}

async function ejecutarBusquedaSemantica(texto) {
  const consulta = texto.trim();
  if (!consulta) {
    limpiarBusqueda();
    return;
  }

  estado.vista = "home";
  estado.consultaBusqueda = consulta;
  el.navHomeBtn.classList.add("is-active");
  el.navFavoritesBtn.classList.remove("is-active");
  el.trendingSection.classList.add("hidden");
  el.backToAllBtn.classList.remove("hidden");
  el.searchLoading.classList.remove("hidden");
  el.searchSubmitBtn.disabled = true;

  try {
    const resp = await fetch(`${API_BASE}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: consulta,
        categoria: estado.generoActivo,
      }),
    });

    const data = await leerJSONSeguro(resp);
    if (!resp.ok || !data.ok) throw new Error(data.error || "No se pudo completar la búsqueda.");

    el.songsSectionHeading.textContent = `Resultados para «${consulta}»`;
    el.songsSectionSubtitle.textContent =
      estado.generoActivo === "Todas"
        ? "Ordenados según coincidencia musical, letra y ambiente."
        : `Filtrados dentro de ${estado.generoActivo}.`;

    renderizarListadoCanciones(data.resultados, { mostrarAfinidad: true });
  } catch (err) {
    mostrarAviso(err.message);
  } finally {
    el.searchLoading.classList.add("hidden");
    el.searchSubmitBtn.disabled = false;
  }
}

function limpiarBusqueda() {
  el.searchInput.value = "";
  estado.consultaBusqueda = "";
  estado.generoActivo = "Todas";
  el.clearSearchBtn.classList.add("hidden");
  sincronizarEstadoGenerosUI();
  mostrarVistaExplorar();
}

/* ==========================================================================
   MODAL REPRODUCTOR YOUTUBE + LETRA
   ========================================================================== */

function sincronizarBotonFavModal(cancion) {
  const fav = esFavorita(cancion.id);
  el.modalFavBtn.classList.toggle("is-fav", fav);
  el.modalFavIcon.textContent = fav ? "♥" : "♡";
  el.modalFavLabel.textContent = fav ? "En favoritas" : "Guardar";
}

function abrirReproductorModal(cancionBase, foco = "video") {
  const cancion = estado.catalogoCompleto.find((c) => c.id === cancionBase.id) || cancionBase;
  estado.cancionEnModal = cancion;

  el.modalCoverImg.src = cancion.portada;
  el.modalCoverImg.alt = `Portada de ${cancion.titulo}`;
  el.modalGenreBadge.textContent = `${cancion.categoria} · ${cancion.anio}`;
  el.modalSongTitle.textContent = cancion.titulo;
  el.modalSongArtist.textContent = cancion.artista;
  el.modalMoodDesc.textContent = cancion.descripcion;
  el.modalLyricsContent.textContent = cancion.letra || "Letra no disponible.";
  el.modalPlaysCounter.textContent = `♪ ${totalReproducciones(cancion)} escuchas`;

  sincronizarBotonFavModal(cancion);

  if (cancion.youtubeId) {
    const autoplayParam = foco === "video" ? "1" : "0";
    el.youtubeIframe.src = `https://www.youtube.com/embed/${encodeURIComponent(cancion.youtubeId)}?autoplay=${autoplayParam}&rel=0`;
    el.externalYoutubeLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(cancion.youtubeId)}`;
  }

  el.playerModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  if (foco === "letra") {
    el.modalLyricsContent.scrollTop = 0;
    registrarInteraccion(cancion.id, "letra");
  } else {
    registrarInteraccion(cancion.id, "play");
  }
}

function cerrarReproductorModal() {
  el.youtubeIframe.src = "";
  el.playerModal.classList.add("hidden");
  document.body.style.overflow = "";
  estado.cancionEnModal = null;
}

/* ==========================================================================
   CHAT FLOTANTE CON AVATAR MUSICAL ("LIRA")
   ========================================================================== */

function agregarMensajeChat(rol, texto, sugerencias = []) {
  const burbuja = document.createElement("div");
  burbuja.className = `chat-msg ${rol === "usuario" ? "chat-msg--user" : "chat-msg--lira"}`;
  burbuja.textContent = texto;

  if (rol === "lira" && Array.isArray(sugerencias) && sugerencias.length > 0) {
    const contenedorPicks = document.createElement("div");
    contenedorPicks.className = "chat-song-picks";

    for (const sug of sugerencias) {
      const btnSong = document.createElement("button");
      btnSong.type = "button";
      btnSong.className = "chat-song-btn";

      const img = document.createElement("img");
      img.src = sug.portada;
      img.alt = "";

      const infoSpan = document.createElement("span");
      infoSpan.textContent = `▶ ${sug.titulo} — ${sug.artista}`;

      btnSong.append(img, infoSpan);
      btnSong.addEventListener("click", () => {
        const completa = estado.catalogoCompleto.find((c) => c.id === sug.id);
        if (completa) abrirReproductorModal(completa, "video");
      });
      contenedorPicks.appendChild(btnSong);
    }

    burbuja.appendChild(contenedorPicks);
  }

  el.chatMessages.appendChild(burbuja);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function abrirChatPanel() {
  el.chatPanel.classList.remove("hidden");
  el.openChatFab.setAttribute("aria-expanded", "true");
  if (el.chatMessages.children.length === 0) {
    agregarMensajeChat(
      "lira",
      "¡Hola! Soy Lira 🎵 Pregúntame sobre la historia o letra de una canción, un artista o cuéntame qué ganas tienes de escuchar hoy."
    );
  }
  el.chatInput.focus();
}

function cerrarChatPanel() {
  el.chatPanel.classList.add("hidden");
  el.openChatFab.setAttribute("aria-expanded", "false");
}

async function enviarPreguntaALira(preguntaTexto) {
  const pregunta = preguntaTexto.trim();
  if (!pregunta) return;

  agregarMensajeChat("usuario", pregunta);
  estado.historialChat.push({ rol: "usuario", texto: pregunta });
  el.chatInput.value = "";
  el.chatSendBtn.disabled = true;

  const indicador = document.createElement("div");
  indicador.className = "chat-msg chat-msg--lira";
  indicador.textContent = "Lira está escuchando...";
  el.chatMessages.appendChild(indicador);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;

  try {
    const resp = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensaje: pregunta,
        historial: estado.historialChat.slice(-6),
      }),
    });

    const data = await leerJSONSeguro(resp);
    indicador.remove();

    if (!resp.ok || !data.ok) {
      throw new Error(data.error || "No pude responder en este momento.");
    }

    agregarMensajeChat("lira", data.respuesta, data.sugerencias || []);
    estado.historialChat.push({ rol: "lira", texto: data.respuesta });
  } catch (err) {
    indicador.remove();
    agregarMensajeChat("lira", `Ups: ${err.message}`);
  } finally {
    el.chatSendBtn.disabled = false;
  }
}

/* ==========================================================================
   TEMA DE CONTRASTE Y EVENTOS
   ========================================================================== */

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  localStorage.setItem(STORAGE_THEME_KEY, tema);
  el.themeToggleText.textContent = tema === "dark" ? "Modo crema cálido" : "Modo vinilo oscuro";
}

const temaGuardado = localStorage.getItem(STORAGE_THEME_KEY) || "dark";
aplicarTema(temaGuardado);

el.themeToggleBtn.addEventListener("click", () => {
  const actual = document.documentElement.getAttribute("data-theme") || "dark";
  aplicarTema(actual === "dark" ? "light" : "dark");
});

el.navHomeBtn.addEventListener("click", () => mostrarVistaExplorar());
el.navFavoritesBtn.addEventListener("click", () => mostrarVistaFavoritas());
el.backToAllBtn.addEventListener("click", () => limpiarBusqueda());

el.searchInput.addEventListener("input", () => {
  const texto = el.searchInput.value.trim();
  el.clearSearchBtn.classList.toggle("hidden", texto.length === 0);
  if (texto.length === 0 && estado.consultaBusqueda) {
    limpiarBusqueda();
  }
});

el.clearSearchBtn.addEventListener("click", () => limpiarBusqueda());

el.searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await ejecutarBusquedaSemantica(el.searchInput.value);
});

el.modalFavBtn.addEventListener("click", () => {
  if (estado.cancionEnModal) alternarFavorita(estado.cancionEnModal);
});

el.modalAskAiBtn.addEventListener("click", () => {
  if (!estado.cancionEnModal) return;
  const c = estado.cancionEnModal;
  cerrarReproductorModal();
  abrirChatPanel();
  enviarPreguntaALira(`Cuéntame de qué trata la canción "${c.titulo}" de ${c.artista} y recomiéndame alguna parecida.`);
});

el.closeModalBtn.addEventListener("click", cerrarReproductorModal);
el.playerModalBackdrop.addEventListener("click", cerrarReproductorModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !el.playerModal.classList.contains("hidden")) {
    cerrarReproductorModal();
  }
});

el.openChatFab.addEventListener("click", () => {
  if (el.chatPanel.classList.contains("hidden")) {
    abrirChatPanel();
  } else {
    cerrarChatPanel();
  }
});

el.closeChatBtn.addEventListener("click", cerrarChatPanel);

el.chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await enviarPreguntaALira(el.chatInput.value);
});

for (const qBtn of document.querySelectorAll(".chat-QuickBtn")) {
  qBtn.addEventListener("click", () => {
    const q = qBtn.getAttribute("data-question") || "";
    enviarPreguntaALira(q);
  });
}

// Iniciar aplicación
inicializarCatalogo();
