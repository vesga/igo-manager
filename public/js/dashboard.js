// public/js/dashboard.js
// Lógica completa del dashboard: CRUD de iniciativas, calificación con sliders
// y renderizado de la matriz IGO en un canvas.

(function () {
  'use strict';

  // ── Estado global de la página ────────────────────────────────────────────
  // Guardamos los datos en memoria para no recargar la página con cada cambio.
  let estado = {
    iniciativas: [],
    promedioI:   5,
    promedioG:   5,
    recomendaciones: {},
    etiquetas:   {},
  };

  // ── Referencias al DOM ────────────────────────────────────────────────────
  const listaEl         = document.getElementById('listaIniciativas');
  const emptyEl         = document.getElementById('emptyState');
  const badgeEl         = document.getElementById('badgeCount');
  const alertError      = document.getElementById('alertError');
  const alertSuccess    = document.getElementById('alertSuccess');

  // Modal iniciativa
  const modalIni        = document.getElementById('modalIniciativa');
  const inputTitulo     = document.getElementById('inputTitulo');
  const inputDesc       = document.getElementById('inputDescripcion');
  const modalIdEl       = document.getElementById('modalIdIniciativa');
  const modalTituloEl   = document.getElementById('modalTitulo');

  // Modal calificar
  const modalCal        = document.getElementById('modalCalificar');
  const calIdEl         = document.getElementById('calificarId');
  const calTituloEl     = document.getElementById('calificarTitulo');
  const sliderImp       = document.getElementById('sliderImportancia');
  const sliderGob       = document.getElementById('sliderGobernabilidad');
  const valImpEl        = document.getElementById('valImportancia');
  const valGobEl        = document.getElementById('valGobernabilidad');

  // Canvas
  const canvas          = document.getElementById('canvasIGO');
  const ctx             = canvas.getContext('2d');

  // ── Utilidades ────────────────────────────────────────────────────────────

  function mostrarAlerta(tipo, msg) {
    const el = tipo === 'error' ? alertError : alertSuccess;
    const otro = tipo === 'error' ? alertSuccess : alertError;
    otro.style.display = 'none';
    el.textContent     = msg;
    el.style.display   = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  async function api(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error en la petición');
    return data;
  }

  // ── Cargar datos del servidor ─────────────────────────────────────────────

  async function cargarIniciativas() {
    try {
      const data = await api('GET', '/api/iniciativas');
      estado = { ...estado, ...data };
      renderLista();
      renderMatriz();
      renderRecomendaciones();
    } catch (err) {
      mostrarAlerta('error', err.message);
    }
  }

  // ── Render: lista de tarjetas ─────────────────────────────────────────────

  function renderLista() {
    const inis = estado.iniciativas;
    badgeEl.textContent = inis.length;

    if (inis.length === 0) {
      emptyEl.style.display   = 'block';
      listaEl.innerHTML        = '';
      return;
    }
    emptyEl.style.display = 'none';

    listaEl.innerHTML = inis.map(ini => {
      const cuad    = ini.cuadrante;
      const etiq    = cuad ? (estado.etiquetas[cuad] || cuad) : null;
      const pillCls = cuad ? `pill-${cuad}` : 'pill-sin';
      const pillTxt = etiq || 'Sin calificar';

      const scoreHtml = (ini.importancia != null)
        ? `<div class="card-scores">
             <div class="score-chip">Imp <strong>${ini.importancia}</strong>/10</div>
             <div class="score-chip">Gob <strong>${ini.gobernabilidad}</strong>/10</div>
           </div>`
        : `<div class="card-scores"><span class="score-none">Aún sin calificación</span></div>`;

      const desc = ini.descripcion
        ? `<p class="card-desc">${escHtml(ini.descripcion)}</p>`
        : '';

      return `
        <div class="iniciativa-card" data-id="${ini.id}">
          <div class="card-top">
            <span class="card-titulo">${escHtml(ini.titulo)}</span>
            <span class="cuadrante-pill ${pillCls}">${pillTxt}</span>
          </div>
          ${desc}
          ${scoreHtml}
          <div class="card-actions">
            <button class="btn-card btn-card-calificar" onclick="abrirCalificar(${ini.id})">
              ✏️ Calificar
            </button>
            <button class="btn-card btn-card-edit" onclick="abrirEditar(${ini.id})">
              Editar
            </button>
            <button class="btn-card btn-card-del" onclick="eliminar(${ini.id})">
              Eliminar
            </button>
          </div>
        </div>`;
    }).join('');
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Render: recomendaciones por cuadrante ────────────────────────────────

  function renderRecomendaciones() {
    const tieneCalificadas = estado.iniciativas.some(i => i.cuadrante);
    const recomEl = document.getElementById('recomendaciones');
    recomEl.style.display = tieneCalificadas ? 'block' : 'none';

    if (tieneCalificadas) {
      document.getElementById('recomHacerYa').textContent    = estado.recomendaciones.hacer_ya    || '';
      document.getElementById('recomEstrategico').textContent = estado.recomendaciones.estrategico || '';
      document.getElementById('recomRutina').textContent      = estado.recomendaciones.rutina      || '';
      document.getElementById('recomDescarte').textContent    = estado.recomendaciones.descarte    || '';
    }
  }

  // ── Render: Matriz IGO en Canvas ──────────────────────────────────────────
  // Eje X = Gobernabilidad (1–10), Eje Y = Importancia (1–10).
  // Las líneas divisorias se trazan en los promedios (recalculados por el servidor).

  const COLORES_CU = {
    hacer_ya:    { fill: 'rgba(34,197,94,.15)',   stroke: '#22c55e' },
    estrategico: { fill: 'rgba(124,109,250,.15)', stroke: '#a78bfa' },
    rutina:      { fill: 'rgba(34,211,238,.12)',  stroke: '#22d3ee' },
    descarte:    { fill: 'rgba(100,116,139,.12)', stroke: '#94a3b8' },
  };

  // Mapea un valor en escala 1-10 a píxeles dentro del área de dibujo
  function escalar(val, min, max, pixMin, pixMax) {
    return pixMin + ((val - min) / (max - min)) * (pixMax - pixMin);
  }

  function renderMatriz() {
    const W = canvas.width;
    const H = canvas.height;

    // Márgenes del plano dentro del canvas
    const marL = 44, marR = 18, marT = 18, marB = 38;
    const areaW = W - marL - marR;
    const areaH = H - marT - marB;

    ctx.clearRect(0, 0, W, H);

    // ── Fondo del canvas ────────────────────────────────────────────────────
    ctx.fillStyle = '#13131c';
    ctx.fillRect(0, 0, W, H);

    // Posición en píxeles de las divisorias (promedios)
    const divX = marL + escalar(estado.promedioG, 1, 10, 0, areaW);
    const divY = marT + escalar(10 - estado.promedioI + 1, 1, 10, 0, areaH);
    // (invertimos Y porque canvas crece hacia abajo y el eje Y de IGO crece hacia arriba)

    // ── Cuadrantes de color ─────────────────────────────────────────────────
    const cuadrantesRect = [
      { key: 'estrategico', x: marL,  y: marT,  w: divX - marL,       h: divY - marT       },
      { key: 'hacer_ya',    x: divX,  y: marT,  w: marL + areaW - divX, h: divY - marT      },
      { key: 'descarte',    x: marL,  y: divY,  w: divX - marL,       h: marT + areaH - divY },
      { key: 'rutina',      x: divX,  y: divY,  w: marL + areaW - divX, h: marT + areaH - divY },
    ];
    cuadrantesRect.forEach(q => {
      ctx.fillStyle = COLORES_CU[q.key].fill;
      ctx.fillRect(q.x, q.y, q.w, q.h);
    });

    // ── Grilla sutil ────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    ctx.lineWidth   = 1;
    for (let v = 2; v <= 9; v++) {
      const px = marL + escalar(v, 1, 10, 0, areaW);
      const py = marT + escalar(10 - v + 1, 1, 10, 0, areaH);
      ctx.beginPath(); ctx.moveTo(px, marT); ctx.lineTo(px, marT + areaH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(marL, py); ctx.lineTo(marL + areaW, py); ctx.stroke();
    }

    // ── Líneas divisorias (promedios) ───────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(divX, marT); ctx.lineTo(divX, marT + areaH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(marL, divY); ctx.lineTo(marL + areaW, divY); ctx.stroke();
    ctx.setLineDash([]);

    // ── Borde del área ──────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(marL, marT, areaW, areaH);

    // ── Etiquetas de cuadrante ──────────────────────────────────────────────
    const etiquetasCu = [
      { key: 'estrategico', tx: marL + (divX - marL) / 2,           ty: marT + (divY - marT) / 2 },
      { key: 'hacer_ya',    tx: divX + (marL + areaW - divX) / 2,   ty: marT + (divY - marT) / 2 },
      { key: 'descarte',    tx: marL + (divX - marL) / 2,           ty: divY + (marT + areaH - divY) / 2 },
      { key: 'rutina',      tx: divX + (marL + areaW - divX) / 2,   ty: divY + (marT + areaH - divY) / 2 },
    ];
    ctx.font      = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    etiquetasCu.forEach(e => {
      ctx.fillStyle = COLORES_CU[e.key].stroke + 'cc';
      ctx.fillText((estado.etiquetas[e.key] || e.key).toUpperCase(), e.tx, e.ty);
    });

    // ── Ejes y ticks ────────────────────────────────────────────────────────
    ctx.fillStyle  = 'rgba(255,255,255,.4)';
    ctx.font       = '10px system-ui, sans-serif';
    ctx.textAlign  = 'right';
    [1, 3, 5, 7, 10].forEach(v => {
      const py = marT + escalar(10 - v + 1, 1, 10, 0, areaH);
      ctx.fillText(v, marL - 6, py + 4);
    });
    ctx.textAlign = 'center';
    [1, 3, 5, 7, 10].forEach(v => {
      const px = marL + escalar(v, 1, 10, 0, areaW);
      ctx.fillText(v, px, marT + areaH + 14);
    });

    // ── Labels de ejes ──────────────────────────────────────────────────────
    ctx.save();
    ctx.translate(12, marT + areaH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font      = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('IMPORTANCIA', 0, 0);
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font      = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GOBERNABILIDAD', marL + areaW / 2, H - 4);

    // ── Puntos de cada iniciativa ────────────────────────────────────────────
    const calificadas = estado.iniciativas.filter(i => i.importancia != null);

    const RADIO_PUNTO = 7;
    // PAD_PX: margen interno para que los puntos en valor 1 o 10 no queden
    // pegados al borde del area — siempre visibles dentro del plano.
    const PAD_PX = RADIO_PUNTO + 6;

    calificadas.forEach((ini, idx) => {
      // Escalamos con padding para que valor 10 no quede en el borde exacto
      const px = marL + escalar(Number(ini.gobernabilidad), 1, 10, PAD_PX, areaW - PAD_PX);
      const py = marT + escalar(10 - Number(ini.importancia) + 1, 1, 10, PAD_PX, areaH - PAD_PX);
      const col = ini.cuadrante ? COLORES_CU[ini.cuadrante].stroke : '#ffffff';

      // Halo
      ctx.beginPath();
      ctx.arc(px, py, RADIO_PUNTO + 4, 0, Math.PI * 2);
      ctx.fillStyle = col + '22';
      ctx.fill();

      // Círculo
      ctx.beginPath();
      ctx.arc(px, py, RADIO_PUNTO, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();

      // Número de orden dentro del punto
      ctx.fillStyle  = '#000';
      ctx.font       = 'bold 8px system-ui, sans-serif';
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(idx + 1, px, py);
      ctx.textBaseline = 'alphabetic';
    });

    // Leyenda de puntos (título corto) a la derecha
    if (calificadas.length > 0) {
      ctx.font      = '9px system-ui, sans-serif';
      ctx.textAlign = 'left';
      calificadas.forEach((ini, idx) => {
        const px = marL + escalar(Number(ini.gobernabilidad), 1, 10, PAD_PX, areaW - PAD_PX);
        const py = marT + escalar(10 - Number(ini.importancia) + 1, 1, 10, PAD_PX, areaH - PAD_PX);
        const col = ini.cuadrante ? COLORES_CU[ini.cuadrante].stroke : '#ffffff';

        // Etiqueta flotante solo si hay espacio (evita solapamiento)
        const label = `${idx + 1}. ${ini.titulo.substring(0, 18)}${ini.titulo.length > 18 ? '…' : ''}`;
        ctx.fillStyle = col + 'cc';
        ctx.fillText(label, px + RADIO_PUNTO + 4, py + 3);
      });
    }

    // Hint visual si no hay calificadas
    if (calificadas.length === 0) {
      ctx.fillStyle  = 'rgba(255,255,255,.15)';
      ctx.font       = '13px system-ui, sans-serif';
      ctx.textAlign  = 'center';
      ctx.fillText('Califica tus iniciativas para verlas aquí', marL + areaW / 2, marT + areaH / 2);
    }

    // Actualizar hint de texto
    const hintEl = document.getElementById('matrizHint');
    hintEl.textContent = calificadas.length > 0
      ? `Prom. I: ${estado.promedioI.toFixed(1)} · Prom. G: ${estado.promedioG.toFixed(1)}`
      : 'Califica iniciativas para verlas aquí';
  }

  // ── Modal: Nueva / Editar iniciativa ─────────────────────────────────────

  function abrirNueva() {
    modalIdEl.value       = '';
    inputTitulo.value     = '';
    inputDesc.value       = '';
    modalTituloEl.textContent = 'Nueva iniciativa';
    modalIni.style.display = 'flex';
    inputTitulo.focus();
  }

  window.abrirEditar = function (id) {
    const ini = estado.iniciativas.find(i => i.id === id);
    if (!ini) return;
    modalIdEl.value       = id;
    inputTitulo.value     = ini.titulo;
    inputDesc.value       = ini.descripcion || '';
    modalTituloEl.textContent = 'Editar iniciativa';
    modalIni.style.display = 'flex';
    inputTitulo.focus();
  };

  function cerrarModalIni() {
    modalIni.style.display = 'none';
  }

  async function guardarIniciativa() {
    const titulo     = inputTitulo.value.trim();
    const descripcion = inputDesc.value.trim();
    const id         = modalIdEl.value;

    if (!titulo) {
      inputTitulo.focus();
      return mostrarAlerta('error', 'El título es obligatorio');
    }

    try {
      if (id) {
        await api('PUT', `/api/iniciativas/${id}`, { titulo, descripcion });
        mostrarAlerta('ok', 'Iniciativa actualizada');
      } else {
        await api('POST', '/api/iniciativas', { titulo, descripcion });
        mostrarAlerta('ok', 'Iniciativa creada');
      }
      cerrarModalIni();
      await cargarIniciativas();
    } catch (err) {
      mostrarAlerta('error', err.message);
    }
  }

  // ── Modal: Calificar iniciativa ───────────────────────────────────────────

  window.abrirCalificar = function (id) {
    const ini = estado.iniciativas.find(i => i.id === id);
    if (!ini) return;
    calIdEl.value               = id;
    calTituloEl.textContent     = `Calificar: ${ini.titulo}`;
    sliderImp.value             = ini.importancia    || 5;
    sliderGob.value             = ini.gobernabilidad || 5;
    valImpEl.textContent        = sliderImp.value;
    valGobEl.textContent        = sliderGob.value;
    actualizarSliderBg(sliderImp);
    actualizarSliderBg(sliderGob);
    modalCal.style.display      = 'flex';
  };

  function cerrarModalCal() {
    modalCal.style.display = 'none';
  }

  async function guardarCalificacion() {
    const id           = calIdEl.value;
    const importancia  = sliderImp.value;
    const gobernabilidad = sliderGob.value;

    try {
      await api('PUT', `/api/iniciativas/${id}/calificar`, { importancia, gobernabilidad });
      mostrarAlerta('ok', 'Calificación guardada. Matriz actualizada.');
      cerrarModalCal();
      await cargarIniciativas();
    } catch (err) {
      mostrarAlerta('error', err.message);
    }
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  window.eliminar = async function (id) {
    const ini = estado.iniciativas.find(i => i.id === id);
    if (!confirm(`¿Eliminar "${ini?.titulo}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api('DELETE', `/api/iniciativas/${id}`);
      mostrarAlerta('ok', 'Iniciativa eliminada');
      await cargarIniciativas();
    } catch (err) {
      mostrarAlerta('error', err.message);
    }
  };

  // ── Sliders: fill y valor en tiempo real ──────────────────────────────────

  function actualizarSliderBg(slider) {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.backgroundSize = `${pct}% 100%`;
  }

  sliderImp.addEventListener('input', () => {
    valImpEl.textContent = sliderImp.value;
    actualizarSliderBg(sliderImp);
  });
  sliderGob.addEventListener('input', () => {
    valGobEl.textContent = sliderGob.value;
    actualizarSliderBg(sliderGob);
  });

  // ── Event listeners ───────────────────────────────────────────────────────

  document.getElementById('btnNuevaIniciativa').addEventListener('click', abrirNueva);
  document.getElementById('btnCerrarModal').addEventListener('click',     cerrarModalIni);
  document.getElementById('btnCancelarModal').addEventListener('click',   cerrarModalIni);
  document.getElementById('btnGuardarModal').addEventListener('click',    guardarIniciativa);

  document.getElementById('btnCerrarCalificar').addEventListener('click',   cerrarModalCal);
  document.getElementById('btnCancelarCalificar').addEventListener('click', cerrarModalCal);
  document.getElementById('btnGuardarCalificacion').addEventListener('click', guardarCalificacion);

  // Cerrar modales al hacer clic en el fondo
  document.getElementById('modalIniciativa').addEventListener('click', e => {
    if (e.target === modalIni) cerrarModalIni();
  });
  document.getElementById('modalCalificar').addEventListener('click', e => {
    if (e.target === modalCal) cerrarModalCal();
  });

  // Enter en el input de título = guardar
  inputTitulo.addEventListener('keydown', e => {
    if (e.key === 'Enter') guardarIniciativa();
  });

  // Nombre del usuario en el nav
  fetch('/api/sesion').then(r => r.json()).then(s => {
    document.getElementById('navUser').textContent        = s.nombre;
    document.getElementById('titleBienvenida').textContent = `Hola, ${s.nombre.split(' ')[0]} 👋`;
  });

  // ── Arranque ──────────────────────────────────────────────────────────────
  cargarIniciativas();

  // ── Resumen Ejecutivo IA ──────────────────────────────────────────────────

  const modalResumen    = document.getElementById('modalResumen');
  const resumenCargando = document.getElementById('resumenCargando');
  const resumenError    = document.getElementById('resumenError');
  const resumenContenido= document.getElementById('resumenContenido');
  const resumenTextoEl  = document.getElementById('resumenTexto');

  function abrirModalResumen() {
    modalResumen.style.display = 'flex';
    // Resetear estados
    resumenCargando.style.display  = 'none';
    resumenError.style.display     = 'none';
    resumenContenido.style.display = 'none';
    generarResumen();
  }

  function cerrarModalResumen() {
    modalResumen.style.display = 'none';
  }

  // Convierte **negrita** de Markdown a <strong> para mostrar en el div
  function renderMarkdownBasico(texto) {
    return texto
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{1,3}\s+(.+)$/gm, '<strong>$1</strong>');
  }

  async function generarResumen() {
    // Verificar que haya iniciativas calificadas antes de llamar a la API
    const calificadas = estado.iniciativas.filter(i => i.cuadrante);
    if (calificadas.length === 0) {
      resumenError.textContent  = 'Debes calificar al menos una iniciativa para generar el resumen.';
      resumenError.style.display = 'block';
      return;
    }

    resumenCargando.style.display  = 'flex';
    resumenError.style.display     = 'none';
    resumenContenido.style.display = 'none';

    try {
      const r = await fetch('/api/resumen', { method: 'POST' });
      const data = await r.json();

      if (!r.ok) {
        throw new Error(data.error || 'Error al generar el resumen');
      }

      // Mostrar el resumen con formato básico
      resumenTextoEl.innerHTML = renderMarkdownBasico(data.resumen);
      resumenCargando.style.display  = 'none';
      resumenContenido.style.display = 'block';

    } catch (err) {
      resumenCargando.style.display = 'none';
      resumenError.textContent      = err.message;
      resumenError.style.display    = 'block';
    }
  }

  // Copiar texto al portapapeles
  document.getElementById('btnCopiarResumen').addEventListener('click', () => {
    const texto = resumenTextoEl.innerText;
    navigator.clipboard.writeText(texto).then(() => {
      const btn = document.getElementById('btnCopiarResumen');
      btn.textContent = '✅ Copiado';
      setTimeout(() => { btn.textContent = '📋 Copiar texto'; }, 2000);
    });
  });

  document.getElementById('btnResumen').addEventListener('click',       abrirModalResumen);
  document.getElementById('btnCerrarResumen').addEventListener('click', cerrarModalResumen);
  modalResumen.addEventListener('click', e => {
    if (e.target === modalResumen) cerrarModalResumen();
  });


})();
