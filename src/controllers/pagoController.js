// src/controllers/pagoController.js
// Sistema de solicitudes de pago premium.
// Flujo: usuario sube comprobante → WhatsApp al admin → correo al usuario → admin aprueba → código por correo

const pool       = require('../config/db');
const nodemailer = require('nodemailer');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');

// ── Configuración de correo (Gmail SMTP) ─────────────────────────────────────
function crearTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,   // contraseña de aplicación de Google
    },
  });
}

// ── Enviar mensaje de WhatsApp via CallMeBot ──────────────────────────────────
async function enviarWhatsApp(mensaje) {
  const phone  = process.env.WHATSAPP_PHONE;
  const apikey = process.env.WHATSAPP_APIKEY;
  if (!phone || !apikey) {
    console.warn('WhatsApp no configurado (WHATSAPP_PHONE o WHATSAPP_APIKEY faltantes)');
    return;
  }
  const texto = encodeURIComponent(mensaje);
  const url   = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${texto}&apikey=${apikey}`;
  try {
    await fetch(url);
  } catch (err) {
    console.error('Error enviando WhatsApp:', err);
  }
}

// ── Generar código premium único ──────────────────────────────────────────────
function generarCodigo() {
  // Formato: IGO-XXXX-XXXX (letras y números, fácil de escribir)
  const parte = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `IGO-${parte()}-${parte()}`;
}

// ── POST /api/pagos/solicitar ─────────────────────────────────────────────────
// El usuario envía el formulario con su comprobante
exports.solicitar = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { nombre, correo, metodo_pago } = req.body;

  if (!nombre?.trim() || !correo?.trim() || !metodo_pago) {
    return res.status(400).json({ error: 'Completa todos los campos obligatorios' });
  }

  try {
    // Verificar si ya tiene premium
    const [user] = await pool.execute(
      'SELECT es_premium FROM usuario WHERE id = ?', [usuarioId]
    );
    if (user[0]?.es_premium) {
      return res.status(400).json({ error: 'Tu cuenta ya tiene acceso premium activo' });
    }

    // Verificar si ya tiene una solicitud pendiente
    const [pendientes] = await pool.execute(
      `SELECT id FROM solicitud_premium WHERE usuario_id = ? AND estado = 'pendiente'`,
      [usuarioId]
    );
    if (pendientes.length > 0) {
      return res.status(400).json({
        error: 'Ya tienes una solicitud pendiente. Te contactaremos pronto.'
      });
    }

    // Guardar ruta del comprobante si se subió
    const comprobanteUrl = req.file
      ? `/uploads/comprobantes/${req.file.filename}`
      : null;

    // Insertar solicitud en la BD
    const [resultado] = await pool.execute(
      `INSERT INTO solicitud_premium (usuario_id, nombre, correo, metodo_pago, comprobante_url)
       VALUES (?, ?, ?, ?, ?)`,
      [usuarioId, nombre.trim(), correo.trim(), metodo_pago, comprobanteUrl]
    );

    const solicitudId = resultado.insertId;
    const precio      = process.env.PREMIUM_PRECIO || '50000';

    // ── 1. Notificar al admin por WhatsApp ────────────────────────────────────
    const msgWA = `🔔 Nueva solicitud premium IGO Manager\n` +
      `👤 ${nombre.trim()}\n` +
      `📧 ${correo.trim()}\n` +
      `💳 Método: ${metodo_pago}\n` +
      `🆔 Solicitud #${solicitudId}\n` +
      `✅ Aprueba en: ${process.env.APP_URL || 'http://localhost:3000'}/admin`;
    await enviarWhatsApp(msgWA);

    // ── 2. Confirmar al usuario por correo ────────────────────────────────────
    if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      try {
        const transporter = crearTransporter();
        await transporter.sendMail({
          from:    `"IGO Manager" <${process.env.GMAIL_USER}>`,
          to:      correo.trim(),
          subject: 'Recibimos tu solicitud de acceso Premium — IGO Manager',
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
              <div style="background:#13131c;padding:24px;border-radius:12px">
                <h2 style="color:#a78bfa;margin:0 0 8px">IGO Manager</h2>
                <p style="color:#94a3b8;font-size:12px;margin:0">Dinámica del Oriente S.A.S.</p>
              </div>
              <div style="padding:24px 0">
                <p>Hola <strong>${nombre.trim()}</strong>,</p>
                <p>Recibimos tu solicitud de acceso Premium. La estamos revisando y en menos de
                   <strong>24 horas</strong> recibirás tu código de activación en este correo.</p>
                <div style="background:#f8f9fa;border-left:4px solid #7c6dfa;padding:16px;border-radius:4px;margin:20px 0">
                  <p style="margin:0;font-size:13px;color:#475569">
                    <strong>Solicitud #${solicitudId}</strong><br/>
                    Método de pago: ${metodo_pago}<br/>
                    Monto: $${Number(precio).toLocaleString('es-CO')} COP
                  </p>
                </div>
                <p>Si tienes alguna pregunta puedes responder a este correo.</p>
                <p>— El equipo de Dinámica del Oriente</p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Error enviando correo de confirmación:', emailErr);
        // No interrumpir — la solicitud ya se guardó
      }
    }

    res.json({
      mensaje: 'Solicitud enviada. Recibirás tu código en menos de 24 horas.',
      solicitudId,
    });

  } catch (err) {
    console.error('Error en solicitar pago:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
};

// ── GET /api/pagos/mis-solicitudes ────────────────────────────────────────────
exports.misSolicitudes = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  try {
    const [filas] = await pool.execute(
      `SELECT id, metodo_pago, estado, creado_en, codigo_enviado
       FROM solicitud_premium WHERE usuario_id = ? ORDER BY creado_en DESC`,
      [usuarioId]
    );
    res.json({ solicitudes: filas });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
};

// ── GET /api/admin/pagos ──────────────────────────────────────────────────────
// Panel admin: listar todas las solicitudes pendientes
exports.listarAdmin = async (req, res) => {
  try {
    const [filas] = await pool.execute(
      `SELECT sp.id, sp.nombre, sp.correo, sp.metodo_pago, sp.estado,
              sp.comprobante_url, sp.creado_en, sp.codigo_enviado, sp.notas,
              u.correo AS usuario_correo
       FROM solicitud_premium sp
       JOIN usuario u ON sp.usuario_id = u.id
       ORDER BY sp.estado ASC, sp.creado_en DESC`
    );
    res.json({ solicitudes: filas });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
};

// ── POST /api/admin/pagos/:id/aprobar ─────────────────────────────────────────
// Admin aprueba la solicitud → genera código → activa premium → envía correo
exports.aprobar = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Obtener la solicitud
    const [filas] = await pool.execute(
      `SELECT sp.*, u.id AS uid FROM solicitud_premium sp
       JOIN usuario u ON sp.usuario_id = u.id
       WHERE sp.id = ?`,
      [id]
    );
    if (filas.length === 0) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const sol = filas[0];
    if (sol.estado === 'aprobada') {
      return res.status(400).json({ error: 'Esta solicitud ya fue aprobada' });
    }

    // 2. Generar código único
    const codigo = generarCodigo();

    // 3. Actualizar la solicitud y activar premium en el usuario
    await pool.execute(
      `UPDATE solicitud_premium SET estado = 'aprobada', codigo_enviado = ? WHERE id = ?`,
      [codigo, id]
    );
    await pool.execute(
      'UPDATE usuario SET es_premium = 1 WHERE id = ?',
      [sol.uid]
    );

    // 4. Enviar código por correo al usuario
    if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      try {
        const transporter = crearTransporter();
        await transporter.sendMail({
          from:    `"IGO Manager" <${process.env.GMAIL_USER}>`,
          to:      sol.correo,
          subject: '¡Tu código Premium está listo! — IGO Manager',
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
              <div style="background:#13131c;padding:24px;border-radius:12px">
                <h2 style="color:#a78bfa;margin:0 0 8px">IGO Manager</h2>
                <p style="color:#94a3b8;font-size:12px;margin:0">Dinámica del Oriente S.A.S.</p>
              </div>
              <div style="padding:24px 0">
                <p>Hola <strong>${sol.nombre}</strong>,</p>
                <p>¡Tu acceso Premium ha sido aprobado! Usa el siguiente código para activarlo:</p>
                <div style="background:#1e1b4b;border:2px solid #7c6dfa;border-radius:12px;
                  padding:24px;text-align:center;margin:20px 0">
                  <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;letter-spacing:1px;text-transform:uppercase">
                    Tu código de acceso
                  </p>
                  <p style="color:#a78bfa;font-size:2rem;font-weight:900;letter-spacing:4px;margin:0">
                    ${codigo}
                  </p>
                </div>
                <p style="font-size:13px;color:#475569">
                  <strong>Cómo usarlo:</strong><br/>
                  1. Entra a IGO Manager<br/>
                  2. En el dashboard, pulsa "Resumen ejecutivo IA"<br/>
                  3. Ingresa el código cuando te lo pida<br/>
                  4. ¡Listo! Tu cuenta queda activada permanentemente.
                </p>
                <p>— El equipo de Dinámica del Oriente</p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Error enviando correo de aprobación:', emailErr);
      }
    }

    // 5. Notificar al admin por WhatsApp
    await enviarWhatsApp(
      `✅ Premium aprobado\n👤 ${sol.nombre}\n🔑 Código: ${codigo}\n📧 Enviado a: ${sol.correo}`
    );

    res.json({ mensaje: 'Solicitud aprobada y código enviado', codigo });

  } catch (err) {
    console.error('Error en aprobar:', err);
    res.status(500).json({ error: 'Error al aprobar la solicitud' });
  }
};

// ── POST /api/admin/pagos/:id/rechazar ────────────────────────────────────────
exports.rechazar = async (req, res) => {
  const { id }   = req.params;
  const { notas } = req.body;

  try {
    const [filas] = await pool.execute(
      'SELECT * FROM solicitud_premium WHERE id = ?', [id]
    );
    if (filas.length === 0) return res.status(404).json({ error: 'No encontrada' });

    await pool.execute(
      `UPDATE solicitud_premium SET estado = 'rechazada', notas = ? WHERE id = ?`,
      [notas || null, id]
    );

    // Notificar al usuario por correo
    if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      try {
        const sol = filas[0];
        const transporter = crearTransporter();
        await transporter.sendMail({
          from:    `"IGO Manager" <${process.env.GMAIL_USER}>`,
          to:      sol.correo,
          subject: 'Actualización sobre tu solicitud Premium — IGO Manager',
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px 0">
              <p>Hola <strong>${sol.nombre}</strong>,</p>
              <p>No pudimos verificar tu pago. Por favor contáctanos para resolver esto.</p>
              ${notas ? `<p><strong>Detalle:</strong> ${notas}</p>` : ''}
              <p>— El equipo de Dinámica del Oriente</p>
            </div>
          `,
        });
      } catch (e) { console.error(e); }
    }

    res.json({ mensaje: 'Solicitud rechazada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al rechazar' });
  }
};
