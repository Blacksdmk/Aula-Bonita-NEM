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
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "drive.google.com";
  } catch {
    return false;
  }
}

function renderUsers() {
  const needle = $("#user-search").value.trim().toLowerCase();
  const visible = users.filter((user) =>
    `${user.name || ""} ${user.email || ""}`.toLowerCase().includes(needle)
  );

  $("#users-list").innerHTML = visible.length ? visible.map((user) => `
    <article class="user-row">
      <div class="user-identity">
        <strong>${escapeHtml(user.name || "Sin nombre")}</strong>
        <small>${escapeHtml(user.email || "Sin correo")}</small>
      </div>
      <label class="drive-field">
        <span>Carpeta privada de Google Drive</span>
        <input type="url" value="${escapeHtml(user.libraryUrl || "")}" placeholder="https://drive.google.com/..." data-drive-input="${user.id}">
      </label>
      <div class="user-status">
        <span class="status-pill ${user.active ? "active" : ""}">${user.active ? "Activo" : "Pendiente"}</span>
        <button class="access-toggle save-link" data-save-link="${user.id}">Guardar enlace</button>
        <button class="access-toggle ${user.active ? "revoke" : ""}" data-user="${user.id}" data-active="${user.active}">
          ${user.active ? "Suspender" : "Activar"}
        </button>
      </div>
    </article>`).join("") : '<div class="admin-empty">No encontramos cuentas con esos datos.</div>';

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
  const saveButton = event.target.closest("[data-save-link]");
  if (saveButton) {
    const userId = saveButton.dataset.saveLink;
    const input = document.querySelector(`[data-drive-input="${userId}"]`);
    const libraryUrl = input.value.trim();
    if (!validDriveUrl(libraryUrl)) {
      showToast("Usa un enlace válido de Google Drive.");
      return;
    }
    saveButton.disabled = true;
    try {
      await update(ref(db, `users/${userId}`), { libraryUrl });
      const user = users.find((entry) => entry.id === userId);
      if (user) user.libraryUrl = libraryUrl;
      showToast("Enlace privado guardado.");
    } catch (error) {
      console.error(error);
      showToast("No fue posible guardar el enlace. Revisa las reglas.");
    } finally {
      saveButton.disabled = false;
    }
    return;
  }

  const button = event.target.closest("[data-user]");
  if (!button) return;
  const newState = button.dataset.active !== "true";
  const user = users.find((entry) => entry.id === button.dataset.user);
  if (newState && !user?.libraryUrl) {
    showToast("Guarda primero la carpeta privada de Google Drive.");
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
