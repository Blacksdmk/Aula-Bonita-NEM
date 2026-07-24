# Aula Bonita NEM

Catálogo privado compatible con GitHub Pages. Utiliza Firebase Authentication,
Realtime Database y carpetas privadas de Google Drive para evitar la necesidad
de Firebase Storage.

## Arquitectura

- GitHub Pages publica solamente el sitio.
- Firebase Authentication identifica a cada persona.
- Realtime Database guarda perfiles, estado de acceso y enlace de biblioteca.
- Google Drive almacena los Word y ZIP.
- Cada carpeta de Drive debe compartirse únicamente con el correo de la
  compradora y conservar el acceso general como **Restringido**.
- El UID propietario configurado en las reglas es el único que puede listar
  cuentas, activar accesos y asignar enlaces.

Los archivos comerciales nunca deben subirse al repositorio público.

## Configurar Firebase

1. Abre el proyecto `aula-8646a` en Firebase Console.
2. En Authentication, habilita **Correo electrónico/contraseña**.
3. En Realtime Database, abre **Rules**.
4. Copia el contenido de `firebase/database.rules.json` y publícalo.
5. En Authentication → Settings → Authorized domains agrega:
   `blacksdmk.github.io`.

También puedes publicar las reglas mediante Firebase CLI:

```bash
cd firebase
firebase use --add
firebase deploy --only database
```

## Flujo de venta

1. La compradora crea su cuenta.
2. Realtime Database crea `users/{uid}` con `active: false`.
3. Confirma el pago por transferencia bancaria.
4. En Google Drive crea o duplica una carpeta con los materiales adquiridos.
5. Comparte la carpeta exclusivamente con el correo registrado.
6. Conserva **Acceso general → Restringido**.
7. Abre `/web/admin.html`.
8. Pega el enlace de la carpeta en la cuenta y pulsa **Guardar enlace**.
9. Pulsa **Activar**.

La compradora podrá abrir su biblioteca después de volver a iniciar sesión o
recargar la página. Para revocar el acceso pulsa **Suspender** y, si hace falta,
retira también su permiso en Google Drive.

## Datos guardados

```text
users/
  UID:
    name: "Nombre"
    email: "correo@ejemplo.com"
    active: false
    createdAt: 1780000000000
    libraryUrl: "https://drive.google.com/..."
```

Las reglas impiden que una compradora cambie `active` o `libraryUrl`. Sólo puede
crear su propio perfil inicial inactivo.

## Publicar el sitio

La rama principal debe llamarse `main`. En GitHub:

1. Abre **Settings → Pages**.
2. Selecciona **GitHub Actions**.
3. El flujo `.github/workflows/deploy-pages.yml` publica el sitio.

## Seguridad

- No publiques contraseñas, datos bancarios, tokens ni credenciales privadas.
- No configures Drive como “Cualquier persona con el enlace”.
- No guardes Word, ZIP o archivos codificados en Realtime Database.
- Al suspender una cuenta, elimina también su acceso en Google Drive.
