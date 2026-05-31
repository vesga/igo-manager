// public/js/app.js
// JavaScript del cliente para páginas de la app (autenticadas).
// Se carga en dashboard, perfil y otras pantallas de la app.

(function () {
  'use strict';

  // ── Mostrar nombre del usuario en el nav ──────────────────────────────────
  // El endpoint /api/sesion devuelve { id, nombre, rol }
  const navUser = document.getElementById('navUser');
  if (navUser) {
    fetch('/api/sesion')
      .then(r => r.json())
      .then(s => { navUser.textContent = s.nombre; })
      .catch(() => { /* sin sesión, el middleware ya redirigió */ });
  }

  // ── Leer mensajes de error desde URL (?error=xxx) ────────────────────────
  const ERRORES = {
    servidor: 'Ocurrió un error inesperado. Intenta de nuevo.',
  };

  const params = new URLSearchParams(window.location.search);
  const codigoError = params.get('error');
  const alertError  = document.getElementById('alertError');
  if (codigoError && alertError && ERRORES[codigoError]) {
    alertError.textContent  = ERRORES[codigoError];
    alertError.style.display = 'block';
    history.replaceState({}, '', window.location.pathname);
  }

})();
