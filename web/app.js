import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
  getBytes,
  getStorage,
  ref
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const ADMIN_UID = "0n3g5r70aOYAMBwfza4f0uwcrQr2";
const WHATSAPP_NUMBER = "527711221282";
const WHATSAPP_MESSAGE = "Hola, quiero solicitar los datos de pago para acceder a Aula Bonita NEM.";

const phaseColors = {
  "3": { color: "#ff766d", soft: "#fff0ee", label: "Fase 3 · 1.º y 2.º" },
  "4": { color: "#35bfc4", soft: "#e9f8f8", label: "Fase 4 · 3.º y 4.º" },
  "5": { color: "#7760c1", soft: "#f1edfb", label: "Fase 5 · 5.º y 6.º" },
  universal: { color: "#e7a51e", soft: "#fff7df", label: "Universal" }
};

const materialNames = [
  ["planeacion", "Planeación de proyecto", "Integra realidad, propósito, campos formativos, PDA y evaluación.", "PR"],
  ["pda", "Seguimiento de contenidos y PDA", "Registra evidencias, avances y siguientes acciones pedagógicas.", "PD"],
  ["rubrica", "Rúbrica formativa", "Criterios editables, evidencias y retroalimentación útil.", "RU"],
  ["portafolio", "Portafolio de evidencias", "Organiza producciones, reflexiones y avances del periodo.", "PO"],
  ["investigacion", "Investigación y descubrimiento", "Preguntas, recursos, hallazgos y comunicación responsable.", "IN"],
  ["ideas", "Expresión, diálogo y argumentación", "Organiza ideas, ejemplos, preguntas y respuestas respetuosas.", "ID"],
  ["problemas", "Resolución de problemas", "Comprender, representar, resolver, comprobar y explicar.", "RP"],
  ["autoevaluacion", "Autoevaluación y plan de mejora", "Reconoce logros, dificultades y una siguiente meta.", "AM"],
  ["informe", "Informe descriptivo individual", "Fortalezas, evidencias, apoyos y recomendaciones.", "IF"],
  ["tareas", "Registro mensual de tareas", "Control editable de entregas para todo el grupo.", "TA"],
  ["materiales", "Lista de cotejo de materiales", "Control por proyecto, actividad o periodo.", "MA"],
  ["asistencia", "Registro mensual de asistencia", "Asistencias, justificadas, faltas y concentrado mensual.", "AS"],
  ["lectura", "Registro de lectura", "Seguimiento individual y grupal del proceso lector.", "LE"]
];

const catalogs = ["3", "4", "5"].flatMap((phase) => materialNames.map((item, index) => ({
  id: `fase-${phase}-${item[0]}`,
  phase,
  title: item[1],
  description: item[2],
  icon: item[3],
  type: "Word",
  storagePath: `materiales/fase-${phase}/${String(index + 1).padStart(2, "0")}-${item[0]}.docx`
})));

catalogs.unshift(
  {
    id: "pack-fase-3", phase: "3", title: "Paquete completo Fase 3",
    description: "Colección completa para 1.º y 2.º de primaria.", icon: "P3", type: "ZIP",
    storagePath: "paquetes/Paquete_Fase_3_NEM_Editable.zip"
  },
  {
    id: "pack-fase-4", phase: "4", title: "Paquete completo Fase 4",
    description: "Colección completa para 3.º y 4.º de primaria.", icon: "P4", type: "ZIP",
    storagePath: "paquetes/Paquete_Fase_4_NEM_Editable.zip"
  },
  {
    id: "pack-fase-5", phase: "5", title: "Paquete completo Fase 5",
    description: "Colección completa para 5.º y 6.º de primaria.", icon: "P5", type: "ZIP",
    storagePath: "paquetes/Paquete_Fase_5_NEM_Editable.zip"
  },
  {
    id: "bitacora", phase: "universal", title: "Bitácora de incidencias",
    description: "Registro, atención, seguimiento y cierre con enfoque de derechos.", icon: "BI", type: "Word",
    storagePath: "materiales/universales/bitacora-incidencias.docx"
  }
);

const configured = firebaseConfig.apiKey !== "REEMPLAZAR";
const firebaseApp = configured ? initializeApp(firebaseConfig) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;
const storage = firebaseApp ? getStorage(firebaseApp) : null;

let currentUser = null;
let hasAccess = false;
let activePhase = "all";
let searchTerm = "";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const authDialog = $("#auth-dialog");
const toast = $("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3100);
}

function openAuth(mode = "login") {
  $("#auth-message").textContent = configured ? "" : "Primero agrega la configuración de Firebase.";
  setAuthView(mode);
  authDialog.showModal();
}

function setAuthView(mode) {
  $("#login-view").classList.toggle("hidden", mode !== "login");
  $("#register-view").classList.toggle("hidden", mode !== "register");
}

function normalized(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function filteredCatalog() {
  const needle = normalized(searchTerm);
  return catalogs.filter((item) => {
    const phaseMatch = activePhase === "all" || item.phase === activePhase;
    const textMatch = !needle || normalized(`${item.title} ${item.description} ${phaseColors[item.phase].label}`).includes(needle);
    return phaseMatch && textMatch;
  });
}

function renderCatalog() {
  const items = filteredCatalog();
  $("#catalog-count").textContent = `${items.length} material${items.length === 1 ? "" : "es"}`;
  $("#empty-state").classList.toggle("hidden", items.length > 0);
  $("#catalog-grid").innerHTML = items.map((item) => {
    const theme = phaseColors[item.phase];
    return `
      <article class="material-card" style="--card-color:${theme.color};--card-soft:${theme.soft}">
        <div class="card-top">
          <span class="phase-badge">${theme.label}</span>
          <span class="file-badge">${item.type}</span>
        </div>
        <div class="material-icon">${item.icon}</div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <div class="card-footer">
          <small>Editable</small>
          <button class="download-button ${hasAccess ? "" : "locked"}" data-download="${item.id}">
            ${hasAccess ? "Descargar" : "🔒 Acceso"}
          </button>
        </div>
      </article>`;
  }).join("");
}

function renderSession() {
  $("#open-login").classList.toggle("hidden", Boolean(currentUser));
  $("#logout-button").classList.toggle("hidden", !currentUser);
  $("#user-chip").classList.toggle("hidden", !currentUser);
  $("#user-chip").textContent = currentUser?.displayName || currentUser?.email || "";
  $("#admin-link")?.classList.toggle("hidden", currentUser?.uid !== ADMIN_UID);

  const banner = $("#access-banner");
  banner.classList.toggle("active", hasAccess);
  if (hasAccess) {
    $("#access-title").textContent = "Tu biblioteca está activa";
    $("#access-message").textContent = "Puedes descargar todos los materiales disponibles.";
    $("#banner-action").textContent = "Ver catálogo";
  } else if (currentUser) {
    $("#access-title").textContent = "Tu acceso está pendiente";
    $("#access-message").textContent = "Cuando confirmemos tu pago, las descargas se habilitarán automáticamente.";
    $("#banner-action").textContent = "Ver instrucciones";
  } else {
    $("#access-title").textContent = "Inicia sesión para descargar";
    $("#access-message").textContent = "Puedes explorar todo el catálogo. Las descargas se activan al confirmar tu acceso.";
    $("#banner-action").textContent = "Ingresar";
  }
  renderCatalog();
}

document.querySelectorAll(".whatsapp-link").forEach((link) => {
  const destination = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`
    : `https://wa.me/?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  link.href = destination;
});

async function getUserAccess(user) {
  if (!db || !user) return false;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return false;
  const data = snap.data();
  return data.active === true && (!data.expiresAt || data.expiresAt.toDate() > new Date());
}

async function downloadMaterial(item) {
  if (!currentUser) return openAuth("login");
  if (!hasAccess) return showToast("Tu cuenta todavía no tiene acceso a descargas.");
  try {
    const button = document.querySelector(`[data-download="${item.id}"]`);
    if (button) { button.disabled = true; button.textContent = "Preparando…"; }
    const bytes = await getBytes(ref(storage, item.storagePath));
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = item.storagePath.split("/").pop();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Descarga iniciada.");
  } catch (error) {
    console.error(error);
    showToast("No pudimos descargar el archivo. Revisa que esté cargado en Firebase.");
  } finally {
    renderCatalog();
  }
}

$("#search-input").addEventListener("input", (event) => {
  searchTerm = event.target.value;
  renderCatalog();
});
$$(".filter-chip").forEach((button) => button.addEventListener("click", () => {
  $$(".filter-chip").forEach((chip) => chip.classList.remove("active"));
  button.classList.add("active");
  activePhase = button.dataset.phase;
  renderCatalog();
}));
$("#catalog-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-download]");
  if (!button) return;
  const item = catalogs.find((entry) => entry.id === button.dataset.download);
  if (item) downloadMaterial(item);
});

$("#open-login").addEventListener("click", () => openAuth("login"));
$("#hero-login").addEventListener("click", () => openAuth("login"));
$("#close-dialog").addEventListener("click", () => authDialog.close());
$("#show-register").addEventListener("click", () => setAuthView("register"));
$("#show-login").addEventListener("click", () => setAuthView("login"));
$("#banner-action").addEventListener("click", () => {
  if (hasAccess) location.hash = "#catalogo";
  else if (!currentUser) openAuth("login");
  else showToast("Añade aquí tus instrucciones de pago y contacto.");
});
$("#logout-button").addEventListener("click", () => signOut(auth));

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#auth-message").textContent = "";
  if (!configured) return $("#auth-message").textContent = "Configura Firebase antes de iniciar sesión.";
  try {
    await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-password").value);
    authDialog.close();
  } catch {
    $("#auth-message").textContent = "No pudimos ingresar. Revisa tu correo y contraseña.";
  }
});

$("#register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#auth-message").textContent = "";
  if (!configured) return $("#auth-message").textContent = "Configura Firebase antes de crear cuentas.";
  try {
    const credential = await createUserWithEmailAndPassword(auth, $("#register-email").value.trim(), $("#register-password").value);
    await updateProfile(credential.user, { displayName: $("#register-name").value.trim() });
    await setDoc(doc(db, "users", credential.user.uid), {
      name: $("#register-name").value.trim(),
      email: credential.user.email,
      active: false,
      createdAt: serverTimestamp()
    });
    authDialog.close();
    showToast("Cuenta creada. Tu acceso está pendiente de activación.");
  } catch (error) {
    $("#auth-message").textContent = error.code === "auth/email-already-in-use"
      ? "Ese correo ya tiene una cuenta."
      : "No pudimos crear la cuenta. Revisa los datos.";
  }
});

$("#forgot-password").addEventListener("click", async () => {
  const email = $("#login-email").value.trim();
  if (!email) return $("#auth-message").textContent = "Escribe primero tu correo.";
  try {
    await sendPasswordResetEmail(auth, email);
    $("#auth-message").textContent = "Te enviamos un correo para restablecer tu contraseña.";
  } catch {
    $("#auth-message").textContent = "No pudimos enviar el correo de recuperación.";
  }
});

if (auth) {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    hasAccess = await getUserAccess(user);
    renderSession();
  });
} else {
  renderSession();
}

$("#current-year").textContent = new Date().getFullYear();
