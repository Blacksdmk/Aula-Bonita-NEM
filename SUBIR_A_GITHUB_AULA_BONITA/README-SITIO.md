# Aula Bonita NEM

Sitio estático compatible con GitHub Pages. Utiliza Firebase Authentication,
Firestore y Storage para controlar el acceso a materiales descargables.

## Arquitectura de seguridad

- GitHub Pages publica solamente HTML, CSS y JavaScript.
- Los archivos Word y ZIP no deben subirse a la carpeta `web` ni quedar en un
  repositorio público.
- Firebase Authentication identifica a cada persona.
- El documento `users/{uid}` contiene `active: true` cuando el pago fue
  confirmado.
- Firebase Storage permite leer archivos solamente si ese campo está activo.
- La interfaz descarga con `getBytes`; no publica enlaces permanentes con token.

## 1. Crear y configurar Firebase

1. Crea un proyecto en Firebase Console.
2. En Authentication, habilita **Correo electrónico/contraseña**.
3. Crea Firestore en modo producción.
4. Habilita Firebase Storage.
5. Registra una aplicación web y copia su objeto de configuración.
6. Pega esos valores en `web/firebase-config.js`.

La configuración web de Firebase no es un secreto. La seguridad depende de las
reglas y de la validación de la cuenta, no de ocultar esa configuración.

## 2. Publicar reglas

Instala Firebase CLI, inicia sesión y ejecuta desde la carpeta `firebase`:

```bash
firebase use --add
firebase deploy --only firestore:rules,storage
```

Antes, selecciona el proyecto correcto. No cambies las reglas para permitir
lectura pública.

## 3. Configurar CORS de Storage

Reemplaza `TU-USUARIO` en `firebase/cors.json`. Después aplica el archivo al
bucket con Google Cloud CLI:

```bash
gcloud storage buckets update gs://TU-BUCKET --cors-file=cors.json
```

Agrega también un dominio personalizado si lo utilizarás.

## 4. Subir los materiales

La aplicación espera estas carpetas:

```text
paquetes/
  Paquete_Fase_3_NEM_Editable.zip
  Paquete_Fase_4_NEM_Editable.zip
  Paquete_Fase_5_NEM_Editable.zip

materiales/
  fase-3/
  fase-4/
  fase-5/
  universales/
```

Los nombres exactos de cada archivo están definidos en `web/app.js`, propiedad
`storagePath`. Puedes cambiarlos antes de cargar los documentos.

## 5. Aprobar un pago

Cuando alguien se registra se crea:

```text
users/{uid}
  name: "Nombre"
  email: "correo@ejemplo.com"
  active: false
```

Después de confirmar el pago:

1. Abre Firestore en Firebase Console.
2. Busca el documento de la persona.
3. Cambia `active` a `true`.

La persona debe recargar el sitio o volver a iniciar sesión. Para revocar el
acceso cambia `active` a `false`.

Opcionalmente puedes agregar un campo Timestamp `expiresAt`; el sitio lo toma en
cuenta para accesos con vencimiento. Para validar también la expiración en
Storage Rules deberá añadirse esa comparación a las reglas.

## 6. Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube este proyecto.
2. Confirma que la rama principal se llame `main`.
3. En **Settings → Pages**, selecciona **GitHub Actions** como fuente.
4. El flujo `.github/workflows/deploy-pages.yml` publicará la carpeta `web`.
5. Agrega el dominio de GitHub Pages a **Authentication → Settings →
   Authorized domains** en Firebase.

## Personalización pendiente

Busca y reemplaza:

- `Aula Bonita`
- instrucciones de pago;
- datos de contacto;
- aviso de privacidad;
- términos de licencia;
- tiempos de activación;
- condiciones para compartir o imprimir materiales.

## Recomendación comercial

La aprobación manual es adecuada para una primera versión. Si después quieres
activación automática por pago, utiliza Stripe o Mercado Pago mediante una
función de servidor o webhook. Nunca pongas una clave secreta de pagos en
GitHub Pages.
