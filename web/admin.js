import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  get,
  getDatabase,
  ref,
  update
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const ADMIN_UID = "0n3g5r70aOYAMBwfza4f0uwcrQr2";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = (selector) => document.querySelector(selector);

const MATERIALS = [
  ["planeacion", "Planeación de proyecto"],
  ["pda", "Seguimiento de contenidos y PDA"],
  ["rubrica", "Rúbrica formativa"],
  ["portafolio", "Portafolio de evidencias"],
  ["investigacion", "Investigación y descubrimiento"],
  ["ideas", "Expresión, diálogo y argumentación"],
  ["problemas", "Resolución de problemas"],
  ["autoevaluacion", "Autoevaluación y plan de mejora"],
  ["informe", "Informe descriptivo individual"],
  ["tareas", "Registro mensual de tareas"],
  ["materiales", "Lista de cotejo de materiales"],
  ["asistencia", "Registro mensual de asistencia"],
  ["lectura", "Registro de lectura"]
];

const RESOURCE_OPTIONS = [
  ["pack-fase-3", "Paquete completo Fase 3"],
  ["pack-fase-4", "Paquete completo Fase 4"],
  ["pack-fase-5", "Paquete completo Fase 5"],
  ...["3", "4", "5"].flatMap((phase) =>
    MATERIALS.map(([key, title]) => [`fase-${phase}-${key}`, `Fase ${phase} · ${title}`])
  ),
  ["bitacora", "Bitácora de incidencias"]
];

let users = [];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function showOnly(selector) {
  ["#admin-loading", "#admin-login", "#admin-denied", "#admin-dashboard"]
    .forEach((id) => $(id).classList.toggle("hidden", id !== selector));
}

function showToast(message) {
  const toast = $("#admin-toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3000);
}

function validDriveUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["drive.google.com", "docs.google.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

function renderUsers() {
  const needle = $("#user-search").value.trim().toLowerCase();
  const visible = users.filter((user) =>
    `${user.name || ""} ${user.email || ""}`.toLowerCase().includes(needle)
  );

  $("#users-list").innerHTML = visible.length ? visible.map((user) => {
    const resources = Object.entries(user.resources || {});
    const resourceRows = resources.length
      ? resources.map(([resourceId, resource]) => `
          <div class="assigned-resource">
            <span><strong>${escapeHtml(resource.title)}</strong><small>${escapeHtml(resource.url)}</small></span>
            <button class="remove-resource" data-remove-resource="${escapeHtml(resourceId)}" data-owner="${user.id}" aria-label="Quitar acceso">×</button>
          </div>`).join("")
      : '<p class="no-resources">Todavía no tiene materiales asignados.</p>';
    const options = RESOURCE_OPTIONS.map(([id, title]) =>
      `<option value="${id}">${escapeHtml(title)}</option>`
    ).join("");

    return `
      <article class="user-row">
        <div class="user-identity">
          <strong>${escapeHtml(user.name || "Sin nombre")}</strong>
          <small>${escapeHtml(user.email || "Sin correo")}</small>
        </div>
        <div class="resource-manager">
          <label class="drive-field">
            <span>Material o paquete adquirido</span>
            <select data-resource-select="${user.id}">${options}</select>
          </label>
          <label class="drive-field">
            <span>Enlace privado del archivo o carpeta</span>
            <input type="url" placeholder="Enlace de Drive o Google Docs" data-resource-url="${user.id}">
          </label>
          <button class="access-toggle save-link add-resource" data-add-resource="${user.id}">Asignar material</button>
        </div>
        <div class="assigned-list">${resourceRows}</div>
        <div class="user-status">
          <span class="status-pill ${user.active ? "active" : ""}">${user.active ? "Activo" : "Pendiente"}</span>
          <button class="access-toggle ${user.active ? "revoke" : ""}" data-user="${user.id}" data-active="${user.active}">
            ${user.active ? "Suspender" : "Activar"}
          </button>
        </div>
      </article>`;
  }).join("") : '<div class="admin-empty">No encontramos cuentas con esos datos.</div>';

  $("#stat-total").textContent = users.length;
  $("#stat-active").textContent = users.filter((user) => user.active).length;
  $("#stat-pending").textContent = users.filter((user) => !user.active).length;
}

async function loadUsers() {
  $("#users-list").innerHTML = '<div class="admin-empty">Cargando cuentas…</div>';
  try {
    const snapshot = await get(ref(db, "users"));
    const value = snapshot.val() || {};
    users = Object.entries(value)
      .map(([id, user]) => ({ id, ...user }))
      .filter((user) => user.id !== ADMIN_UID)
      .sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""));
    renderUsers();
  } catch (error) {
    console.error(error);
    $("#users-list").innerHTML = '<div class="admin-empty">No fue posible leer las cuentas. Publica primero las reglas de Realtime Database.</div>';
  }
}

$("#admin-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#admin-login-message").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("#admin-email").value.trim(), $("#admin-password").value);
  } catch {
    $("#admin-login-message").textContent = "No pudimos ingresar. Revisa el correo y la contraseña.";
  }
});

$("#admin-logout").addEventListener("click", () => signOut(auth));
$("#admin-change-account").addEventListener("click", () => signOut(auth));
$("#refresh-users").addEventListener("click", loadUsers);
$("#user-search").addEventListener("input", renderUsers);

$("#users-list").addEventListener("click", async (event) => {
  const addButton = event.target.closest("[data-add-resource]");
  if (addButton) {
    const userId = addButton.dataset.addResource;
    const select = document.querySelector(`[data-resource-select="${userId}"]`);
    const input = document.querySelector(`[data-resource-url="${userId}"]`);
    const resourceId = select.value;
    const url = input.value.trim();
    const title = RESOURCE_OPTIONS.find(([id]) => id === resourceId)?.[1] || resourceId;
    if (!url || !validDriveUrl(url)) {
      showToast("Usa un enlace válido de Google Drive o Google Docs.");
      return;
    }
    addButton.disabled = true;
    try {
      await update(ref(db, `users/${userId}/resources/${resourceId}`), { title, url });
      const user = users.find((entry) => entry.id === userId);
      if (user) {
        user.resources ||= {};
        user.resources[resourceId] = { title, url };
      }
      renderUsers();
      showToast("Material asignado correctamente.");
    } catch (error) {
      console.error(error);
      showToast("No fue posible asignar el material. Revisa las reglas.");
      addButton.disabled = false;
    }
    return;
  }

  const removeButton = event.target.closest("[data-remove-resource]");
  if (removeButton) {
    const userId = removeButton.dataset.owner;
    const resourceId = removeButton.dataset.removeResource;
    removeButton.disabled = true;
    try {
      await update(ref(db, `users/${userId}/resources`), { [resourceId]: null });
      const user = users.find((entry) => entry.id === userId);
      if (user?.resources) delete user.resources[resourceId];
      renderUsers();
      showToast("Acceso al material retirado.");
    } catch (error) {
      console.error(error);
      showToast("No fue posible retirar el acceso.");
      removeButton.disabled = false;
    }
    return;
  }

  const button = event.target.closest("[data-user]");
  if (!button) return;
  const newState = button.dataset.active !== "true";
  const user = users.find((entry) => entry.id === button.dataset.user);
  if (newState && !Object.keys(user?.resources || {}).length && !user?.libraryUrl) {
    showToast("Asigna primero por lo menos un material o paquete.");
    return;
  }
  button.disabled = true;
  try {
    await update(ref(db, `users/${button.dataset.user}`), { active: newState });
    if (user) user.active = newState;
    renderUsers();
    showToast(newState ? "Acceso activado." : "Acceso suspendido.");
  } catch (error) {
    console.error(error);
    showToast("No fue posible cambiar el acceso. Revisa las reglas.");
    button.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showOnly("#admin-login");
    $("#admin-logout").classList.add("hidden");
    return;
  }
  $("#admin-logout").classList.remove("hidden");
  if (user.uid !== ADMIN_UID) {
    showOnly("#admin-denied");
    return;
  }
  const ownerRef = ref(db, `users/${ADMIN_UID}`);
  const ownerSnapshot = await get(ownerRef);
  if (!ownerSnapshot.exists()) {
    await update(ownerRef, {
      name: user.displayName || "Administradora",
      email: user.email || "",
      active: true,
      createdAt: Date.now(),
      libraryUrl: ""
    });
  }
  $("#admin-user-email").textContent = user.email || "Cuenta propietaria";
  showOnly("#admin-dashboard");
  await loadUsers();
});
