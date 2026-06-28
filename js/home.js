import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function updateMobileUsername() {
  const mobileUsernameSpan = document.getElementById('usernameDisplayMobile');
  if (mobileUsernameSpan) {
    mobileUsernameSpan.textContent = currentUser;
  }
}

const firebaseConfig = {
  apiKey:"AIzaSyAhqo2VEhtM4WMYtRSWaDj542aaFvv0Xp8",authDomain:"mystreamkitteviv.firebaseapp.com",
  projectId:"mystreamkitteviv",storageBucket:"mystreamkitteviv.firebasestorage.app",
  messagingSenderId:"1088703261672",appId:"1:1088703261672:web:cb2b0ddbda6eb235ba125d"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

const TMDB_KEY = '4eaa52ceb26014f8904f49797e999525';
const OMDB_KEY = '4d92da8b';
const TMDB = 'https://api.themoviedb.org/3';
const IMG  = 'https://image.tmdb.org/t/p';
const GENRE_MAP = {
  28:'Azione',12:'Avventura',16:'Animazione',35:'Commedia',80:'Crime',99:'Documentario',
  18:'Dramma',10751:'Famiglia',14:'Fantasy',36:'Storia',27:'Horror',10402:'Musica',
  9648:'Mistero',10749:'Romance',878:'Fantascienza',10770:'TV Movie',53:'Thriller',
  10752:'Guerra',37:'Western',10759:'Action & Adventure',10762:'Kids',10763:'News',
  10764:'Reality',10765:'Sci-Fi & Fantasy',10766:'Soap',10767:'Talk',10768:'War & Politics'
};

// Auth
if (sessionStorage.getItem('ms_auth') !== '1') location.href = 'index.html';
const currentUser = sessionStorage.getItem('ms_user') || 'utente';
document.getElementById('usernameDisplay').textContent = currentUser;
function logout() { sessionStorage.removeItem('ms_auth'); sessionStorage.removeItem('ms_user'); location.href='index.html'; }

// Storage
function storageKey(k) { return `ms_${currentUser}_${k}`; }
function getHistory() { return JSON.parse(localStorage.getItem(storageKey('history'))||'[]'); }
function saveHistory(h) { localStorage.setItem(storageKey('history'),JSON.stringify(h)); fbSaveHistory(h); }
function getWatched() { return JSON.parse(localStorage.getItem(storageKey('watched'))||'{}'); }
function saveWatched(w) { localStorage.setItem(storageKey('watched'),JSON.stringify(w)); }

async function fbSaveHistory(h) {
  try { await setDoc(doc(db,'history',currentUser),{items:JSON.stringify(h)}); } catch(e){}
}
async function fbLoadHistory() {
  try {
    const snap = await getDoc(doc(db,'history',currentUser));
    if (snap.exists()) {
      const remote = JSON.parse(snap.data().items||'[]');
      const local = getHistory();
      const merged = [...remote,...local]
        .filter((x,i,arr)=>arr.findIndex(y=>y.id===x.id&&y.type===x.type)===i)
        .sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,30);
      localStorage.setItem(storageKey('history'),JSON.stringify(merged));
      renderContinueWatching();
    }
  } catch(e){}
}

let currentLang = localStorage.getItem(storageKey('lang')) || 'en-US';
async function tmdb(path, params={}) {
  const url = new URL(`${TMDB}${path}`);
  url.searchParams.set('api_key',TMDB_KEY); url.searchParams.set('language',currentLang);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`TMDB ${r.status}`);
  return r.json();
}

// POPUP NETFLIX-STYLE
const popup = document.getElementById('card-popup');
let popupTimer, activePopupKey = null;
const omdbCache = {}, trailerCache = {};
let isMuted = true;

let activeCard = null;

function positionPopup(rect) {
  const pw = 280, ph = 330;
  let left = rect.left + rect.width/2 - pw/2;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  let top = rect.top + rect.height/2 - ph/2;
  top = Math.max(74, Math.min(top, window.innerHeight - ph - 8));
  popup.style.left = left+'px';
  popup.style.top  = top+'px';
}

function updatePopupOnScroll() {
  if (!activeCard || !popup.classList.contains('visible')) return;
  const rect = activeCard.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    hidePopup();
    return;
  }
  positionPopup(rect);
}

window.addEventListener('scroll', updatePopupOnScroll, { passive: true });

function buildPopupHTML(d, trailerKey, omdb) {
  const watchUrl = d.type==='movie'
    ? `watch.html?type=movie&id=${d.id}&title=${encodeURIComponent(d.name)}`
    : `watch.html?type=tv&id=${d.id}&s=1&e=1&title=${encodeURIComponent(d.name)}`;

  const imdbRating = omdb?.imdbRating && omdb.imdbRating!=='N/A' ? omdb.imdbRating : d.rating||'';
  const rated      = omdb?.Rated      && omdb.Rated!=='N/A'      ? omdb.Rated      : '';
  const seasonsNum = omdb?.totalSeasons && omdb.totalSeasons!=='N/A' ? omdb.totalSeasons : (d.seasons||'');
  const seasonsStr = seasonsNum ? `${seasonsNum} stagion${seasonsNum==1?'e':'i'}` : '';

  let mediaHTML;
  if (trailerKey) {
    const mp = isMuted?1:0;
    mediaHTML = `<iframe src="https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${mp}&controls=0&loop=1&playlist=${trailerKey}&modestbranding=1&rel=0&playsinline=1" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
  } else if (d.backdrop) {
    mediaHTML = `<img src="${d.backdrop}" alt="${d.name}">`;
  } else {
    mediaHTML = `<div style="width:100%;height:100%;background:#0a0a0a;display:flex;align-items:center;justify-content:center;color:#333;font-size:1.8rem">🎬</div>`;
  }

  const genreParts = (d.genres||'').split(' · ').filter(Boolean);
  const genreHTML = genreParts.map((g,i)=>`<span>${g}</span>${i<genreParts.length-1?'<span class="pdot">•</span>':''}`).join('');

  return `
    <div class="popup-media">
      ${mediaHTML}
      <div class="popup-media-fade"></div>
      ${trailerKey?`<button class="popup-sound" id="popup-sound-btn" onclick="togglePopupSound()">${isMuted?'🔇':'🔊'}</button>`:''}
    </div>
    <div class="popup-body">
      <div class="popup-actions">
        <a class="pb pb-play" href="${watchUrl}">
          <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </a>
       <button class="pb pb-circle" title="Add to list" 
  data-pid="${d.id}" data-ptype="${d.type}" data-ptitle="${(d.name||'').replace(/"/g,'')}" data-pposter="${d.backdrop||''}" data-pyear="${d.year||''}"
  onclick="openPlaylistPickerFromBtn(this)">＋</button>
        <button class="pb pb-info" title="Più info" onclick="openModal(${d.id},'${d.type}')">⌄</button>
      </div>
      <div class="popup-meta">
        ${imdbRating?`<span class="pm-rating">★ ${imdbRating}</span>`:''}
        ${d.year?`<span class="pm-year">${d.year}</span>`:''}
        ${seasonsStr?`<span class="pm-seasons">${seasonsStr}</span>`:''}
        ${rated?`<span class="pm-age">${rated}</span>`:''}
      </div>
      ${genreHTML?`<div class="popup-genres">${genreHTML}</div>`:''}
    </div>`;
}

window.togglePopupSound = function() {
  isMuted = !isMuted;
  const card = document.querySelector('.card[data-active="1"]');
  if (!card) return;
  const d = JSON.parse(card.dataset.popup||'{}');
  const key = trailerCache[d.id+'_'+d.type];
  const omdb = omdbCache[d.name+'_'+d.year]||{};
  popup.innerHTML = buildPopupHTML(d, key, omdb);
};

async function showCardPopup(e) {
  const card = e.currentTarget;
  const d = JSON.parse(card.dataset.popup||'{}');
  if (!d.id) return;
  clearTimeout(popupTimer);
  document.querySelectorAll('.card[data-active]').forEach(c=>c.removeAttribute('data-active'));
  card.setAttribute('data-active','1');
  const cacheKey = d.id+'_'+d.type;
  const omdbKey  = d.name+'_'+d.year;
  activePopupKey = cacheKey;

  const rect = card.getBoundingClientRect();
  activeCard = card;

  popup.innerHTML = buildPopupHTML(d, trailerCache[cacheKey]||null, omdbCache[omdbKey]||{});
  positionPopup(rect);
  popupTimer = setTimeout(()=>popup.classList.add('visible'), 220);

  const [trailerKey, omdb] = await Promise.all([
    (async()=>{
      if (trailerCache[cacheKey] !== undefined) return trailerCache[cacheKey];
      try {
        const data = await tmdb(`/${d.type}/${d.id}/videos`,{language:'en-US'});
        const t = (data.results||[]).find(v=>v.type==='Trailer'&&v.site==='YouTube')
               || (data.results||[]).find(v=>v.site==='YouTube');
        trailerCache[cacheKey] = t ? t.key : null;
      } catch { trailerCache[cacheKey]=null; }
      return trailerCache[cacheKey];
    })(),
    (async()=>{
      if (omdbCache[omdbKey]) return omdbCache[omdbKey];
      try {
        const type = d.type==='tv'?'series':'movie';
        const r = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(d.name)}&y=${d.year}&type=${type}&apikey=${OMDB_KEY}`);
        const j = await r.json();
        omdbCache[omdbKey] = j.Response==='True' ? j : {};
      } catch { omdbCache[omdbKey]={}; }
      return omdbCache[omdbKey];
    })()
  ]);

  if (activePopupKey===cacheKey && (popup.classList.contains('visible') || popupTimer)) {
    positionPopup(rect);
    popup.innerHTML = buildPopupHTML(d, trailerKey, omdb);
  }
}

function hideCardPopup() {
  clearTimeout(popupTimer);
  popupTimer = setTimeout(()=>{
    popup.classList.remove('visible');
    activePopupKey = null;
    activeCard = null;
    document.querySelectorAll('.card[data-active]').forEach(c=>c.removeAttribute('data-active'));
  }, 350);
}

popup.addEventListener('mouseenter', ()=>clearTimeout(popupTimer));
popup.addEventListener('mouseleave', hideCardPopup);

// LOGO LAZY LOADER
const logoCache = {};

async function fetchLogo(id, type) {
  const key = `${id}_${type}`;
  if (logoCache[key] !== undefined) return logoCache[key];
  try {
    const data = await tmdb(`/${type}/${id}/images`, { include_image_language: 'en,it,null' });
    const logos = (data.logos || []).filter(l => l.file_path);
    logos.sort((a, b) => (b.width / b.height) - (a.width / a.height) || b.vote_count - a.vote_count);
    logoCache[key] = logos[0] ? `${IMG}/w300${logos[0].file_path}` : null;
  } catch { logoCache[key] = null; }
  return logoCache[key];
}

const logoObserver = new IntersectionObserver(async (entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const card = entry.target;
    logoObserver.unobserve(card);
    const id   = card.dataset.logoId;
    const type = card.dataset.logoType;
    if (!id) continue;
    const url = await fetchLogo(id, type);
    const logoWrap  = card.querySelector(`#logo-${id}-${type}`);
    const labelEl   = card.querySelector(`#label-${id}-${type}`);
    if (url && logoWrap) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.style.opacity = '0';
      img.onload = () => {
        img.style.opacity = '1';
        if (labelEl) labelEl.style.display = 'none';
      };
      img.onerror = () => img.remove();
      logoWrap.appendChild(img);
    }
  }
}, { rootMargin: '200px' });

// BUILD SECTION
function buildTop10Section(title, items, type, containerId) {
  const container = document.getElementById('sliders-container');
  const sec = document.createElement('div');
  sec.className = 'section';
  sec.innerHTML = `
    <div class="section-header">
      <span class="section-title">${title}</span>
    </div>
    <div class="slider-wrap">
      <button class="arrow arrow-left" onclick="scrollSlider(this,-1)"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="top10-slider" id="t10-${Math.random().toString(36).slice(2)}"></div>
      <button class="arrow arrow-right" onclick="scrollSlider(this,1)"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>
    </div>`;
  container.appendChild(sec);
  const slider = sec.querySelector('.top10-slider');

  items.slice(0,10).forEach((item, idx) => {
    const itemType = type || item.media_type || 'movie';
    const poster = item.poster_path ? `${IMG}/w342${item.poster_path}` : '';
    const name = item.title || item.name || '';
    const a = document.createElement('a');
    a.className = 'top10-card';
    a.href = '#';
    a.onclick = (e) => { e.preventDefault(); openModal(item.id, itemType); };
    a.innerHTML = `
      <span class="top10-num">${idx + 1}</span>
      ${poster
        ? `<img class="top10-img" src="${poster}" alt="${name}" loading="lazy">`
        : `<div class="top10-img" style="background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#555">${name}</div>`
      }`;
    slider.appendChild(a);
  });
}

function buildSection(title, items, type, containerId) {
  const container = document.getElementById(containerId||'sliders-container');
  const sec = document.createElement('div');
  sec.className = 'section';
  sec.innerHTML = `
    <div class="section-header">
      <span class="section-title">${title}</span>
      <span class="section-count">${items.length}</span>
    </div>
    <div class="slider-wrap">
      <button class="arrow arrow-left" onclick="scrollSlider(this,-1)"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="slider" id="sl-${Math.random().toString(36).slice(2)}"></div>
      <button class="arrow arrow-right" onclick="scrollSlider(this,1)"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>
    </div>`;
  container.appendChild(sec);
  const slider = sec.querySelector('.slider');

  items.forEach(item => {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = '#';
    const itemType = type || item.media_type || 'movie';
    a.onclick = (ev) => { ev.preventDefault(); openModal(item.id,itemType); };

    const poster   = item.backdrop_path ? `${IMG}/w780${item.backdrop_path}` : (item.poster_path ? `${IMG}/w342${item.poster_path}` : '');
    const backdrop = item.backdrop_path ? `${IMG}/w780${item.backdrop_path}` : '';
    const name     = item.title || item.name || '';
    const year     = (item.release_date||item.first_air_date||'').slice(0,4);
    const rating   = item.vote_average ? item.vote_average.toFixed(1) : '';
    const genres   = (item.genre_ids||[]).slice(0,3).map(id=>GENRE_MAP[id]).filter(Boolean).join(' · ');
    const badge    = itemType==='tv' ? 'Serie' : 'Film';

    a.dataset.popup = JSON.stringify({id:item.id,type:itemType,name,year,rating,genres,backdrop,overview:item.overview||'',seasons:''});
    a.addEventListener('mouseenter', showCardPopup);
    a.addEventListener('mouseleave', hideCardPopup);

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    if (poster) {
      inner.innerHTML = `
        <div class="card-skeleton"></div>
        <img class="card-backdrop" src="${poster}" alt="${name}" loading="lazy"
             onload="this.previousElementSibling.style.display='none'">
        <div class="card-gradient"></div>
        <div class="card-logo-wrap" id="logo-${item.id}-${itemType}"></div>
        <div class="card-label" id="label-${item.id}-${itemType}">
          <div class="card-label-title">${name}</div>
          <div class="card-label-sub">${year}${year&&badge?' · ':''}${badge}</div>
        </div>`;
    } else {
      inner.innerHTML = `
        <div style="width:100%;height:100%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:0.72rem;color:#444;padding:8px;text-align:center">${name}</div>
        <div class="card-gradient"></div>
        <div class="card-label">
          <div class="card-label-title">${name}</div>
          <div class="card-label-sub">${year}${year&&badge?' · ':''}${badge}</div>
        </div>`;
    }

    a.appendChild(inner);
    logoObserver.observe(a);
    a.dataset.logoId   = item.id;
    a.dataset.logoType = itemType;
    slider.appendChild(a);
  });
}

function scrollSlider(btn, dir) {
  const wrap = btn.parentElement;
  const slider = wrap.querySelector('.slider, .top10-slider');
  if (!slider) return;
  const amount = slider.clientWidth * 0.75;
  slider.scrollBy({ left: dir * amount, behavior: 'smooth' });
}

let heroItem=null;
function setHero(item,type) {
  heroItem={item,type};
  const bd=item.backdrop_path?`${IMG}/original${item.backdrop_path}`:'';
  document.getElementById('hero-img').src=bd;
  document.getElementById('hero-title').textContent=item.title||item.name;
  document.getElementById('hero-desc').textContent = item.overview ? item.overview : '...';
  const ui = UI_LABELS[currentLang] || UI_LABELS['it-IT'];
  document.getElementById('hero-badge').textContent =
    type === 'tv'
      ? '📺 ' + (ui.featured_tv || 'Featured TV Show')
      : '🎬 ' + (ui.featured_movie || 'Featured Movie');
  document.getElementById('hero-play').onclick=(e)=>{e.preventDefault();type==='movie'?navigateWatch(item.id,'movie',null,null,item.title):openModal(item.id,type);};
  document.getElementById('hero-info').onclick=()=>openModal(item.id,type);
  const playLabel=document.getElementById('hero-play-label');
  const infoLabel=document.getElementById('hero-info-label');
  if(playLabel) playLabel.textContent=ui.watch_now||'Watch now';
  if(infoLabel) infoLabel.textContent=ui.more_info||'More info';
}

// MODAL
let currentModalId=null,currentModalType=null,episodesBySeason={};
async function openModal(id,type) {
  popup.classList.remove('visible');
  currentModalId=id; currentModalType=type;
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow='hidden';
  document.getElementById('modal-title').textContent='Caricamento...';
  ['modal-tagline','modal-meta','modal-desc','modal-actions','modal-seasons-wrap'].forEach(x=>document.getElementById(x).innerHTML='');
  try {
    const d=await tmdb(`/${type}/${id}`,{append_to_response:'credits'});
    const bd=d.backdrop_path?`${IMG}/w1280${d.backdrop_path}`:(d.poster_path?`${IMG}/w780${d.poster_path}`:'');
    const title=d.title||d.name, year=(d.release_date||d.first_air_date||'').slice(0,4);
    const rating=d.vote_average?d.vote_average.toFixed(1):'—';
    document.getElementById('modal-backdrop').src=bd;
    document.getElementById('modal-title').textContent=title;
    document.getElementById('modal-tagline').textContent=d.tagline||'';
    document.getElementById('modal-meta').innerHTML=`
      <span class="modal-rating">★ ${rating}</span><span>${year}</span>
      ${d.runtime?`<span>${d.runtime} min</span>`:''}
      ${d.number_of_seasons?`<span>${d.number_of_seasons} stagioni</span>`:''}
      ${(d.genres||[]).slice(0,3).map(g=>`<span>${g.name}</span>`).join('')}`;
    document.getElementById('modal-desc').textContent=d.overview||'Nessuna descrizione.';
    if (type==='movie') {
      document.getElementById('modal-actions').innerHTML=`<a class="btn-play" href="watch.html?type=movie&id=${id}&title=${encodeURIComponent(title)}"><svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> ${(UI_LABELS[currentLang]||UI_LABELS['en-US']).watch_movie||'Watch movie'}</a>`;
    } else {
      const seasons=(d.seasons||[]).filter(s=>s.season_number>0);
      episodesBySeason={};
      if (seasons.length) {
        document.getElementById('modal-seasons-wrap').innerHTML=`
          <p class="season-label">Stagione</p>
          <select class="season-select" id="season-sel" onchange="loadEpisodes(this.value)">
            ${seasons.map(s=>`<option value="${s.season_number}">Stagione ${s.season_number}</option>`).join('')}
          </select>
          <div class="episodes-grid" id="ep-grid"><div class="empty">Caricamento episodi...</div></div>`;
        await loadEpisodes(1);
      }
    }
  } catch(e){document.getElementById('modal-title').textContent='Errore nel caricamento.';}
}
async function loadEpisodes(seasonNum) {
  const grid=document.getElementById('ep-grid'); if(!grid)return;
  grid.innerHTML='<div class="empty">Caricamento...</div>';
  const watched=getWatched(),key=`${currentModalType}_${currentModalId}`;
  try {
    if (!episodesBySeason[seasonNum]) { const data=await tmdb(`/tv/${currentModalId}/season/${seasonNum}`); episodesBySeason[seasonNum]=data.episodes||[]; }
    const eps=episodesBySeason[seasonNum]; grid.innerHTML='';
    if (!eps.length){grid.innerHTML='<div class="empty">Nessun episodio.</div>';return;}
    eps.forEach(ep=>{
      const epKey=`${key}_s${seasonNum}_e${ep.episode_number}`,isWatched=watched[epKey];
      const title=document.getElementById('modal-title').textContent;
      const a=document.createElement('a');
      a.className=`ep-btn${isWatched?' watched':''}`;
      a.href=`watch.html?type=tv&id=${currentModalId}&s=${seasonNum}&e=${ep.episode_number}&title=${encodeURIComponent(title)}&epname=${encodeURIComponent(ep.name)}`;
      a.innerHTML=`<span class="ep-num">${ep.episode_number}</span><span class="ep-name">${ep.name}</span>${isWatched?'<span class="ep-check">✓</span>':''}`;
      a.onclick=()=>{const w=getWatched();w[epKey]=true;saveWatched(w);};
      grid.appendChild(a);
    });
  } catch(e){grid.innerHTML='<div class="empty">Errore episodi.</div>';}
}
function closeModal(e){if(e.target===document.getElementById('modal-overlay'))closeModalBtn();}
function closeModalBtn(){document.getElementById('modal-overlay').classList.remove('open');document.body.style.overflow='';episodesBySeason={};}
function navigateWatch(id,type,season,episode,title,epname){let url=`watch.html?type=${type}&id=${id}&title=${encodeURIComponent(title||'')}`;if(type==='tv')url+=`&s=${season}&e=${episode}&epname=${encodeURIComponent(epname||'')}`;location.href=url;}

// CONTINUE WATCHING
function renderContinueWatching() {
  const h=getHistory(),slider=document.getElementById('cw-slider');
  slider.innerHTML='';
  if(!h.length){document.getElementById('cw-section').style.display='none';return;}
  document.getElementById('cw-section').style.display='block';
  h.slice(0,15).forEach(item=>{
    const a=document.createElement('a');a.className='cw-card';
    const wu=item.type==='movie'?`watch.html?type=movie&id=${item.id}&title=${encodeURIComponent(item.title||'')}`:`watch.html?type=tv&id=${item.id}&s=${item.season}&e=${item.episode}&title=${encodeURIComponent(item.title||'')}&epname=${encodeURIComponent(item.epname||'')}`;
    a.href=wu;
    const sub=item.type==='movie'?'Film':`S${item.season} E${item.episode} · ${item.epname||''}`;
    a.innerHTML=`
      ${item.backdrop?`<img src="${item.backdrop}" alt="" loading="lazy">`:'<div style="width:100%;height:100%;background:#222"></div>'}
      <div class="cw-menu"><button class="cw-menu-btn" onclick="event.preventDefault();event.stopPropagation();toggleMenu(this)">⋮</button><div class="cw-dropdown"><button onclick="event.preventDefault();event.stopPropagation();removeContinue(${item.ts})">Rimuovi</button></div></div>
      <div class="cw-play"><svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
      <div class="cw-info"><div class="cw-title">${item.title||''}</div><div class="cw-sub">${sub}</div><div class="cw-bar-wrap"><div class="cw-bar" style="width:${Math.floor(Math.random()*40+20)}%"></div></div></div>`;
    slider.appendChild(a);
  });
}
function toggleMenu(btn){const m=btn.nextElementSibling;document.querySelectorAll('.cw-dropdown').forEach(d=>{if(d!==m)d.style.display='none';});m.style.display=m.style.display==='block'?'none':'block';}
document.addEventListener('click',()=>document.querySelectorAll('.cw-dropdown').forEach(d=>d.style.display='none'));
function removeContinue(ts){let h=getHistory();h=h.filter(i=>i.ts!==ts);saveHistory(h);renderContinueWatching();}

// SEARCH
let searchTimeout;

// Seleziona TUTTI gli input di ricerca (sia desktop che mobile)
document.querySelectorAll('.search-wrap input').forEach(input => {
  input.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    const q = this.value.trim();
    currentSearchQuery = q;
    
    // Sincronizza il testo tra la barra desktop e quella mobile
    document.querySelectorAll('.search-wrap input').forEach(otherInput => {
      if (otherInput !== this) otherInput.value = this.value;
    });

    if(!q){
      clearSearch();
      return;
    }
    searchTimeout = setTimeout(()=>doSearch(q), 450);
  });
});

async function doSearch(q) {
  document.getElementById('search-section').style.display='block';
  const grid=document.getElementById('search-grid');grid.innerHTML='';
  try {
    const data=await tmdb('/search/multi',{query:q});
    const results=(data.results||[]).filter(r=>r.media_type!=='person'&&(r.poster_path||r.backdrop_path));
    if(!results.length){grid.innerHTML='<div class="empty" style="grid-column:1/-1">Nessun risultato.</div>';return;}
    results.slice(0,20).forEach(item=>{
      const type=item.media_type,poster=item.poster_path?`${IMG}/w342${item.poster_path}`:(item.backdrop_path?`${IMG}/w780${item.backdrop_path}`:''),name=item.title||item.name||'';
      const card=document.createElement('div');card.className='search-card';
      
      // Chiusura del menu mobile quando si clicca un risultato
      card.onclick=()=> {
        openModal(item.id,type);
        closeMobileMenu();
      };
      
      card.innerHTML=poster?`<img src="${poster}" alt="${name}" loading="lazy"><div class="search-card-info"><div class="search-card-type">${type==='tv'?'📺 Serie':'🎬 Film'}</div><div class="search-card-title">${name}</div></div>`:`<div style="height:100%;display:flex;align-items:center;justify-content:center;padding:8px;font-size:0.75rem;color:#555;text-align:center">${name}</div>`;
      grid.appendChild(card);
    });
  } catch(e){grid.innerHTML='<div class="empty" style="grid-column:1/-1">Errore.</div>';}
}

function clearSearch(){
  document.getElementById('search-section').style.display='none';
  // Pulisce tutti gli input
  document.querySelectorAll('.search-wrap input').forEach(input => input.value = '');
  currentSearchQuery = '';
}

function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}

// LANGUAGE SELECTOR
const LANGS={'it-IT':'🇮🇹 Italiano','en-US':'🇬🇧 English','fr-FR':'🇫🇷 Français','es-ES':'🇪🇸 Español','de-DE':'🇩🇪 Deutsch'};
function buildLangSelector() {
  const area = document.querySelector('.user-area');
  
  // Selettore per DESKTOP (bandiera + testo)
  const desktopLangSelect = document.createElement('select');
  desktopLangSelect.id = 'desktop-lang-select';
  desktopLangSelect.style.cssText = 'background:#000;border:1px solid #333;border-radius:6px;color:#fff;font-family:DM Sans,sans-serif;font-size:0.78rem;padding:5px 10px;cursor:pointer;outline:none;';
  
  Object.entries(LANGS).forEach(([code, label]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = label;
    if (code === currentLang) opt.selected = true;
    desktopLangSelect.appendChild(opt);
  });
  
  desktopLangSelect.onchange = async () => {
    currentLang = desktopLangSelect.value;
    localStorage.setItem(storageKey('lang'), currentLang);
    
    // Aggiorna anche il selettore mobile se esiste
    const mobileLangSelect = document.getElementById('mobile-lang-select');
    if (mobileLangSelect) mobileLangSelect.value = currentLang;
    
    updateNavbarLabels();
    updateStaticTexts();
    
    if (currentSearchQuery) {
      await doSearch(currentSearchQuery);
      return;
    }
    
    document.getElementById('sliders-container').innerHTML = '';
    await loadSection(currentSection);
    if (currentSection === 'home') {
      renderContinueWatching();
    }
  };
  
  area.insertBefore(desktopLangSelect, area.firstChild);
  
  // Selettore per MOBILE (SOLO bandiera, SENZA testo - più piccolo)
  const mobileLangSelect = document.createElement('select');
  mobileLangSelect.id = 'mobile-lang-select';
  mobileLangSelect.style.cssText = 'background:#1a1a1a;border:1px solid #444;border-radius:8px;color:#fff;font-family:DM Sans,sans-serif;font-size:0.75rem;padding:6px 8px;cursor:pointer;outline:none;width:auto;margin-top:8px;display:inline-block;';
  
  Object.entries(LANGS).forEach(([code, label]) => {
    const opt = document.createElement('option');
    opt.value = code;
    // Prende solo la bandiera (es. "🇮🇹" da "🇮🇹 Italiano")
    const flagOnly = label.split(' ')[0];
    opt.textContent = flagOnly;
    if (code === currentLang) opt.selected = true;
    mobileLangSelect.appendChild(opt);
  });
  
  mobileLangSelect.onchange = async () => {
    currentLang = mobileLangSelect.value;
    localStorage.setItem(storageKey('lang'), currentLang);
    
    // Aggiorna anche il selettore desktop
    const desktopLangSelect = document.getElementById('desktop-lang-select');
    if (desktopLangSelect) desktopLangSelect.value = currentLang;
    
    updateNavbarLabels();
    updateStaticTexts();
    
    if (currentSearchQuery) {
      await doSearch(currentSearchQuery);
      return;
    }
    
    document.getElementById('sliders-container').innerHTML = '';
    await loadSection(currentSection);
    if (currentSection === 'home') {
      renderContinueWatching();
    }
  };
  
  // Inserisce il selettore mobile nel menu a tendina
  const mobileContainer = document.getElementById('mobile-lang-container');
  if (mobileContainer) {
    mobileContainer.appendChild(mobileLangSelect);
  }
}

// GENRE IDS
const GENRE_IDS = {
  action:28, comedy:35, animation:16, horror:27, romance:10749,
  scifi:878, thriller:53, documentary:99, family:10751, crime:80,
  adventure:12, fantasy:14, history:36, music:10402, western:37,
  action_tv:10759, animation_tv:16, comedy_tv:35, drama_tv:18,
  scifi_tv:10765, kids:10762, reality:10764, crime_tv:80
};

const SECTION_LABELS = {
  'it-IT': {
    home:'Home', movies:'Film', tv:'Serie TV', action:'Azione',
    comedy:'Commedia', animation:'Cartoni', horror:'Horror',
    romance:'Romantici', scifi:'Fantascienza', thriller:'Thriller',
    documentary:'Documentari', family:'Famiglia', crime:'Crime'
  },
  'en-US': {
    home:'Home', movies:'Movies', tv:'TV Shows', action:'Action',
    comedy:'Comedy', animation:'Animation', horror:'Horror',
    romance:'Romance', scifi:'Sci-Fi', thriller:'Thriller',
    documentary:'Documentaries', family:'Family', crime:'Crime'
  },
  'fr-FR': {
    home:'Accueil', movies:'Films', tv:'Séries', action:'Action',
    comedy:'Comédie', animation:'Animation', horror:'Horreur',
    romance:'Romance', scifi:'Sci-Fi', thriller:'Thriller',
    documentary:'Documentaires', family:'Famille', crime:'Crime'
  },
  'es-ES': {
    home:'Inicio', movies:'Películas', tv:'Series', action:'Acción',
    comedy:'Comedia', animation:'Animación', horror:'Terror',
    romance:'Romance', scifi:'Ciencia Ficción', thriller:'Thriller',
    documentary:'Documentales', family:'Familia', crime:'Crimen'
  },
  'de-DE': {
    home:'Startseite', movies:'Filme', tv:'Serien', action:'Aktion',
    comedy:'Komödie', animation:'Animation', horror:'Horror',
    romance:'Romantik', scifi:'Sci-Fi', thriller:'Thriller',
    documentary:'Dokumentarfilme', family:'Familie', crime:'Krimi'
  }
};
const UI_LABELS = {
  'it-IT': {
    search_placeholder: 'Cerca film e serie TV...',
    search_results: '🔍 Risultati ricerca',
    search_close: '✕ Chiudi',
    no_results: 'Nessun risultato trovato.',
    continue: '▶ Continua a guardare',
    trending: '🔥 Trending',
    popular_movies: '🎬 Film più popolari',
    popular_tv: '📺 Serie TV più popolari',
    top_movies: '⭐ Film più votati',
    top_tv: '⭐ Serie TV più votate',
    now_playing: '🎥 Al cinema ora',
    upcoming: '🗓️ Prossimamente',
    airing_today: '📡 In onda oggi',
    on_air: '📺 In corso',
    popular: 'popolari',
    top: 'più votati',
    recent: 'recenti',
    featured_movie: "Film in evidenza",
    featured_tv: "Serie TV in evidenza",
    watch_now: 'Guarda ora', 
    more_info: 'Più info', 
    watch_movie: 'Guarda il film',
  },
  'en-US': {
    search_placeholder: 'Search movies and TV shows...',
    search_results: '🔍 Search Results',
    search_close: '✕ Close',
    no_results: 'No results found.',
    continue: '▶ Continue Watching',
    trending: '🔥 Trending',
    popular_movies: '🎬 Popular Movies',
    popular_tv: '📺 Popular TV Shows',
    top_movies: '⭐ Top Rated Movies',
    top_tv: '⭐ Top Rated TV Shows',
    now_playing: '🎥 Now Playing',
    upcoming: '🗓️ Upcoming',
    airing_today: '📡 Airing Today',
    on_air: '📺 On Air',
    popular: 'popular',
    top: 'top rated',
    recent: 'recent',
    featured_movie: "Featured Movie",
    featured_tv: "Featured TV Show",
    watch_now: 'Watch now', 
    more_info: 'More info', 
    watch_movie: 'Watch movie',
  },
  'fr-FR': {
    search_placeholder: 'Rechercher films et séries...',
    search_results: '🔍 Résultats',
    search_close: '✕ Fermer',
    no_results: 'Aucun résultat trouvé.',
    continue: '▶ Continuer à regarder',
    trending: '🔥 Tendances',
    popular_movies: '🎬 Films populaires',
    popular_tv: '📺 Séries populaires',
    top_movies: '⭐ Films les mieux notés',
    top_tv: '⭐ Séries les mieux notées',
    now_playing: '🎥 En salle',
    upcoming: '🗓️ À venir',
    airing_today: '📡 Diffusé aujourd’hui',
    on_air: '📺 En cours',
    popular: 'populaires',
    top: 'mieux notés',
    recent: 'récents',
    featured_movie: "Film en vedette",
    featured_tv: "Série en vedette",
    watch_now: 'Regarder', 
    more_info: 'Plus d\'infos', 
    watch_movie: 'Voir le film',
  },
  'es-ES': {
    search_placeholder: 'Buscar películas y series...',
    search_results: '🔍 Resultados',
    search_close: '✕ Cerrar',
    no_results: 'Sin resultados.',
    continue: '▶ Seguir viendo',
    trending: '🔥 Tendencias',
    popular_movies: '🎬 Películas populares',
    popular_tv: '📺 Series populares',
    top_movies: '⭐ Películas mejor valoradas',
    top_tv: '⭐ Series mejor valoradas',
    now_playing: '🎥 En cines',
    upcoming: '🗓️ Próximamente',
    airing_today: '📡 En emisión hoy',
    on_air: '📺 En emisión',
    popular: 'populares',
    top: 'mejor valoradas',
    recent: 'recientes',
    featured_movie: "Película destacada",
    featured_tv: "Serie destacada",
    watch_now: 'Ver ahora', 
    more_info: 'Más info', 
    watch_movie: 'Ver la película',
  },
  'de-DE': {
    search_placeholder: 'Filme und Serien suchen...',
    search_results: '🔍 Suchergebnisse',
    search_close: '✕ Schließen',
    no_results: 'Keine Ergebnisse gefunden.',
    continue: '▶ Weiter ansehen',
    trending: '🔥 Trends',
    popular_movies: '🎬 Beliebte Filme',
    popular_tv: '📺 Beliebte Serien',
    top_movies: '⭐ Bestbewertete Filme',
    top_tv: '⭐ Bestbewertete Serien',
    now_playing: '🎥 Jetzt im Kino',
    upcoming: '🗓️ Demnächst',
    airing_today: '📡 Heute im TV',
    on_air: '📺 Laufend',
    popular: 'beliebt',
    top: 'bestbewertet',
    recent: 'neu',
    featured_movie: "Empfohlener Film",
    featured_tv: "Empfohlene Serie",
    watch_now: 'Jetzt ansehen', 
    more_info: 'Mehr Info', 
    watch_movie: 'Film ansehen',
  }
};

function updateNavbarLabels() {
  const labels = SECTION_LABELS[currentLang] || SECTION_LABELS['en-US'];
  const ui = UI_LABELS[currentLang] || UI_LABELS['en-US'];
  // Aggiorna bottoni desktop
  document.querySelectorAll('.navbar .nav-btn').forEach(btn => {
    const onclickAttr = btn.getAttribute('onclick');
    if (onclickAttr) {
      const match = onclickAttr.match(/setSection\('(\w+)'/);
      if (match && labels[match[1]]) btn.textContent = labels[match[1]];
    }
  });
  // Aggiorna bottoni mobile
  document.querySelectorAll('.navbar-mobile .nav-btn').forEach(btn => {
    const sec = btn.getAttribute('data-section');
    if (sec && labels[sec]) btn.textContent = labels[sec];
  });
  // Aggiorna placeholder ricerca
  document.querySelectorAll('#searchInput').forEach(el => {
    el.placeholder = ui.search_placeholder || 'Search movies and TV shows...';
  });
  // Aggiorna titolo continua a guardare
  const cwTitle = document.querySelector('#cw-section .section-title');
  if (cwTitle) cwTitle.textContent = ui.continue || '▶ Continue Watching';
  // Aggiorna titolo e bottone ricerca
  const searchTitle = document.getElementById('search-results-title');
  if (searchTitle) searchTitle.textContent = ui.search_results || '🔍 Search Results';
  const searchClose = document.getElementById('search-close-btn');
  if (searchClose) searchClose.textContent = ui.search_close || '✕ Close';
}
function updateStaticTexts() {
  const ui = UI_LABELS[currentLang] || UI_LABELS['it-IT'];
  const cw = document.getElementById('cw-title');
  if (cw) cw.textContent = ui.continue;
}
let currentSection = 'home';
let currentSearchQuery = '';

async function setSection(section, btn) {
  if (currentSection === section) return;
  currentSection = section;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('sliders-container').innerHTML = '';
  document.getElementById('cw-section').style.display = 'none';
  document.getElementById('hero').style.display = section === 'home' ? 'block' : 'none';
  await loadSection(section);
  if (section === 'home') renderContinueWatching();
  
  // Chiudi menu mobile se aperto
  closeMobileMenu();
}

async function loadSection(section) {
  const c = document.getElementById('sliders-container');
  const labels = SECTION_LABELS[currentLang] || SECTION_LABELS['it-IT'];
  const ui = UI_LABELS[currentLang] || UI_LABELS['it-IT'];

  if (section === 'home') {
    try{
      const m = await tmdb('/movie/popular');
      if(m.results?.[0]) setHero(m.results[0],'movie');
      if(m.results?.length) buildSection(ui.popular_movies, m.results.slice(0,20),'movie');
    }catch(e){}
    // Top 10 trending
    try{
      const tr10 = await tmdb('/trending/all/day');
      const tr10items = (tr10.results||[]).filter(i=>i.media_type!=='person');
      if(tr10items.length) buildTop10Section('🏆 Top 10 Today', tr10items, null);
    }catch(e){}
    try{
      const tv = await tmdb('/tv/popular');
      if(tv.results?.length) buildSection(ui.popular_tv, tv.results.slice(0,20),'tv');
    }catch(e){}
    try{
      const tr = await tmdb('/trending/all/week');
      const it = (tr.results||[]).filter(i=>i.media_type!=='person');
      if(it.length) buildSection(ui.trending, it.slice(0,20), null);
    }catch(e){}
    try{
      const tm = await tmdb('/movie/top_rated');
      if(tm.results?.length) buildSection(ui.top_movies, tm.results.slice(0,20),'movie');
    }catch(e){}
    try{
      const tt = await tmdb('/tv/top_rated');
      if(tt.results?.length) buildSection(ui.top_tv, tt.results.slice(0,20),'tv');
    }catch(e){}
    try{
      const n = await tmdb('/movie/now_playing');
      if(n.results?.length) buildSection(ui.now_playing, n.results.slice(0,20),'movie');
    }catch(e){}
    try{
      const u = await tmdb('/movie/upcoming');
      if(u.results?.length) buildSection(ui.upcoming, u.results.slice(0,20),'movie');
    }catch(e){}
    try{
      const a = await tmdb('/tv/airing_today');
      if(a.results?.length) buildSection(ui.airing_today, a.results.slice(0,20),'tv');
    }catch(e){}
    const genreList = [
      {id:28,label:'💥 '+labels.action},{id:35,label:'😂 '+labels.comedy},
      {id:16,label:'🎨 '+labels.animation},{id:27,label:'👻 '+labels.horror},
      {id:878,label:'🚀 '+labels.scifi},{id:53,label:'🔪 '+labels.thriller},
      {id:10749,label:'❤️ '+labels.romance},{id:99,label:'🎬 '+labels.documentary},
      {id:10751,label:'👨‍👩‍👧 '+labels.family},{id:80,label:'🔫 '+labels.crime}
    ];
    for(const g of genreList){try{const r=await tmdb('/discover/movie',{with_genres:g.id,sort_by:'popularity.desc'});if(r.results?.length)buildSection(g.label,r.results.slice(0,20),'movie');}catch(e){}}
    return;
  }

  if (section === 'movies') {
    try{ const m = await tmdb('/movie/popular'); if(m.results?.length) buildSection(ui.popular_movies, m.results.slice(0,20),'movie'); }catch(e){}
    try{ const m = await tmdb('/movie/top_rated'); if(m.results?.length) buildSection(ui.top_movies, m.results.slice(0,20),'movie'); }catch(e){}
    try{ const m = await tmdb('/movie/now_playing'); if(m.results?.length) buildSection(ui.now_playing, m.results.slice(0,20),'movie'); }catch(e){}
    try{ const m = await tmdb('/movie/upcoming'); if(m.results?.length) buildSection(ui.upcoming, m.results.slice(0,20),'movie'); }catch(e){}
    return;
  }

  if (section === 'tv') {
    try{ const t = await tmdb('/tv/popular'); if(t.results?.length) buildSection(ui.popular_tv, t.results.slice(0,20),'tv'); }catch(e){}
    try{ const t = await tmdb('/tv/top_rated'); if(t.results?.length) buildSection(ui.top_tv, t.results.slice(0,20),'tv'); }catch(e){}
    try{ const t = await tmdb('/tv/airing_today'); if(t.results?.length) buildSection(ui.airing_today, t.results.slice(0,20),'tv'); }catch(e){}
    try{ const t = await tmdb('/tv/on_the_air'); if(t.results?.length) buildSection(ui.on_air, t.results.slice(0,20),'tv'); }catch(e){}
    return;
  }

  const sectionConfig = {
    action:      [{type:'movie',id:28},{type:'tv',id:10759}],
    adventure:   [{type:'movie',id:12}],
    animation:   [{type:'movie',id:16},{type:'tv',id:16}],
    comedy:      [{type:'movie',id:35},{type:'tv',id:35}],
    crime:       [{type:'movie',id:80},{type:'tv',id:80}],
    documentary: [{type:'movie',id:99},{type:'tv',id:99}],
    drama:       [{type:'movie',id:18},{type:'tv',id:18}],
    family:      [{type:'movie',id:10751},{type:'tv',id:10762}],
    fantasy:     [{type:'movie',id:14}],
    history:     [{type:'movie',id:36}],
    horror:      [{type:'movie',id:27}],
    kids:        [{type:'tv',id:10762}],
    music:       [{type:'movie',id:10402}],
    mystery:     [{type:'movie',id:9648},{type:'tv',id:9648}],
    news:        [{type:'tv',id:10763}],
    reality:     [{type:'tv',id:10764}],
    romance:     [{type:'movie',id:10749}],
    scifi:       [{type:'tv',id:10765}],
    scifi_movie: [{type:'movie',id:878}],
    soap:        [{type:'tv',id:10766}],
    thriller:    [{type:'movie',id:53}],
    tvmovie:     [{type:'movie',id:10770}],
    war:         [{type:'movie',id:10752},{type:'tv',id:10768}],
    western:     [{type:'movie',id:37}],
  };

  const secLabel = labels[section] || section;
  const configs = sectionConfig[section] || [];

  for (const cfg of configs) {
    const mediaLabel = cfg.type === 'movie' ? (labels.movies||'Film') : (labels.tv||'Serie TV');
    try {
      const pop = await tmdb(`/discover/${cfg.type}`, {with_genres:cfg.id, sort_by:'popularity.desc'});
      if(pop.results?.length) buildSection(`🔥 ${secLabel} - ${mediaLabel} ${ui.popular}`, pop.results.slice(0,20), cfg.type);
    } catch(e){}
    try {
      const top = await tmdb(`/discover/${cfg.type}`, {with_genres:cfg.id, sort_by:'vote_average.desc', 'vote_count.gte':500});
      if(top.results?.length) buildSection(`⭐ ${secLabel} - ${mediaLabel} ${ui.top}`, top.results.slice(0,20), cfg.type);
    } catch(e){}
    try {
      const rec = await tmdb(`/discover/${cfg.type}`, {with_genres:cfg.id, sort_by:'release_date.desc', 'vote_count.gte':50});
      if(rec.results?.length) buildSection(`🆕 ${secLabel} - ${mediaLabel} ${ui.recent}`, rec.results.slice(0,20), cfg.type);
    } catch(e){}
  }
}

// MOBILE MENU HANDLERS
function openMobileMenu() {
  document.getElementById('navbarMobile').classList.add('open');
  document.getElementById('menuOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  document.getElementById('navbarMobile').classList.remove('open');
  document.getElementById('menuOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// INIT
async function init() {
  currentSection = 'home';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const firstBtn = document.querySelector('.nav-btn');
  if (firstBtn) firstBtn.classList.add('active');
  
  updateNavbarLabels();
  updateStaticTexts();
  renderContinueWatching();
  fbLoadHistory();
  await loadSection('home');
  
  // Setup event listeners for mobile menu
  document.getElementById('hamburgerBtn').addEventListener('click', openMobileMenu);
  document.getElementById('menuOverlay').addEventListener('click', closeMobileMenu);

  updateMobileUsername();
  
  // Sync mobile nav buttons with desktop ones
  document.querySelectorAll('.navbar-mobile .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.getAttribute('data-section');
      if (section) {
        setSection(section, btn);
        // Also update desktop active state
        document.querySelectorAll('.navbar .nav-btn').forEach(db => {
          if (db.getAttribute('data-section') === section) {
            db.classList.add('active');
          } else {
            db.classList.remove('active');
          }
        });
      }
    });
  });
  
  const originalSetSection = window.setSection;
  window.setSection = function(section, btn) {
    originalSetSection(section, btn);
    // Sincronizza i bottoni mobile
    document.querySelectorAll('.navbar-mobile .nav-btn').forEach(mb => {
      if (mb.getAttribute('data-section') === section) {
        mb.classList.add('active');
      } else {
        mb.classList.remove('active');
      }
    });
  };
}

window.toggleGenresMenu = function() {
  const btn = document.getElementById('genres-btn');
  const dd = document.getElementById('genres-dropdown');
  btn.classList.toggle('open');
  dd.classList.toggle('open');
};
window.closeGenresMenu = function() {
  document.getElementById('genres-btn')?.classList.remove('open');
  document.getElementById('genres-dropdown')?.classList.remove('open');
};
// Close genres dropdown when clicking outside
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('genres-wrap');
  if (wrap && !wrap.contains(e.target)) {
    window.closeGenresMenu();
  }
});

// Esposizione funzioni per l'HTML
window.scrollSlider=scrollSlider;window.openModal=openModal;window.closeModal=closeModal;
window.closeModalBtn=closeModalBtn;window.loadEpisodes=loadEpisodes;window.toggleMenu=toggleMenu;
window.removeContinue=removeContinue;window.clearSearch=clearSearch;window.logout=logout;
window.setSection=setSection;

buildLangSelector();
init();

// ══════════════════════════════════════════════════
//  PLAYLISTS
// ══════════════════════════════════════════════════
function getPlaylists() {
  return JSON.parse(localStorage.getItem(storageKey('playlists')) || '[]');
}
function savePlaylists(pl) {
  localStorage.setItem(storageKey('playlists'), JSON.stringify(pl));
  fbSavePlaylists(pl);
}
async function fbSavePlaylists(pl) {
  try { await setDoc(doc(db, 'playlists', currentUser), { items: JSON.stringify(pl) }); }
  catch(e) { console.warn('Playlist save error:', e); }
}
async function fbLoadPlaylists() {
  try {
    const snap = await getDoc(doc(db, 'playlists', currentUser));
    if (snap.exists()) {
      const remote = JSON.parse(snap.data().items || '[]');
      localStorage.setItem(storageKey('playlists'), JSON.stringify(remote));
    }
  } catch(e) { console.warn('Playlist load error:', e); }
}

function createPlaylist(name) {
  name = (name || '').trim();
  if (!name) return null;
  const pl = getPlaylists();
  const newList = { id: 'pl_' + Date.now(), name, items: [], createdAt: Date.now() };
  pl.unshift(newList);
  savePlaylists(pl);
  return newList;
}

function deletePlaylist(id) {
  if (!confirm('Eliminare questa lista?')) return;
  let pl = getPlaylists();
  pl = pl.filter(p => p.id !== id);
  savePlaylists(pl);
  renderPlaylistsList();
}

function addToPlaylist(playlistId, item) {
  // item = { id, type, title, poster, year }
  const pl = getPlaylists();
  const list = pl.find(p => p.id === playlistId);
  if (!list) return;
  const exists = list.items.some(i => i.id === item.id && i.type === item.type);
  if (exists) {
    list.items = list.items.filter(i => !(i.id === item.id && i.type === item.type));
  } else {
    list.items.unshift({ ...item, addedAt: Date.now() });
  }
  savePlaylists(pl);
}

function isInAnyPlaylist(id, type) {
  return getPlaylists().some(p => p.items.some(i => i.id === id && i.type === type));
}

// ── UI: modale principale ──
let plCurrentView = 'list'; // 'list' | 'detail'
let plCurrentDetailId = null;

function openPlaylists() {
  plCurrentView = 'list';
  document.getElementById('playlists-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderPlaylistsList();
}
function closePlaylists() {
  document.getElementById('playlists-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
function closePlaylistsOnBg(e) {
  if (e.target.id === 'playlists-overlay') closePlaylists();
}

function renderPlaylistsList() {
  document.getElementById('pl-modal-title').textContent = 'Le mie liste';
  const body = document.getElementById('pl-body');
  const pl = getPlaylists();

  let html = `
    <div class="pl-create-row">
      <input type="text" id="pl-new-name" placeholder="Nome nuova lista (es. Da vedere weekend)" maxlength="40">
      <button class="pl-create-btn" onclick="handleCreatePlaylist()">+ Crea</button>
    </div>`;

  if (!pl.length) {
    html += `<div class="pl-empty">Non hai ancora nessuna lista. Creane una sopra!</div>`;
  } else {
    html += `<div class="pl-list">`;
    pl.forEach(p => {
      html += `
        <div class="pl-item" onclick="openPlaylistDetail('${p.id}')">
          <div class="pl-icon">🎬</div>
          <div class="pl-info">
            <div class="pl-name">${p.name}</div>
            <div class="pl-count">${p.items.length} titol${p.items.length===1?'o':'i'}</div>
          </div>
          <button class="pl-del-btn" onclick="event.stopPropagation();deletePlaylist('${p.id}')">🗑</button>
        </div>`;
    });
    html += `</div>`;
  }
  body.innerHTML = html;

  document.getElementById('pl-new-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleCreatePlaylist();
  });
}

function handleCreatePlaylist() {
  const input = document.getElementById('pl-new-name');
  const newList = createPlaylist(input.value);
  if (newList) renderPlaylistsList();
}

function openPlaylistDetail(id) {
  plCurrentView = 'detail';
  plCurrentDetailId = id;
  renderPlaylistDetail();
}

function renderPlaylistDetail() {
  const pl = getPlaylists();
  const list = pl.find(p => p.id === plCurrentDetailId);
  if (!list) { renderPlaylistsList(); return; }

  document.getElementById('pl-modal-title').textContent = list.name;
  const body = document.getElementById('pl-body');

  let html = `
    <div class="pl-detail-header">
      <button class="pl-back-btn" onclick="renderPlaylistsList()">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span class="pl-detail-title">${list.name}</span>
    </div>`;

  if (!list.items.length) {
    html += `<div class="pl-empty">Lista vuota. Aggiungi titoli dal pulsante "＋" sulle card!</div>`;
  } else {
    html += `<div class="pl-items-grid">`;
    list.items.forEach(item => {
      html += `
        <div class="pl-item-card" onclick="openModal(${item.id},'${item.type}')">
          ${item.poster
            ? `<img src="${item.poster}" alt="${item.title}" loading="lazy">`
            : `<div style="width:100%;height:100%;background:#1e1e1e;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#555;padding:8px;text-align:center">${item.title}</div>`}
          <button class="pl-item-remove" onclick="event.stopPropagation();removeFromPlaylistDetail('${item.id}','${item.type}')">✕</button>
          <div class="pl-item-label">${item.title}</div>
        </div>`;
    });
    html += `</div>`;
  }
  body.innerHTML = html;
}

function removeFromPlaylistDetail(id, type) {
  const pl = getPlaylists();
  const list = pl.find(p => p.id === plCurrentDetailId);
  if (!list) return;
  list.items = list.items.filter(i => !(i.id == id && i.type === type));
  savePlaylists(pl);
  renderPlaylistDetail();
}

// ── Picker: bottone "＋" su card/popup/modal ──
function openPlaylistPickerFromBtn(btn) {
  const item = {
    id:     parseInt(btn.dataset.pid),
    type:   btn.dataset.ptype,
    title:  btn.dataset.ptitle,
    poster: btn.dataset.pposter,
    year:   btn.dataset.pyear
  };
  openPlaylistPicker(btn, item);
}

window.openPlaylistPickerFromBtn = openPlaylistPickerFromBtn;
function openPlaylistPicker(btn, item) {
  // item = { id, type, title, poster, year }
  const picker = document.getElementById('pl-picker');
  const pl = getPlaylists();

  let html = '';
  if (!pl.length) {
    html += `<div style="font-size:0.78rem;color:var(--muted);padding:8px 10px;">Nessuna lista. Creane una:</div>`;
  } else {
    pl.forEach(p => {
      const added = p.items.some(i => i.id === item.id && i.type === item.type);
      html += `
        <div class="pl-picker-item ${added?'added':''}" onclick="pickerAddToList('${p.id}', ${JSON.stringify(item).replace(/"/g,'&quot;')})">
          <span>${p.name}</span>
          <span>${added ? '✓' : '+'}</span>
        </div>`;
    });
  }
  html += `
    <div class="pl-picker-new">
      <input type="text" id="pl-picker-new-name" placeholder="Nuova lista..." maxlength="40">
      <button onclick="pickerCreateAndAdd(${JSON.stringify(item).replace(/"/g,'&quot;')})">+</button>
    </div>`;

  picker.innerHTML = html;

  const rect = btn.getBoundingClientRect();
  const top = rect.bottom + 6;
  const left = Math.min(rect.left, window.innerWidth - 220);
  picker.style.position = 'fixed';
  picker.style.top  = top + 'px';
  picker.style.left = left + 'px';
  picker.style.zIndex = '9999';
  picker.classList.add('open');

  // chiudi cliccando fuori
  setTimeout(() => {
    document.addEventListener('click', closePickerOnOutside);
  }, 0);
}

function closePickerOnOutside(e) {
  const picker = document.getElementById('pl-picker');
  if (!picker.contains(e.target)) {
    picker.classList.remove('open');
    document.removeEventListener('click', closePickerOnOutside);
  }
}

function pickerAddToList(playlistId, item) {
  addToPlaylist(playlistId, item);
  document.getElementById('pl-picker').classList.remove('open');
  showToast('Aggiornato!');
}

function pickerCreateAndAdd(item) {
  const input = document.getElementById('pl-picker-new-name');
  const newList = createPlaylist(input.value);
  if (newList) {
    addToPlaylist(newList.id, item);
    document.getElementById('pl-picker').classList.remove('open');
    showToast(`Aggiunto a "${newList.name}"`);
  }
}

// Esponi su window
window.openPlaylists = openPlaylists;
window.closePlaylists = closePlaylists;
window.closePlaylistsOnBg = closePlaylistsOnBg;
window.handleCreatePlaylist = handleCreatePlaylist;
window.openPlaylistDetail = openPlaylistDetail;
window.deletePlaylist = deletePlaylist;
window.removeFromPlaylistDetail = removeFromPlaylistDetail;
window.openPlaylistPicker = openPlaylistPicker;
window.pickerAddToList = pickerAddToList;
window.pickerCreateAndAdd = pickerCreateAndAdd;

// Carica playlist da Firebase all'avvio
fbLoadPlaylists();