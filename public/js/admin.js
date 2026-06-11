// public/js/admin.js
// Panel administrativo: carga métricas y dibuja gráficas con Chart.js.

(function () {
  'use strict';

  // Paleta consistente con el tema oscuro de la app
  const COLORES = [
    '#7c6dfa','#22c55e','#22d3ee','#f59e0b',
    '#f43f5e','#a78bfa','#34d399','#fb923c',
  ];
  const CUADRANTES = {
    hacer_ya:    { label:'¡Hacer Ya!',  cls:'igc-hacer_ya'    },
    estrategico: { label:'Estratégico', cls:'igc-estrategico'  },
    rutina:      { label:'Rutina',      cls:'igc-rutina'       },
    descarte:    { label:'Descarte',    cls:'igc-descarte'     },
  };

  // Configuración global de Chart.js para tema oscuro
  Chart.defaults.color           = '#94a3b8';
  Chart.defaults.borderColor     = 'rgba(255,255,255,.06)';
  Chart.defaults.font.family     = 'system-ui, sans-serif';
  Chart.defaults.font.size       = 11;

  let graficas = {}; // guardar instancias para destruirlas al actualizar

  function crearGrafica(id, config) {
    if (graficas[id]) graficas[id].destroy();
    graficas[id] = new Chart(document.getElementById(id), config);
  }

  // ── Cargar y renderizar ───────────────────────────────────────────────────
  window.cargarMetricas = async function () {
    try {
      const r    = await fetch('/api/admin/metricas');
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);

      // KPIs
      document.getElementById('kpiUsuarios').textContent     = data.kpis.totalUsuarios;
      document.getElementById('kpiDiagnosticos').textContent = data.kpis.totalDiagnosticos;
      document.getElementById('kpiIniciativas').textContent  = data.kpis.totalIniciativas;

      // Gráfica 1: usuarios por sector (barras horizontales)
      crearGrafica('chartSector', {
        type: 'bar',
        data: {
          labels:   data.porSector.map(d => d.sector),
          datasets: [{
            label:           'Usuarios',
            data:            data.porSector.map(d => d.total),
            backgroundColor: COLORES,
            borderRadius:    6,
          }],
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color:'rgba(255,255,255,.04)' }, ticks: { precision:0 } },
            y: { grid: { display: false } },
          },
        },
      });

      // Gráfica 2: nuevos usuarios por mes (línea)
      crearGrafica('chartMes', {
        type: 'line',
        data: {
          labels:   data.porMes.map(d => d.mes),
          datasets: [{
            label:            'Nuevos usuarios',
            data:             data.porMes.map(d => d.total),
            borderColor:      '#7c6dfa',
            backgroundColor:  'rgba(124,109,250,.12)',
            pointBackgroundColor: '#7c6dfa',
            tension:          0.4,
            fill:             true,
          }],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color:'rgba(255,255,255,.04)' } },
            y: { grid: { color:'rgba(255,255,255,.04)' }, ticks: { precision:0 } },
          },
        },
      });

      // Gráfica 3: distribución por edad (dona)
      crearGrafica('chartEdad', {
        type: 'doughnut',
        data: {
          labels:   data.porEdad.map(d => d.rango_edad),
          datasets: [{
            data:             data.porEdad.map(d => d.total),
            backgroundColor: COLORES,
            borderWidth:      2,
            borderColor:      '#13131c',
          }],
        },
        options: {
          plugins: { legend: { position:'bottom', labels:{ boxWidth:10, padding:8 } } },
          cutout: '60%',
        },
      });

      // Gráfica 4: género (dona)
      crearGrafica('chartGenero', {
        type: 'doughnut',
        data: {
          labels:   data.porGenero.map(d => d.genero),
          datasets: [{
            data:            data.porGenero.map(d => d.total),
            backgroundColor: ['#7c6dfa','#22c55e','#22d3ee'],
            borderWidth:      2,
            borderColor:      '#13131c',
          }],
        },
        options: {
          plugins: { legend: { position:'bottom', labels:{ boxWidth:10, padding:8 } } },
          cutout: '60%',
        },
      });

      // Gráfica 5: tamaño de empresa (barras)
      crearGrafica('chartTamano', {
        type: 'bar',
        data: {
          labels:   data.porTamano.map(d => d.tamano),
          datasets: [{
            label:           'Empresas',
            data:            data.porTamano.map(d => d.total),
            backgroundColor: COLORES,
            borderRadius:    6,
          }],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color:'rgba(255,255,255,.04)' }, ticks: { precision:0 } },
          },
        },
      });

      // Matriz IGO global: tarjetas con conteo por cuadrante
      const totalCal = data.porCuadrante.reduce((s, d) => s + d.total, 0);
      const igoEl    = document.getElementById('igoGlobal');
      igoEl.innerHTML = Object.entries(CUADRANTES).map(([key, info]) => {
        const d     = data.porCuadrante.find(d => d.cuadrante === key);
        const count = d ? d.total : 0;
        const pct   = totalCal > 0 ? Math.round((count / totalCal) * 100) : 0;
        return `
          <div class="igo-global-card ${info.cls}">
            <div>
              <div class="igc-label">${info.label}</div>
              <div class="igc-sub">${pct}% del total</div>
            </div>
            <div class="igc-count">${count}</div>
          </div>`;
      }).join('');

    } catch (err) {
      console.error('Error cargando métricas:', err);
      alert('Error al cargar métricas: ' + err.message);
    }
  };

  // Nombre en el nav y carga inicial
  fetch('/api/sesion').then(r => r.json()).then(s => {
    document.getElementById('navUser').textContent = s.nombre;
  });

  cargarMetricas();

})();

// ── Solicitudes de pago premium ───────────────────────────────────────────────
let _rechazarId = null;

window.cargarSolicitudes = async function () {
  const cargandoEl = document.getElementById('solicitudesCargando');
  const vacioEl    = document.getElementById('solicitudesVacio');
  const listaEl    = document.getElementById('listaSolicitudes');

  cargandoEl.style.display = 'block';
  vacioEl.style.display    = 'none';
  listaEl.innerHTML        = '';

  try {
    const r    = await fetch('/api/admin/pagos');
    const data = await r.json();
    cargandoEl.style.display = 'none';

    if (!data.solicitudes || data.solicitudes.length === 0) {
      vacioEl.style.display = 'block';
      return;
    }

    const ESTADO_ESTILO = {
      pendiente: 'background:rgba(250,196,0,.12);color:#fac400;border:1px solid rgba(250,196,0,.3)',
      aprobada:  'background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.3)',
      rechazada: 'background:rgba(244,63,94,.1);color:#fb7185;border:1px solid rgba(244,63,94,.25)',
    };

    listaEl.innerHTML = data.solicitudes.map(s => {
      const fecha = new Date(s.creado_en).toLocaleDateString('es-CO', {
        day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
      });
      const estilo = ESTADO_ESTILO[s.estado] || '';
      const comp   = s.comprobante_url
        ? `<a href="${s.comprobante_url}" target="_blank"
             style="font-size:11px;color:var(--accent2);text-decoration:none;font-weight:700">
             Ver comprobante →
           </a>`
        : `<span style="font-size:11px;color:var(--dim)">Sin comprobante</span>`;

      const botones = s.estado === 'pendiente' ? `
        <button onclick="aprobarSolicitud(${s.id})"
          style="padding:5px 12px;font-size:11px;font-weight:700;border-radius:7px;
          border:1px solid rgba(34,197,94,.3);background:rgba(34,197,94,.1);
          color:#22c55e;cursor:pointer;margin-right:6px">
          Aprobar
        </button>
        <button onclick="abrirRechazar(${s.id})"
          style="padding:5px 12px;font-size:11px;font-weight:700;border-radius:7px;
          border:1px solid rgba(244,63,94,.25);background:rgba(244,63,94,.08);
          color:#fb7185;cursor:pointer">
          Rechazar
        </button>` : (s.codigo_enviado
          ? `<span style="font-size:11px;color:var(--muted)">Código: <strong>${s.codigo_enviado}</strong></span>`
          : '');

      return `
        <div style="background:var(--surface2);border:1px solid var(--border);
          border-radius:12px;padding:1rem 1.25rem;margin-bottom:.75rem">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:.5rem">
            <div>
              <div style="font-size:.875rem;font-weight:800;color:var(--text)">${s.nombre}</div>
              <div style="font-size:11px;color:var(--muted)">${s.correo} · ${s.metodo_pago} · ${fecha}</div>
            </div>
            <span style="font-size:9px;font-weight:900;letter-spacing:.5px;text-transform:uppercase;
              padding:3px 9px;border-radius:20px;white-space:nowrap;${estilo}">
              ${s.estado}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            ${comp}
            ${botones}
          </div>
        </div>`;
    }).join('');

  } catch (err) {
    cargandoEl.style.display = 'none';
    console.error('Error cargando solicitudes:', err);
  }
};

window.aprobarSolicitud = async function (id) {
  if (!confirm('¿Aprobar esta solicitud? Se generará el código y se enviará por correo.')) return;
  try {
    const r    = await fetch(`/api/admin/pagos/${id}/aprobar`, { method: 'POST' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    alert(`Aprobado. Código generado: ${data.codigo}`);
    cargarSolicitudes();
    cargarMetricas();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.abrirRechazar = function (id) {
  _rechazarId = id;
  document.getElementById('notasRechazo').value = '';
  document.getElementById('modalRechazar').style.display = 'flex';
};

document.getElementById('btnConfirmarRechazo').addEventListener('click', async () => {
  if (!_rechazarId) return;
  const notas = document.getElementById('notasRechazo').value.trim();
  try {
    const r = await fetch(`/api/admin/pagos/${_rechazarId}/rechazar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notas }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    document.getElementById('modalRechazar').style.display = 'none';
    cargarSolicitudes();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

// Cargar solicitudes al abrir el panel
cargarSolicitudes();
