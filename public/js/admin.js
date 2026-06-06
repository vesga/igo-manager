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
