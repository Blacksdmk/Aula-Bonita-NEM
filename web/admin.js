import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const ADMIN_UID = "0n3g5r70aOYAMBwfza4f0uwcrQr2";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
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

function renderUsers() {
  const needle = $("#user-search").value.trim().toLowerCase();
  const visible = users.filter((user) =>
    `${user.name || ""} ${user.email || ""}`.toLowerCase().includes(needle)
  );
  $("#users-list").innerHTML = visible.length ? visible.map((user) => `
    <article class="user-row">
      <div>
        <strong>${escapeHtml(user.name || "Sin nombre")}</strong>
        <small>${escapeHtml(user.email || "Sin correo")}</small>
      </div>
      <div class="user-status">
        <span class="status-pill ${user.active ? "active" : ""}">${user.active ? "Activo" : "Pendiente"}</span>
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
    const snapshot = await getDocs(collection(db, "users"));
    users = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""));
    renderUsers();
  } catch (error) {
    console.error(error);
    $("#users-list").innerHTML = '<div class="admin-empty">No fue posible leer las cuentas. Publica primero las reglas de Firestore.</div>';
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
  const button = event.target.closest("[data-user]");
  if (!button) return;
  const newState = button.dataset.active !== "true";
  button.disabled = true;
  try {
    await updateDoc(doc(db, "users", button.dataset.user), { active: newState });
    const user = users.find((entry) => entry.id === button.dataset.user);
    if (user) user.active = newState;
    renderUsers();
    showToast(newState ? "Acceso activado." : "Acceso suspendido.");
  } catch (error) {
    console.error(error);
    showToast("No fue posible cambiar el acceso. Revisa las reglas.");
    button.disabled = false;
  }
});

$("#upload-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const file = $("#material-file").files[0];
  const path = $("#storage-path").value.trim().replace(/^\/+/, "");
  if (!file || !path) return;
  if (!path.startsWith("materiales/") && !path.startsWith("paquetes/")) {
    $("#upload-message").textContent = "La ruta debe comenzar con materiales/ o paquetes/.";
    return;
  }
  $("#upload-message").textContent = "";
  $("#upload-progress").classList.remove("hidden");
  const bar = $("#upload-progress span");
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type || "application/octet-stream" });
  task.on("state_changed",
    (snapshot) => { bar.style.width = `${Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)}%`; },
    (error) => {
      console.error(error);
      $("#upload-message").textContent = "No se pudo subir. Revisa la ruta y las reglas de Storage.";
    },
    () => {
      $("#upload-message").textContent = "Archivo subido correctamente.";
      $("#upload-form").reset();
      showToast("Material guardado en Firebase Storage.");
    }
  );
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
  $("#admin-user-email").textContent = user.email || "Cuenta propietaria";
  showOnly("#admin-dashboard");
  await loadUsers();
});
