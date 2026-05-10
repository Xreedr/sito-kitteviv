import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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

// ── Multilang login page ──
const INDEX_LABELS = {
  en: { title:'Sign In', welcome:'Welcome back', username:'Username', password:'Password', enter:'Sign In →', remember:'Remember me on this device', error:'Incorrect username or password.', note:'Private site — members only.', tagline:'Private access · By invitation only', loading:'Signing in...' },
  it: { title:'Accedi', welcome:'Bentornato/a', username:'Username', password:'Password', enter:'Entra →', remember:'Ricordami su questo dispositivo', error:'Username o password non corretti.', note:'Sito privato — accesso riservato.', tagline:'Accesso privato · Solo su invito', loading:'Accesso in corso...' },
  fr: { title:'Connexion', welcome:'Content de vous revoir', username:'Utilisateur', password:'Mot de passe', enter:'Connexion →', remember:'Se souvenir de moi', error:'Identifiants incorrects.', note:'Site privé — accès réservé.', tagline:'Accès privé · Sur invitation', loading:'Connexion...' },
  es: { title:'Iniciar sesión', welcome:'Bienvenido/a', username:'Usuario', password:'Contraseña', enter:'Entrar →', remember:'Recordarme en este dispositivo', error:'Usuario o contraseña incorrectos.', note:'Sitio privado — acceso restringido.', tagline:'Acceso privado · Solo por invitación', loading:'Entrando...' },
  de: { title:'Anmelden', welcome:'Willkommen zurück', username:'Benutzername', password:'Passwort', enter:'Einloggen →', remember:'Auf diesem Gerät merken', error:'Falscher Benutzername oder Passwort.', note:'Private Seite — nur für Mitglieder.', tagline:'Privater Zugang · Nur auf Einladung', loading:'Anmelden...' },
};

const lang = (navigator.language || 'en').split('-')[0];
const l = INDEX_LABELS[lang] || INDEX_LABELS['en'];

function applyLoginLang() {
  document.title = 'Kitteviv — ' + l.title;
  document.querySelector('.tagline').textContent = l.tagline;
  document.querySelector('.card h2').textContent = l.welcome;
  document.querySelectorAll('.field label')[0].textContent = l.username;
  document.querySelectorAll('.field label')[1].textContent = l.password;
  document.querySelector('.btn').textContent = l.enter;
  const rl = document.getElementById('remember-label');
  if (rl) rl.textContent = l.remember;
  document.getElementById('err').textContent = l.error;
  document.querySelector('.note').textContent = l.note;
  document.querySelector('#u').placeholder = l.username.toLowerCase();
}
applyLoginLang();

async function doLogin() {
  const u = (document.getElementById('u').value || '').trim().toLowerCase();
  const p = document.getElementById('p').value;
  const err = document.getElementById('err');
  const btn = document.querySelector('.btn');
  const remember = document.getElementById('remember').checked;

  if (!u || !p) {
    err.style.display = 'block';
    err.style.animation = 'none';
    void err.offsetWidth;
    err.style.animation = 'shake 0.4s ease';
    return;
  }

  // Show loading state
  btn.textContent = l.loading || 'Loading...';
  btn.disabled = true;
  err.style.display = 'none';

  try {
    const snap = await getDoc(doc(db, 'users', u));
    if (snap.exists() && snap.data().password === p) {
      sessionStorage.setItem('ms_user', u);
      sessionStorage.setItem('ms_auth', '1');
      if (remember) {
        localStorage.setItem('ms_remember_user', u);
        localStorage.setItem('ms_remember_auth', '1');
      } else {
        localStorage.removeItem('ms_remember_user');
        localStorage.removeItem('ms_remember_auth');
      }
      window.location.href = 'home.html';
    } else {
      err.style.display = 'block';
      err.style.animation = 'none';
      void err.offsetWidth;
      err.style.animation = 'shake 0.4s ease';
      document.getElementById('p').value = '';
      document.getElementById('p').focus();
      btn.textContent = l.enter;
      btn.disabled = false;
    }
  } catch(e) {
    console.error('Login error:', e);
    err.textContent = 'Connection error. Try again.';
    err.style.display = 'block';
    btn.textContent = l.enter;
    btn.disabled = false;
  }
}

// Expose to global scope (needed for onclick in HTML)
window.doLogin = doLogin;

document.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

// Already logged in?
if (sessionStorage.getItem('ms_auth') === '1') {
  location.href = 'home.html';
} else if (localStorage.getItem('ms_remember_auth') === '1') {
  sessionStorage.setItem('ms_auth', '1');
  sessionStorage.setItem('ms_user', localStorage.getItem('ms_remember_user'));
  location.href = 'home.html';
}