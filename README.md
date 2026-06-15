# app app 2026 — versión Vercel

Esta es la versión del proyecto lista para desplegar fuera de Claude, en
[Vercel](https://vercel.com), con datos persistentes guardados en
[Firebase Firestore](https://firebase.google.com) (gratis).

Tus amigos seguirán sin necesitar registrarse. Solo tú (organizador) necesitas
crear las cuentas gratuitas de GitHub, Vercel y Firebase para montarlo.

---

## Paso 1 — Crear el proyecto de Firebase (la base de datos)

1. Entra a https://console.firebase.google.com y crea un proyecto nuevo
   (cualquier nombre, ej. `app-app`). No necesitas activar Analytics.
2. Dentro del proyecto, ve a **Build → Firestore Database** y haz clic en
   **Crear base de datos**.
   - Elige **modo de prueba** (test mode). Esto deja la base de datos abierta
     por 30 días; más abajo te explico cómo dejarla abierta de forma
     permanente para este caso de uso.
   - Elige cualquier región (la más cercana a ustedes).
3. Ve a **Configuración del proyecto** (el ícono de engranaje) →
   **General** → baja hasta "Tus apps" → haz clic en el ícono `</>` (Web) para
   registrar una app web.
   - Ponle un nombre (ej. "app-web"), no necesitas Firebase Hosting.
4. Firebase te mostrará un bloque `firebaseConfig` con varios valores
   (`apiKey`, `authDomain`, `projectId`, etc.). **Guárdalos**, los vas a
   necesitar en el paso 3.

### Reglas de Firestore (importante)

Por defecto, el "modo de prueba" cierra el acceso después de 30 días. Como
esta app no tiene login, las reglas deben permitir lectura/escritura
abierta en la colección `app`. Ve a **Firestore Database → Reglas** y
reemplaza el contenido por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /app/{document=**} {
      allow read, write: if true;
    }
  }
}
```

---

## Paso 2 — Subir el proyecto a GitHub

1. Crea una cuenta gratis en https://github.com si no tienes una.
2. Crea un repositorio nuevo (puede ser privado), ej. `app-app-2026`.
3. Sube todos los archivos de esta carpeta a ese repositorio. Si nunca has
   usado git, la forma más fácil es:
   - En la página del repo recién creado, usa la opción **"uploading an
     existing file"** y arrastra todos los archivos/carpetas de este
     proyecto (manteniendo la estructura de carpetas: `app/`, `components/`,
     `lib/`, etc.).
   - O, si tienes git instalado:
     ```bash
     cd app-vercel
     git init
     git add .
     git commit -m "app app 2026"
     git branch -M main
     git remote add origin https://github.com/TU-USUARIO/app-app-2026.git
     git push -u origin main
     ```

---

## Paso 3 — Desplegar en Vercel

1. Crea una cuenta gratis en https://vercel.com (puedes entrar con tu cuenta
   de GitHub).
2. Haz clic en **Add New → Project** y elige el repositorio
   `app-app-2026` que acabas de subir.
3. Vercel detectará automáticamente que es un proyecto Next.js. Antes de
   darle "Deploy", abre la sección **Environment Variables** y agrega los
   6 valores del `firebaseConfig` del Paso 1, con estos nombres exactos:

   | Nombre de la variable                  | Valor (de firebaseConfig) |
   |-----------------------------------------|----------------------------|
   | `NEXT_PUBLIC_FIREBASE_API_KEY`           | `apiKey`                    |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`       | `authDomain`                |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID`        | `projectId`                 |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`    | `storageBucket`             |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId`       |
   | `NEXT_PUBLIC_FIREBASE_APP_ID`            | `appId`                     |

4. Haz clic en **Deploy** y espera 1-2 minutos.
5. Cuando termine, Vercel te da una URL pública (algo como
   `https://app-app-2026.vercel.app`). Esa es la que comparten tus
   amigos.

---

## Paso 4 — Probarlo

- Abre la URL, y prueba

---
