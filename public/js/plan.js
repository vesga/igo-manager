// public/js/plan.js
// Lógica del plan de acción: CRUD de tareas, cambio de estado y barra de progreso.

(function () {
  'use strict';

  // ── Modal de confirmación ─────────────────────────────────────────────────
  let _planConfirmCallback = null;

  function mostrarConfirmarPlan(mensaje, onAceptar) {
    document.getElementById('confirmarTareaMensaje').textContent = mensaje;
    _planConfirmCallback = onAceptar;
    document.getElementById('modalConfirmarTarea').style.display = 'flex';
  }

  document.getElementById('btnCancelarConfirmarTarea').addEventListener('click', () => {
    document.getElementById('modalConfirmarTarea').style.display = 'none';
    _planConfirmCallback = null;
  });
  document.getElementById('btnAceptarConfirmarTarea').addEventListener('click', () => {
    document.getElementById('modalConfirmarTarea').style.display = 'none';
    if (_planConfirmCallback) _planConfirmCallback();
    _planConfirmCallback = null;
  });
  document.getElementById('modalConfirmarTarea').addEventListener('click', e => {
    if (e.target === document.getElementById('modalConfirmarTarea')) {
      document.getElementById('modalConfirmarTarea').style.display = 'none';
      _planConfirmCallback = null;
    }
  });


  let todasLasTareas   = [];
  let iniciativas      = [];  // para el select del modal
  let filtroActual     = '';

  // ── Referencias DOM ───────────────────────────────────────────────────────
  const listaEl      = document.getElementById('listaTareas');
  const emptyEl      = document.getElementById('emptyState');
  const alertError   = document.getElementById('alertError');
  const alertSuccess = document.getElementById('alertSuccess');
  const modal        = document.getElementById('modalTarea');
  const selectIni    = document.getElementById('selectIniciativa');
  const inputDesc    = document.getElementById('inputDesc');
  const inputFecha   = document.getElementById('inputFecha');
  const inputPresu   = document.getElementById('inputPresupuesto');
  const inputResp    = document.getElementById('inputResponsable');
  const modalIdEl    = document.getElementById('modalIdTarea');

  // ── Utilidades ────────────────────────────────────────────────────────────
  function mostrarAlerta(tipo, msg) {
    const el   = tipo === 'error' ? alertError : alertSuccess;
    const otro = tipo === 'error' ? alertSuccess : alertError;
    otro.style.display = 'none';
    el.textContent     = msg;
    el.style.display   = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
  }

  async function api(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error en la petición');
    return data;
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatFecha(fechaStr) {
    if (!fechaStr) return null;
    const d = new Date(fechaStr + 'T00:00:00');
    return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
  }

  function formatPesos(val) {
    if (!val) return null;
    return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(val);
  }

  // ── Cargar datos ──────────────────────────────────────────────────────────
  async function cargarTodo() {
    try {
      const [dataTareas, dataInis] = await Promise.all([
        api('GET', '/api/tareas'),
        api('GET', '/api/iniciativas'),
      ]);
      todasLasTareas = dataTareas.tareas;
      iniciativas    = dataInis.iniciativas.filter(i => i.cuadrante); // solo calificadas
      actualizarProgreso(dataTareas);
      llenarSelectIniciativas();
      renderTareas();
    } catch (err) {
      mostrarAlerta('error', err.message);
    }
  }

  // ── Progreso (RF-15) ──────────────────────────────────────────────────────
  function actualizarProgreso({ progreso, total, terminadas }) {
    document.getElementById('progressPct').textContent   = `${progreso}%`;
    document.getElementById('progressFill').style.width  = `${progreso}%`;
    document.getElementById('progressStats').textContent =
      `${terminadas} de ${total} tarea${total !== 1 ? 's' : ''} completada${total !== 1 ? 's' : ''}`;
  }

  // ── Select de iniciativas en el modal ─────────────────────────────────────
  function llenarSelectIniciativas() {
    const ETIQ = { hacer_ya:'¡Hacer Ya!', estrategico:'Estratégico', rutina:'Rutina', descarte:'Descarte' };
    selectIni.innerHTML = '<option value="">Selecciona una iniciativa...</option>' +
      iniciativas.map(i =>
        `<option value="${i.id}">[${ETIQ[i.cuadrante] || i.cuadrante}] ${escHtml(i.titulo)}</option>`
      ).join('');
  }

  // ── Render lista de tareas ────────────────────────────────────────────────
  function renderTareas() {
    const tareas = filtroActual
      ? todasLasTareas.filter(t => t.estado === filtroActual)
      : todasLasTareas;

    if (tareas.length === 0) {
      emptyEl.style.display  = 'block';
      listaEl.innerHTML       = '';
      return;
    }
    emptyEl.style.display = 'none';

    listaEl.innerHTML = tareas.map(t => {
      const estadoCls  = 'estado-' + t.estado.replace(' ', '_');
      const fechaHtml  = t.fecha_limite
        ? `<div class="meta-chip">Fecha: ${formatFecha(t.fecha_limite)}</div>` : '';
      const presHtml   = t.presupuesto
        ? `<div class="meta-chip">Presupuesto: ${formatPesos(t.presupuesto)}</div>` : '';
      const respHtml   = t.responsable
        ? `<div class="meta-chip">Resp.: ${escHtml(t.responsable)}</div>` : '';

      return `
        <div class="tarea-card" data-id="${t.id}">
          <div class="tarea-top">
            <span class="tarea-desc">${escHtml(t.descripcion)}</span>
            <span class="estado-pill ${estadoCls}">${t.estado}</span>
          </div>
          <div class="tarea-ini">Iniciativa: <span>${escHtml(t.iniciativa_titulo)}</span></div>
          <div class="tarea-meta">${fechaHtml}${presHtml}${respHtml}</div>
          <div class="tarea-actions">
            <select class="estado-select" onchange="cambiarEstado(${t.id}, this.value)">
              ${['Pendiente','En proceso','Terminado','Abortado'].map(e =>
                `<option value="${e}" ${t.estado === e ? 'selected' : ''}>${e}</option>`
              ).join('')}
            </select>
            <button class="btn-tarea" onclick="abrirEditar(${t.id})">Editar</button>
            <button class="btn-tarea btn-tarea-del" onclick="eliminar(${t.id})">Eliminar</button>
          </div>
        </div>`;
    }).join('');
  }

  // ── Modal: crear / editar ─────────────────────────────────────────────────
  function abrirNueva() {
    modalIdEl.value  = '';
    selectIni.value  = '';
    inputDesc.value  = '';
    inputFecha.value = '';
    inputPresu.value = '';
    inputResp.value  = '';
    selectIni.disabled = false;
    document.getElementById('modalTitulo').textContent = 'Nueva tarea';
    modal.style.display = 'flex';
    inputDesc.focus();
  }

  window.abrirEditar = function (id) {
    const t = todasLasTareas.find(t => t.id === id);
    if (!t) return;
    modalIdEl.value    = id;
    selectIni.value    = t.iniciativa_id;
    selectIni.disabled = true;  // no se puede cambiar la iniciativa al editar
    inputDesc.value    = t.descripcion;
    inputFecha.value   = t.fecha_limite ? t.fecha_limite.split('T')[0] : '';
    inputPresu.value   = t.presupuesto || '';
    inputResp.value    = t.responsable || '';
    document.getElementById('modalTitulo').textContent = 'Editar tarea';
    modal.style.display = 'flex';
  };

  function cerrarModal() { modal.style.display = 'none'; }

  async function guardarTarea() {
    const id          = modalIdEl.value;
    const iniciativaId = selectIni.value;
    const descripcion  = inputDesc.value.trim();

    if (!descripcion) return mostrarAlerta('error', 'La descripción es obligatoria');
    if (!id && !iniciativaId) return mostrarAlerta('error', 'Selecciona una iniciativa');

    try {
      if (id) {
        await api('PUT', `/api/tareas/${id}`, {
          descripcion,
          fecha_limite: inputFecha.value || null,
          presupuesto:  inputPresu.value || null,
          responsable:  inputResp.value  || null,
        });
        mostrarAlerta('ok', 'Tarea actualizada');
      } else {
        await api('POST', '/api/tareas', {
          iniciativa_id: iniciativaId,
          descripcion,
          fecha_limite: inputFecha.value || null,
          presupuesto:  inputPresu.value || null,
          responsable:  inputResp.value  || null,
        });
        mostrarAlerta('ok', 'Tarea creada');
      }
      cerrarModal();
      await cargarTodo();
    } catch (err) {
      mostrarAlerta('error', err.message);
    }
  }

  // ── Cambiar estado ────────────────────────────────────────────────────────
  window.cambiarEstado = async function (id, estado) {
    try {
      await api('PUT', `/api/tareas/${id}/estado`, { estado });
      // Actualizar localmente sin recargar todo
      const t = todasLasTareas.find(t => t.id === id);
      if (t) t.estado = estado;
      const terminadas = todasLasTareas.filter(t => t.estado === 'Terminado').length;
      const total      = todasLasTareas.length;
      const progreso   = total > 0 ? Math.round((terminadas / total) * 100) : 0;
      actualizarProgreso({ progreso, total, terminadas });
      renderTareas();
    } catch (err) {
      mostrarAlerta('error', err.message);
    }
  };

  // ── Eliminar ──────────────────────────────────────────────────────────────
  window.eliminar = function (id) {
    const t = todasLasTareas.find(t => t.id === id);
    if (!t) return;
    mostrarConfirmarPlan(
      `¿Eliminar la tarea "${t.descripcion?.substring(0, 60)}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          await api('DELETE', `/api/tareas/${id}`);
          mostrarAlerta('ok', 'Tarea eliminada');
          await cargarTodo();
        } catch (err) {
          mostrarAlerta('error', err.message);
        }
      }
    );
  };

  // ── Filtros ───────────────────────────────────────────────────────────────
  document.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('filtro-activo'));
      btn.classList.add('filtro-activo');
      filtroActual = btn.dataset.estado;
      renderTareas();
    });
  });

  // ── Event listeners ───────────────────────────────────────────────────────
  document.getElementById('btnNuevaTarea').addEventListener('click',   abrirNueva);
  document.getElementById('btnCerrarModal').addEventListener('click',  cerrarModal);
  document.getElementById('btnCancelarModal').addEventListener('click',cerrarModal);
  document.getElementById('btnGuardarModal').addEventListener('click', guardarTarea);
  modal.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });

  // Nombre en el nav
  fetch('/api/sesion').then(r => r.json()).then(s => {
    document.getElementById('navUser').textContent = s.nombre;
  });

  // ── Arranque ──────────────────────────────────────────────────────────────
  verificarPremiumPlan();
  cargarTodo();

  // ── Premium check para sugeridor IA ─────────────────────────────────────────

  let planEsPremium = false;

  async function verificarPremiumPlan() {
    try {
      const r    = await fetch('/api/premium/estado');
      const data = await r.json();
      planEsPremium = data.esPremium;
      // Actualizar apariencia del botón
      const btn  = document.getElementById('btnSugerirIA');
      if (planEsPremium) {
        btn.classList.add('desbloqueado');
        btn.textContent = 'Sugerir tareas con IA  ·  Activo';
      } else {
        btn.textContent = 'Sugerir tareas con IA  ·  Premium';
      }
    } catch (_) {}
  }

  // Modal premium reutilizado del dashboard — lo recreamos inline aquí
  function abrirModalPremiumPlan() {
    document.getElementById('modalPremiumPlan').style.display = 'flex';
  }

  function cerrarModalPremiumPlan() {
    document.getElementById('modalPremiumPlan').style.display = 'none';
  }


  // ── Sugeridor de tareas con IA ────────────────────────────────────────────

  const modalSugerir    = document.getElementById('modalSugerir');
  const selectSugerirIni = document.getElementById('selectSugerirIni');
  const sugerirCargando = document.getElementById('sugerirCargando');
  const sugerirError    = document.getElementById('sugerirError');
  const sugerirResultados = document.getElementById('sugerirResultados');
  const listaSugEl      = document.getElementById('listaSugerencias');

  // Llenar el select con iniciativas calificadas
  function llenarSelectSugerir() {
    const ETIQ = { hacer_ya:'¡Hacer Ya!', estrategico:'Estratégico', rutina:'Rutina', descarte:'Descarte' };
    selectSugerirIni.innerHTML = '<option value="">Selecciona una iniciativa calificada...</option>' +
      iniciativas.map(i =>
        `<option value="${i.id}">[${ETIQ[i.cuadrante]}] ${i.titulo}</option>`
      ).join('');
  }

  function abrirModalSugerir() {
    llenarSelectSugerir();
    sugerirCargando.style.display    = 'none';
    sugerirError.style.display       = 'none';
    sugerirResultados.style.display  = 'none';
    listaSugEl.innerHTML             = '';
    modalSugerir.style.display       = 'flex';
  }

  function cerrarModalSugerir() { modalSugerir.style.display = 'none'; }

  async function generarSugerencias() {
    const iniciativaId = selectSugerirIni.value;
    if (!iniciativaId) {
      sugerirError.textContent  = 'Selecciona una iniciativa primero.';
      sugerirError.style.display = 'block';
      return;
    }

    sugerirCargando.style.display   = 'flex';
    sugerirError.style.display      = 'none';
    sugerirResultados.style.display = 'none';

    try {
      const data = await api('POST', '/api/tareas/sugerir', { iniciativa_id: iniciativaId });

      sugerirCargando.style.display = 'none';

      if (!data.sugerencias || data.sugerencias.length === 0) {
        throw new Error('La IA no generó sugerencias. Intenta de nuevo.');
      }

      // Calcular fecha límite basada en días sugeridos
      function fechaDesdeHoy(dias) {
        const d = new Date();
        d.setDate(d.getDate() + (dias || 7));
        return d.toISOString().split('T')[0];
      }

      document.getElementById('sugerirIntro').textContent =
        `Sugerencias para: "${data.iniciativa.titulo}"`;

      listaSugEl.innerHTML = data.sugerencias.map((s, idx) => `
        <div class="sugerencia-card" id="sug-${idx}">
          <div class="sug-desc">${s.descripcion}</div>
          <div class="sug-meta">
            ${s.responsable ? `<span class="sug-chip">Responsable: ${s.responsable}</span>` : ''}
            ${s.dias_sugeridos ? `<span class="sug-chip">~${s.dias_sugeridos} días</span>` : ''}
          </div>
          <button class="btn-agregar-sug" onclick="agregarSugerencia(${idx}, '${iniciativaId}', this)">
            + Agregar al plan
          </button>
        </div>
      `).join('');

      // Guardar datos para el onclick
      window._sugerencias = data.sugerencias;
      window._sugFechas   = data.sugerencias.map(s => fechaDesdeHoy(s.dias_sugeridos));
      sugerirResultados.style.display = 'block';

    } catch (err) {
      sugerirCargando.style.display = 'none';
      sugerirError.textContent      = err.message;
      sugerirError.style.display    = 'block';
    }
  }

  // Agregar una sugerencia individual al plan con un clic
  window.agregarSugerencia = async function (idx, iniciativaId, btn) {
    const s = window._sugerencias[idx];
    if (!s) return;

    btn.disabled     = true;
    btn.textContent  = 'Agregando...';

    try {
      await api('POST', '/api/tareas', {
        iniciativa_id: iniciativaId,
        descripcion:   s.descripcion,
        responsable:   s.responsable  || null,
        fecha_limite:  window._sugFechas[idx] || null,
        presupuesto:   null,
      });

      btn.textContent = '✓ Agregada';
      btn.classList.add('agregada');

      // Recargar la lista de tareas en segundo plano
      cargarTodo();

    } catch (err) {
      btn.disabled    = false;
      btn.textContent = '+ Agregar al plan';
      mostrarAlerta('error', err.message);
    }
  };

  document.getElementById('btnSugerirIA').addEventListener('click', () => {
    if (planEsPremium) {
      abrirModalSugerir();
    } else {
      abrirModalPremiumPlan();
    }
  });
  document.getElementById('btnCerrarSugerir').addEventListener('click',    cerrarModalSugerir);
  document.getElementById('btnGenerarSugerencias').addEventListener('click', generarSugerencias);
  modalSugerir.addEventListener('click', e => { if (e.target === modalSugerir) cerrarModalSugerir(); });


  document.getElementById('btnCerrarPremiumPlan').addEventListener('click',  cerrarModalPremiumPlan);
  document.getElementById('btnCancelarPremiumPlan').addEventListener('click', cerrarModalPremiumPlan);
  document.getElementById('btnIrDashboard').addEventListener('click', () => {
    window.location.href = '/app/dashboard';
  });
  document.getElementById('modalPremiumPlan').addEventListener('click', e => {
    if (e.target === document.getElementById('modalPremiumPlan')) cerrarModalPremiumPlan();
  });

})();
