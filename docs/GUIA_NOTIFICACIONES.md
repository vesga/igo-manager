# Guía: Configurar notificaciones (WhatsApp + Correo)

---

## Parte 1 — CallMeBot (WhatsApp gratis)

### Paso 1: Activar CallMeBot en tu WhatsApp

1. Desde tu WhatsApp, envía un mensaje a este número:
   ```
   +34 623 78 64 49
   ```
   Con el texto exacto:
   ```
   I allow callmebot to send me messages
   ```

2. En unos segundos recibirás un mensaje con tu **API Key**, algo así:
   ```
   Your CALLMEBOT API KEY is: 1234567
   ```

3. Copia ese número (tu apikey).

### Paso 2: Pegar en el .env

```env
WHATSAPP_PHONE=573001234567    # tu número colombiano con 57 adelante, sin +
WHATSAPP_APIKEY=1234567        # la clave que te envió CallMeBot
```

> Ejemplo: si tu número es 300 123 4567, pon `573001234567`

### Paso 3: Probar

Reinicia el servidor y envía una solicitud de prueba desde la app. Deberías recibir un WhatsApp.

---

## Parte 2 — Gmail SMTP (correos automáticos)

### Paso 1: Activar verificación en 2 pasos

1. Ve a `myaccount.google.com`
2. Seguridad → Verificación en 2 pasos → Actívala

### Paso 2: Crear contraseña de aplicación

1. En `myaccount.google.com` → Seguridad
2. Busca **"Contraseñas de aplicaciones"** (aparece solo si tienes 2 pasos activo)
3. Selecciona: App → **Correo** / Dispositivo → **Otro** → escribe "IGO Manager"
4. Clic en **Generar**
5. Te dará una contraseña de 16 caracteres tipo: `xxxx xxxx xxxx xxxx`

### Paso 3: Pegar en el .env

```env
GMAIL_USER=tu_correo@gmail.com
GMAIL_PASS=xxxx xxxx xxxx xxxx    # la contraseña de aplicación (con espacios está bien)
```

> ⚠️ Esta NO es tu contraseña normal de Gmail — es una contraseña especial solo para apps.

---

## Parte 3 — Configurar precio y número Nequi

```env
PREMIUM_PRECIO=50000              # precio en pesos colombianos (sin puntos)
PREMIUM_NEQUI=573001234567        # número Nequi donde reciben el pago
APP_URL=https://tu-dominio.com    # URL de tu app en producción
```

---

## Resumen del flujo completo

```
1. Usuario abre modal Premium → tab "Obtener acceso"
2. Ve el precio y el número Nequi
3. Hace el pago por Nequi desde su celular
4. Sube foto del comprobante en el formulario
5. Sistema envía WhatsApp al admin con los datos
6. Sistema envía correo al usuario: "Recibimos tu solicitud, en 24h te enviamos el código"
7. Admin entra al panel → sección "Solicitudes Premium" → ve el comprobante
8. Admin pulsa "Aprobar"
9. Sistema genera código único (ej: IGO-A3F2-9C1D)
10. Sistema envía correo al usuario con el código
11. Admin recibe WhatsApp confirmando que se aprobó
12. Usuario ingresa el código en la app → premium activado
```

---

## Solución de problemas

**No llegan los WhatsApp:**
- Verifica que enviaste el mensaje de activación a CallMeBot
- Confirma que `WHATSAPP_PHONE` tiene el código de país (57 para Colombia)
- Revisa los logs del servidor para ver el error exacto

**No llegan los correos:**
- Verifica que activaste la verificación en 2 pasos en Google
- Confirma que usaste la contraseña de **aplicación**, no tu contraseña normal
- Revisa que `GMAIL_USER` sea el correo completo con @gmail.com

**Error "Less secure app":**
- No aplica si usas contraseña de aplicación (el método correcto)
