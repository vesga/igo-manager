// public/js/auth.js
// JavaScript del cliente para las pantallas de registro y login.
// Maneja: validación antes de enviar, mensajes de error desde URL, modal Habeas Data.

(function () {
  'use strict';

  // ── Mensajes de error que vienen en la URL (?error=xxx) ──────────────────
  const ERRORES = {
    habeas:         'Debes aceptar la política de tratamiento de datos personales para continuar.',
    campos:         'Por favor completa todos los campos obligatorios.',
    contrasena:     'La contraseña debe tener al menos 8 caracteres.',
    correo_existe:  'Ya existe una cuenta con ese correo. ¿Quieres iniciar sesión?',
    credenciales:   'Correo o contraseña incorrectos. Verifica tus datos.',
    servidor:       'Ocurrió un error inesperado. Intenta de nuevo en un momento.',
  };

  function mostrarError(msg) {
    const el = document.getElementById('alertError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  // Leer el parámetro ?error= de la URL
  const params = new URLSearchParams(window.location.search);
  const codigoError = params.get('error');
  if (codigoError && ERRORES[codigoError]) {
    mostrarError(ERRORES[codigoError]);
    // Limpiar el query param para que no quede en historial
    history.replaceState({}, '', window.location.pathname);
  }

  // ── Toggle mostrar/ocultar contraseña ────────────────────────────────────
  document.querySelectorAll('.pwd-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const esPassword = input.type === 'password';
      input.type = esPassword ? 'text' : 'password';
      btn.setAttribute('aria-label', esPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });

  // ── Validación del formulario de REGISTRO ────────────────────────────────
  const formRegistro = document.getElementById('formRegistro');
  if (formRegistro) {
    const checkHabeas = document.getElementById('habeas_data');
    const habeasError = document.getElementById('habeasError');

    formRegistro.addEventListener('submit', (e) => {
      let valido = true;

      // Validar Habeas Data (RF-04)
      if (!checkHabeas.checked) {
        habeasError.style.display = 'block';
        valido = false;
      } else {
        habeasError.style.display = 'none';
      }

      // Validar contraseña mínima
      const pwd = document.getElementById('contrasena').value;
      if (pwd.length < 8) {
        mostrarError('La contraseña debe tener al menos 8 caracteres.');
        valido = false;
      }

      if (!valido) {
        e.preventDefault();
        return;
      }

      // Deshabilitar botón para evitar doble envío
      const btn = document.getElementById('btnRegistro');
      btn.textContent = 'Creando cuenta…';
      btn.disabled = true;
    });
  }

  // ── Validación del formulario de LOGIN ───────────────────────────────────
  const formLogin = document.getElementById('formLogin');
  if (formLogin) {
    formLogin.addEventListener('submit', () => {
      const btn = document.getElementById('btnLogin');
      btn.textContent = 'Ingresando…';
      btn.disabled = true;
    });
  }

  // ── Modal Habeas Data ────────────────────────────────────────────────────
  const linkHabeas     = document.getElementById('linkHabeas');
  const modalHabeas    = document.getElementById('modalHabeas');
  const btnCerrarModal = document.getElementById('btnCerrarModal');
  const btnAceptar     = document.getElementById('btnAceptarHabeas');
  const checkHabeasAll = document.getElementById('habeas_data');

  if (linkHabeas && modalHabeas) {
    linkHabeas.addEventListener('click', (e) => {
      e.preventDefault();
      modalHabeas.style.display = 'flex';
    });

    btnCerrarModal.addEventListener('click', () => {
      modalHabeas.style.display = 'none';
    });

    btnAceptar.addEventListener('click', () => {
      checkHabeasAll.checked = true;         // Marcar el checkbox automáticamente
      document.getElementById('habeasError').style.display = 'none';
      modalHabeas.style.display = 'none';
    });

    // Cerrar modal al hacer clic fuera
    modalHabeas.addEventListener('click', (e) => {
      if (e.target === modalHabeas) modalHabeas.style.display = 'none';
    });
  }

})();
