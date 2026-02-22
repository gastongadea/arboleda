# Arboleda — Web de actividades

Web app que muestra información de actividades (retiros, círculos de estudio, CRT-CV y cumpleaños) desde una **planilla privada** de Google Sheets, usando una cuenta de servicio. Pensada para desplegar en **Vercel**.

---

## 1. Subir el proyecto a tu GitHub

Desde la carpeta del proyecto en tu PC:

```bash
# Inicializar repo (si aún no es un repositorio git)
git init

# Añadir todos los archivos (node_modules y .env quedan ignorados por .gitignore)
git add .
git commit -m "Web Arboleda con Next.js y Google Sheets API"

# Crear el repositorio en GitHub primero:
#   - Entra en https://github.com/new
#   - Nombre sugerido: Arboleda-sg (o el que prefieras)
#   - No marques "Add a README" si ya tienes uno local
#   - Crear repositorio

# Enlazar con tu cuenta (reemplaza NOMBRE-REPO por el nombre que hayas puesto)
git remote add origin https://github.com/gastongadea/NOMBRE-REPO.git

# Subir la rama main
git branch -M main
git push -u origin main
```

Si el repo ya existe y solo quieres subir cambios:

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

---

## 2. Usar la planilla **sin publicarla en la web** (datos sensibles)

La app lee la planilla con la **Google Sheets API** y una **cuenta de servicio**. La hoja puede seguir privada; solo debe estar compartida con el email de esa cuenta.

### Paso A: Proyecto en Google Cloud

1. Entra en [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto nuevo (o elige uno existente): **Select a project → New Project** → nombre ej. `Arboleda-web` → **Create**.
3. Activa la **Google Sheets API**:
   - Menú ☰ → **APIs & Services** → **Library**.
   - Busca **“Google Sheets API”** → entra → **Enable**.

### Paso B: Cuenta de servicio

1. Menú ☰ → **APIs & Services** → **Credentials**.
2. **+ Create Credentials** → **Service account**.
3. Nombre (ej. `arboleda-sheets-reader`) → **Create and Continue** → puedes saltar los pasos opcionales → **Done**.
4. En la tabla, haz clic en la cuenta que acabas de crear.
5. Pestaña **Keys** → **Add Key** → **Create new key** → **JSON** → **Create**. Se descargará un archivo `.json`.

**Importante:** ese archivo es secreto. No lo subas a GitHub ni lo compartas. Lo usarás solo en variables de entorno.

### Paso C: Compartir la planilla con la cuenta de servicio

1. Abre el JSON descargado. Busca el campo `"client_email"`. Será algo como:  
   `arboleda-sheets-reader@tu-proyecto.iam.gserviceaccount.com`
2. Abre tu planilla de Google Sheets.
3. **Compartir** (botón arriba a la derecha).
4. Pega ese **email** y asígnale permiso **“Lector”** (solo lectura).
5. Desmarca “Notificar a las personas” si no quieres enviar correo → **Compartir**.

Así la app podrá leer la planilla sin que esté publicada en la web.

### Paso D: Contenido del JSON en la variable de entorno

En **Vercel** (y en local si quieres probar) necesitas una variable con **todo el contenido** del JSON de la cuenta de servicio.

1. Abre el archivo `.json` descargado con un editor de texto.
2. Copia **todo** (desde `{` hasta `}`).
3. En Vercel: **Project → Settings → Environment Variables**:
   - **Name:** `GOOGLE_SERVICE_ACCOUNT_JSON`
   - **Value:** pega el JSON completo (una sola línea o con saltos, ambos suelen funcionar).
   - Marca **Production** (y Preview si quieres) → **Save**.

Para desarrollo local, crea un archivo `.env.local` en la raíz del proyecto (no se sube a Git):

```
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...", ...}
```

Luego reinicia `npm run dev`.

---

## 3. Imagen de fondo

Copia tu imagen **`arboleda.png`** en la carpeta **`public`** del proyecto (`public/arboleda.png`). Si no está, la web sigue funcionando con el degradado.

---

## 4. Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Para que carguen los datos, necesitas tener configurado `GOOGLE_SERVICE_ACCOUNT_JSON` en `.env.local` y haber compartido la planilla con el email de la cuenta de servicio.

---

## 5. Despliegue en Vercel (producción)

### Desde GitHub (recomendado)

1. Entra en [vercel.com](https://vercel.com) e inicia sesión (por ejemplo con GitHub).
2. **Add New…** → **Project** → importa el repositorio donde subiste el código (ej. `gastongadea/Arboleda-sg`).
3. Vercel detecta Next.js; no cambies el Framework Preset.
4. **Environment Variables** (obligatorio para que funcionen los datos):
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: el JSON completo de la cuenta de servicio (ver Paso D arriba).
   - Opcional: `SHEET_ID` si usas otra planilla (por defecto ya está en el código).
5. **Deploy**. Cuando termine, tendrás una URL tipo `https://arboleda-sg.vercel.app`. Cada push a la rama principal puede configurarse para que vuelva a desplegar automáticamente.

### Con Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
```

Añade la variable desde el dashboard de Vercel o con:

```bash
vercel env add GOOGLE_SERVICE_ACCOUNT_JSON
```

Pega el JSON cuando lo pida. Luego:

```bash
vercel --prod
```

---

## Estructura de la planilla

Los nombres de las **pestañas** deben coincidir exactamente con los que usa la app:

| Hoja       | Contenido |
|------------|-----------|
| **rt**     | Retiros mensuales: columna A = Lugar, B a L = meses (febrero a diciembre). Cada fila = retiros de cada mes. La app muestra los retiros del mes actual o del próximo. |
| **crt-cv** | Actividades: Actividad, Lugar, Empieza (C), Termina (D), Sacerdote, Director, Inscripción (G). |
| **ces**    | Círculos de estudio: Lugar, día, hora, encargado. |
| **Cumples**| Dos columnas: A = Full Name, B = Nacimiento. La app muestra cumpleaños en los **próximos 30 días**. |

---

## Resumen de variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Sí | JSON completo de la cuenta de servicio (para planilla privada). |
| `SHEET_ID` | No | ID de la planilla (por defecto: el del enlace que diste). |

---

## Tecnologías

- **Next.js 14** (App Router)
- **React 18**
- **Tailwind CSS**
- **Google Sheets API** (lectura con cuenta de servicio; la planilla no se publica en la web).
