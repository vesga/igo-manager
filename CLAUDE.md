# CLAUDE.md — Contexto del proyecto IGO

## Qué es este proyecto

Aplicación web **IGO** que digitaliza la metodología de consultoría **Importancia vs. Gobernabilidad** de Dinámica del Oriente S.A.S. Permite a un emprendedor registrar sus iniciativas/necesidades de negocio, calificarlas en dos ejes (Importancia y Gobernabilidad), verlas ubicadas en una matriz de 4 cuadrantes y recibir una recomendación de qué atender primero.

Es un **ejercicio de clase**: prioriza claridad, simplicidad y código entendible sobre sofisticación.

## Stack de ESTE equipo

- **Backend:** Node.js + Express
- **Frontend:** HTML + CSS + JS puro (sin frameworks)
- **Base de datos:** MySQL
- **Hosting objetivo:** Hostinger

## Reglas de trabajo

1. **Construimos por sprints.** No adelantes funcionalidades de sprints futuros. Si detectas algo importante fuera del sprint actual, anótalo como comentario `// TODO sprint N`.
2. **Cambios pequeños y explicables.** Genera el cambio mínimo que cumple el objetivo. Tras cada cambio, explica en 2–3 frases qué hiciste y cómo probarlo.
3. **Código didáctico.** Comenta las partes con lógica no obvia (sobre todo el cálculo de cuadrantes). Usa nombres de variables claros.
4. **Pregunta si hay ambigüedad** en vez de inventar reglas de negocio.
5. **No instales dependencias pesadas** sin justificarlo.
6. Cuando termines una tarea, di explícitamente **cómo validarla**.

## Dependencias instaladas

- `express` — servidor web
- `express-session` — manejo de sesiones
- `mysql2` — conexión a MySQL (usa promesas/async-await)
- `bcryptjs` — hash de contraseñas (versión JS pura, sin compilación nativa)
- `dotenv` — variables de entorno
- `nodemon` (dev) — recarga automática en desarrollo

## Estructura del proyecto

```
igo-manager/
├── src/
│   ├── app.js              ← entrada principal del servidor
│   ├── config/
│   │   └── db.js           ← pool de conexión a MySQL
│   ├── routes/             ← rutas Express (vacío, se llena en sprint 1)
│   ├── controllers/        ← lógica de negocio (vacío, se llena en sprint 1)
│   └── middleware/         ← middlewares custom (ej: verificar sesión)
├── public/
│   ├── css/main.css        ← estilos globales
│   ├── js/main.js          ← JS del cliente
│   └── views/              ← páginas HTML
│       ├── index.html      ← página de inicio (landing)
│       ├── auth/           ← login, registro
│       ├── app/            ← páginas del usuario autenticado
│       └── admin/          ← panel administrativo
├── docs/
│   ├── schema.sql          ← esquema completo de la BD
│   └── mockups/            ← imágenes de mockups (Sprint 0)
├── .env.example            ← plantilla de variables de entorno
├── .env                    ← variables reales (NO subir a Git)
├── .gitignore
└── package.json
```

## Cómo correr el proyecto

```bash
# 1. Instalar dependencias (solo la primera vez)
npm install

# 2. Copiar el archivo de variables de entorno y completarlo
cp .env.example .env
# Editar .env con tus datos de MySQL

# 3. Crear la base de datos
# Abrir MySQL y ejecutar: docs/schema.sql

# 4. Levantar el servidor en modo desarrollo
npm run dev
# → http://localhost:3000
```

## Lógica del motor IGO (referencia exacta)

- Cada iniciativa tiene `importancia` (1–10) y `gobernabilidad` (1–10), asignadas por el usuario.
- Eje Y = Importancia. Eje X = Gobernabilidad.
- Las líneas divisorias se calculan como el **promedio** de importancia y el **promedio** de gobernabilidad de TODAS las iniciativas del usuario. Se recalculan cada vez que cambian.
- Clasificación:
  - Importancia > promedio_I  Y  Gobernabilidad > promedio_G  → **¡Hacer Ya!**
  - Importancia > promedio_I  Y  Gobernabilidad ≤ promedio_G → **Estratégico**
  - Importancia ≤ promedio_I  Y  Gobernabilidad > promedio_G  → **Rutina**
  - Importancia ≤ promedio_I  Y  Gobernabilidad ≤ promedio_G → **Descarte**

## Fuera de alcance

- ❌ Sin Inteligencia Artificial (cero inferencia automática de valores)
- ❌ Sin modelo de pago
- ❌ Sin sucursales por empresa
