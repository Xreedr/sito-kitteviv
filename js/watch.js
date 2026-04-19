import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAhqo2VEhtM4WMYtRSWaDj542aaFvv0Xp8",
  authDomain: "mystreamkitteviv.firebaseapp.com",
  projectId: "mystreamkitteviv",
  storageBucket: "mystreamkitteviv.firebasestorage.app",
  messagingSenderId: "1088703261672",
  appId: "1:1088703261672:web:cb2b0ddbda6eb235ba125d"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

if (sessionStorage.getItem('ms_auth') !== '1') location.href = 'index.html';
const currentUser = sessionStorage.getItem('ms_user') || 'utente';
const currentLang = localStorage.getItem(`ms_${currentUser}_lang`) || 'en-US';

const WATCH_LABELS = {
  'en-US': { back:'Back', source:'Video source', episodes:'Episodes', loading:'Loading player...', next_ep:'Next episode', season:'Season', watched:'watched' },
  'it-IT': { back:'Torna indietro', source:'Fonte video', episodes:'Episodi', loading:'Caricamento player...', next_ep:'Prossimo episodio', season:'Stagione', watched:'visto' },
  'fr-FR': { back:'Retour', source:'Source vidéo', episodes:'Épisodes', loading:'Chargement...', next_ep:'Épisode suivant', season:'Saison', watched:'vu' },
  'es-ES': { back:'Volver', source:'Fuente de video', episodes:'Episodios', loading:'Cargando...', next_ep:'Siguiente episodio', season:'Temporada', watched:'visto' },
  'de-DE': { back:'Zurück', source:'Videoquelle', episodes:'Episoden', loading:'Laden...', next_ep:'Nächste Episode', season:'Staffel', watched:'gesehen' },
};
const wl = WATCH_LABELS[currentLang] || WATCH_LABELS['en-US'];

// Applica traduzioni al DOM
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('lbl-back').textContent = wl.back;
  document.getElementById('lbl-loading').textContent = wl.loading;
  document.getElementById('lbl-next-ep').textContent = wl.next_ep;
  document.getElementById('lbl-source').textContent = wl.source + ':';
  document.getElementById('lbl-episodes').textContent = wl.episodes;
});

function sk(k) { return `ms_${currentUser}_${k}`; }
function getWatched() { return JSON.parse(localStorage.getItem(sk('watched')) || '{}'); }
function saveWatched(w) { localStorage.setItem(sk('watched'), JSON.stringify(w)); }
function getHistory() { return JSON.parse(localStorage.getItem(sk('history')) || '[]'); }
function saveHistory(h) { localStorage.setItem(sk('history'), JSON.stringify(h)); fbSaveHistory(h); }

function addToHistory(item) {
  let h = getHistory();
  h = h.filter(x => !(x.id === item.id && x.type === item.type));
  h.unshift({ ...item, ts: Date.now() });
  if (h.length > 30) h = h.slice(0, 30);
  saveHistory(h);
}

async function fbSaveHistory(h) {
  try {
    await setDoc(doc(db, 'history', currentUser), { items: JSON.stringify(h) });
  } catch(e) { console.warn('Firebase save error:', e); }
}

function markWatched(key) {
  const w = getWatched();
  w[key] = true;
  saveWatched(w);
}

const params = new URLSearchParams(location.search);
const mediaType = params.get('type') || 'movie';
const tmdbId    = params.get('id') || '';
if (!tmdbId) { location.href = 'home.html'; }
const season    = parseInt(params.get('s') || '1');
const episode   = parseInt(params.get('e') || '1');
const titleP    = params.get('title') || '';
const epnameP   = params.get('epname') || '';
const TMDB_KEY  = '68206e948d6ca8853d8565cbfec26075';
const TMDB      = 'https://api.themoviedb.org/3';
const IMG       = 'https://image.tmdb.org/t/p';

let currentSeason    = season;
let currentEpisode   = episode;
let currentSource    = 0;
let episodesBySeason = {};
let mediaData        = null;
let historySaved     = false;

function getEmbedUrl(src, type, id, s, e) {
  if (src === 0) return type === 'movie' ? `https://vixsrc.to/movie/${id}?lang=it` : `https://vixsrc.to/tv/${id}/${s}/${e}?lang=it`;
  if (src === 1) return type === 'movie' ? `https://vidsrc.to/embed/movie/${id}` : `https://vidsrc.to/embed/tv/${id}/${s}/${e}`;
  if (src === 2) return type === 'movie' ? `https://embed.smashystream.com/playere.php?tmdb=${id}` : `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}`;
  return '';
}

function loadPlayer() {
  const url = getEmbedUrl(currentSource, mediaType, tmdbId, currentSeason, currentEpisode);
  const frame = document.getElementById('player-frame');
  const loading = document.getElementById('player-loading');
  loading.style.display = 'flex';
  frame.src = '';
  setTimeout(() => {
    frame.src = url;
    frame.onload = () => { loading.style.display = 'none'; };
    setTimeout(() => { loading.style.display = 'none'; }, 5000);
  }, 300);
}

function switchSource(idx, btn) {
  currentSource = idx;
  document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadPlayer();
}

function updateHeader() {
  document.getElementById('np-title').textContent = titleP || '—';
  if (mediaType === 'tv') {
    document.getElementById('np-sub').textContent = `S${currentSeason} · E${currentEpisode}${epnameP ? ' — ' + epnameP : ''}`;
  } else {
    document.getElementById('np-sub').textContent = 'Film';
  }
  document.title = `${titleP || 'MyStream'} — MyStream`;
}

async function loadInfo() {
  try {
    const url = new URL(`${TMDB}/${mediaType}/${tmdbId}`);
    url.searchParams.set('api_key', TMDB_KEY);
    url.searchParams.set('language', localStorage.getItem(`ms_${currentUser}_lang`) || 'it-IT');
    const r = await fetch(url.toString());
    if (!r.ok) return;
    mediaData = await r.json();

    const title  = mediaData.title || mediaData.name || titleP;
    const year   = (mediaData.release_date || mediaData.first_air_date || '').slice(0, 4);
    const rating = mediaData.vote_average ? mediaData.vote_average.toFixed(1) : '—';
    const poster = mediaData.poster_path ? `${IMG}/w342${mediaData.poster_path}` : '';
    const desc   = mediaData.overview || '';
    const genres = (mediaData.genres || []).slice(0, 3).map(g => g.name).join(' · ');

    document.getElementById('media-title').textContent = title;
    document.getElementById('media-meta').innerHTML = `
      <span class="media-rating">★ ${rating}</span>
      <span>${year}</span>
      ${mediaData.runtime ? `<span>${mediaData.runtime} min</span>` : ''}
      ${mediaData.number_of_seasons ? `<span>${mediaData.number_of_seasons} stagioni</span>` : ''}
      ${genres ? `<span>${genres}</span>` : ''}
    `;
    document.getElementById('media-desc').textContent = desc;

    if (poster) {
      document.getElementById('media-poster').style.display = 'block';
      document.getElementById('media-poster-img').src = poster;
    }

    const histBackdrop = mediaData.backdrop_path ? `${IMG}/w780${mediaData.backdrop_path}` : '';
    if (!historySaved) {
      historySaved = true;
      addToHistory({
        id: tmdbId, type: mediaType, title,
        backdrop: histBackdrop,
        season:  mediaType === 'tv' ? currentSeason  : undefined,
        episode: mediaType === 'tv' ? currentEpisode : undefined,
        epname:  mediaType === 'tv' ? (epnameP || '') : undefined
      });
    }

    if (mediaType === 'tv') {
      markWatched(`tv_${tmdbId}_s${currentSeason}_e${currentEpisode}`);
      await loadTVSeasons(mediaData);
    } else {
      markWatched(`movie_${tmdbId}`);
    }

  } catch(e) {
    console.error('Info error:', e);
  }
}

async function loadTVSeasons(data) {
  const seasons = (data.seasons || []).filter(s => s.season_number > 0);
  if (!seasons.length) return;
  const sel = document.getElementById('season-sel');
  sel.innerHTML = seasons.map(s =>
    `<option value="${s.season_number}" ${s.season_number === currentSeason ? 'selected' : ''}>Stagione ${s.season_number}</option>`
  ).join('');
  document.getElementById('episodes-section').style.display = 'block';
  await loadEpisodes(currentSeason);

  const currentSeasonData = episodesBySeason[currentSeason] || [];
  const hasNext = currentEpisode < currentSeasonData.length || seasons.some(s => s.season_number > currentSeason);
  if (hasNext) {
    document.getElementById('next-ep-overlay').setAttribute('data-show', '1');
    const btn = document.getElementById('next-ep-overlay');
    btn.onmouseover = () => { btn.style.background = 'rgba(229,9,20,0.9)'; btn.style.borderColor = '#e50914'; };
    btn.onmouseout  = () => { btn.style.background = 'rgba(0,0,0,0.85)';   btn.style.borderColor = 'rgba(229,9,20,0.5)'; };
  }
}

async function loadEpisodes(seasonNum) {
  const list = document.getElementById('episodes-list');
  list.innerHTML = '<div style="padding:12px;color:#555;font-size:0.82rem">Caricamento...</div>';
  seasonNum = parseInt(seasonNum);
  try {
    if (!episodesBySeason[seasonNum]) {
      const url = new URL(`${TMDB}/tv/${tmdbId}/season/${seasonNum}`);
      url.searchParams.set('api_key', TMDB_KEY);
      url.searchParams.set('language', localStorage.getItem(`ms_${currentUser}_lang`) || 'en-EN');
      const r = await fetch(url.toString());
      episodesBySeason[seasonNum] = (await r.json()).episodes || [];
    }
    renderEpisodes(seasonNum);
  } catch(e) {
    list.innerHTML = '<div style="padding:12px;color:#555;font-size:0.82rem">Errore nel caricamento.</div>';
  }
}

function renderEpisodes(seasonNum) {
  const eps     = episodesBySeason[seasonNum] || [];
  const list    = document.getElementById('episodes-list');
  const watched = getWatched();
  list.innerHTML = '';

  eps.forEach(ep => {
    const wKey      = `tv_${tmdbId}_s${seasonNum}_e${ep.episode_number}`;
    const isCurrent = seasonNum === currentSeason && ep.episode_number === currentEpisode;
    const isWatched = watched[wKey];
    const title     = mediaData ? (mediaData.name || titleP) : titleP;

    const a = document.createElement('a');
    a.className = `ep-item${isCurrent ? ' current' : ''}${isWatched && !isCurrent ? ' watched' : ''}`;
    a.href = `watch.html?type=tv&id=${tmdbId}&s=${seasonNum}&e=${ep.episode_number}&title=${encodeURIComponent(title)}&epname=${encodeURIComponent(ep.name)}`;
    a.innerHTML = `
      <span class="ep-num">${ep.episode_number}</span>
      <span class="ep-name">${ep.name}</span>
      <span class="ep-icon">${isCurrent ? '▶' : isWatched ? '✓' : ''}</span>`;
    list.appendChild(a);
  });

  setTimeout(() => {
    const cur = list.querySelector('.current');
    if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 100);
}

async function changeSeason(val) {
  await loadEpisodes(parseInt(val));
}

function goNextEpisode() {
  if (!mediaData) return;
  const seasons = (mediaData.seasons || []).filter(s => s.season_number > 0);
  const currentSeasonData = episodesBySeason[currentSeason] || [];
  const nextEpNum = currentEpisode + 1;
  const title = mediaData.name || titleP;

  if (nextEpNum <= currentSeasonData.length) {
    const nextEp = currentSeasonData.find(e => e.episode_number === nextEpNum);
    location.href = `watch.html?type=tv&id=${tmdbId}&s=${currentSeason}&e=${nextEpNum}&title=${encodeURIComponent(title)}&epname=${encodeURIComponent(nextEp?.name || '')}`;
  } else {
    const nextSeason = seasons.find(s => s.season_number > currentSeason);
    if (nextSeason) {
      location.href = `watch.html?type=tv&id=${tmdbId}&s=${nextSeason.season_number}&e=1&title=${encodeURIComponent(title)}&epname=`;
    }
  }
}

// Esponi funzioni globali per l'HTML
window.switchSource = switchSource;
window.changeSeason = changeSeason;
window.goNextEpisode = goNextEpisode;
document.getElementById('next-ep-overlay').onclick = goNextEpisode;

updateHeader();
loadPlayer();
loadInfo();