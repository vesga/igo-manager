// public/js/dashboard.js
// Dashboard principal: gestión de temas, iniciativas, calificación y matriz IGO.

(function () {
  'use strict';

  const COLORES_SWATCH = [
    '#7c6dfa','#22c55e','#22d3ee','#f59e0b',
    '#f43f5e','#a78bfa','#34d399','#fb923c',
    '#e879f9','#38bdf8',
  ];

  let estado = {
    temas:[], iniciativas:[], promedioI:5, promedioG:5,
    recomendaciones:{}, etiquetas:{},
  };

  const canvas = document.getElementById('canvasIGO');
  const ctx    = canvas.getContext('2d');
  const alertError   = document.getElementById('alertError');
  const alertSuccess = document.getElementById('alertSuccess');

  function mostrarAlerta(tipo, msg) {
    const el   = tipo==='error' ? alertError : alertSuccess;
    const otro = tipo==='error' ? alertSuccess : alertError;
    otro.style.display='none'; el.textContent=msg; el.style.display='block';
    setTimeout(()=>el.style.display='none', 4000);
  }

  async function api(method, url, body) {
    const opts={method,headers:{'Content-Type':'application/json'}};
    if(body) opts.body=JSON.stringify(body);
    const r=await fetch(url,opts); const data=await r.json();
    if(!r.ok) throw new Error(data.error||'Error en la petición');
    return data;
  }

  function escHtml(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Confirmación modal ────────────────────────────────────────────────────
  let _cb=null;
  function mostrarConfirmar(titulo,msg,fn) {
    document.getElementById('confirmarTituloEl').textContent=titulo;
    document.getElementById('confirmarMensaje').textContent=msg;
    _cb=fn; document.getElementById('modalConfirmar').style.display='flex';
  }
  document.getElementById('btnCancelarConfirmar').onclick=()=>{document.getElementById('modalConfirmar').style.display='none';_cb=null;};
  document.getElementById('btnAceptarConfirmar').onclick=()=>{document.getElementById('modalConfirmar').style.display='none';if(_cb)_cb();_cb=null;};
  document.getElementById('modalConfirmar').onclick=e=>{if(e.target===document.getElementById('modalConfirmar')){document.getElementById('modalConfirmar').style.display='none';_cb=null;}};

  // ── Cargar todo ───────────────────────────────────────────────────────────
  async function cargarTodo() {
    try {
      const [dt,di]=await Promise.all([api('GET','/api/temas'),api('GET','/api/iniciativas')]);
      estado.temas=dt.temas; estado.iniciativas=di.iniciativas;
      estado.promedioI=di.promedioI; estado.promedioG=di.promedioG;
      estado.recomendaciones=di.recomendaciones; estado.etiquetas=di.etiquetas;
      renderTemas(); renderMatriz(); renderRecomendaciones(); llenarSelectTemas();
    } catch(err){mostrarAlerta('error',err.message);}
  }

  // ── Render temas ──────────────────────────────────────────────────────────
  function renderTemas() {
    const listaTemas=document.getElementById('listaTemas');
    const emptyEl=document.getElementById('emptyState');
    if(estado.temas.length===0){emptyEl.style.display='block';listaTemas.innerHTML='';return;}
    emptyEl.style.display='none';
    listaTemas.innerHTML=estado.temas.map(tema=>{
      const inis=estado.iniciativas.filter(i=>i.tema_id===tema.id);
      const tarjetas=inis.length===0
        ?`<p style="font-size:12px;color:var(--dim);padding:.5rem .25rem">Sin iniciativas aún.</p>`
        :inis.map(ini=>tarjetaIniciativa(ini)).join('');
      return `<div class="tema-seccion" data-tema-id="${tema.id}">
        <div class="tema-header">
          <div class="tema-dot" style="background:${tema.color}"></div>
          <span class="tema-nombre">${escHtml(tema.nombre)}</span>
          <span class="tema-count">${inis.length} iniciativa${inis.length!==1?'s':''}</span>
          <div class="tema-actions">
            <button class="btn-tema" onclick="editarTema(${tema.id})">Editar</button>
            <button class="btn-tema btn-tema-del" onclick="eliminarTema(${tema.id})">Eliminar</button>
          </div>
        </div>
        ${tarjetas}
        <button class="btn-tema-add" onclick="abrirNuevaIniciativa(${tema.id})">+ Agregar iniciativa a este tema</button>
      </div>`;
    }).join('');
  }

  function tarjetaIniciativa(ini) {
    const cuad=ini.cuadrante; const etiq=cuad?(estado.etiquetas[cuad]||cuad):null;
    const pillCls=cuad?`pill-${cuad}`:'pill-sin'; const pillTxt=etiq||'Sin calificar';
    const scoreHtml=ini.importancia!=null
      ?`<div class="card-scores"><div class="score-chip">Imp <strong>${ini.importancia}</strong>/10</div><div class="score-chip">Gob <strong>${ini.gobernabilidad}</strong>/10</div></div>`
      :`<div class="card-scores"><span class="score-none">Sin calificación</span></div>`;
    const desc=ini.descripcion?`<p class="card-desc">${escHtml(ini.descripcion)}</p>`:'';
    return `<div class="iniciativa-card" data-id="${ini.id}">
      <div class="card-top"><span class="card-titulo">${escHtml(ini.titulo)}</span><span class="cuadrante-pill ${pillCls}">${pillTxt}</span></div>
      ${desc}${scoreHtml}
      <div class="card-actions">
        <button class="btn-card btn-card-calificar" onclick="abrirCalificar(${ini.id})">Calificar</button>
        <button class="btn-card btn-card-edit" onclick="abrirEditar(${ini.id})">Editar</button>
        <button class="btn-card btn-card-del" onclick="eliminarIniciativa(${ini.id})">Eliminar</button>
      </div>
    </div>`;
  }

  function llenarSelectTemas() {
    const sel=document.getElementById('selectTemaIniciativa');
    sel.innerHTML='<option value="">Selecciona un tema...</option>'+
      estado.temas.map(t=>`<option value="${t.id}">${escHtml(t.nombre)}</option>`).join('');
  }

  function renderRecomendaciones() {
    const tiene=estado.iniciativas.some(i=>i.cuadrante);
    document.getElementById('recomendaciones').style.display=tiene?'block':'none';
    if(tiene){
      document.getElementById('recomHacerYa').textContent=estado.recomendaciones.hacer_ya||'';
      document.getElementById('recomEstrategico').textContent=estado.recomendaciones.estrategico||'';
      document.getElementById('recomRutina').textContent=estado.recomendaciones.rutina||'';
      document.getElementById('recomDescarte').textContent=estado.recomendaciones.descarte||'';
    }
  }

  // ── Matriz IGO ────────────────────────────────────────────────────────────
  const COLORES_CU={
    hacer_ya:{fill:'rgba(34,197,94,.15)',stroke:'#22c55e'},
    estrategico:{fill:'rgba(124,109,250,.15)',stroke:'#a78bfa'},
    rutina:{fill:'rgba(34,211,238,.12)',stroke:'#22d3ee'},
    descarte:{fill:'rgba(100,116,139,.12)',stroke:'#94a3b8'},
  };
  const ETIQ_MAT={hacer_ya:'Hacer Ya',estrategico:'Estratégico',rutina:'Rutina',descarte:'Descarte'};

  function esc(val,min,max,pMin,pMax){return pMin+((val-min)/(max-min))*(pMax-pMin);}

  function dibujarMatrizEnCanvas(cvs,ctx2,est,W,H) {
    const marL=44,marR=18,marT=18,marB=38,PAD=13;
    const areaW=W-marL-marR, areaH=H-marT-marB;
    ctx2.clearRect(0,0,W,H); ctx2.fillStyle='#13131c'; ctx2.fillRect(0,0,W,H);
    const divX=marL+esc(Math.min(9,Math.max(2,est.promedioG)),1,10,0,areaW);
    const divY=marT+esc(10-Math.min(9,Math.max(2,est.promedioI))+1,1,10,0,areaH);
    const cuads=[
      {key:'estrategico',x:marL,y:marT,w:divX-marL,h:divY-marT},
      {key:'hacer_ya',x:divX,y:marT,w:marL+areaW-divX,h:divY-marT},
      {key:'descarte',x:marL,y:divY,w:divX-marL,h:marT+areaH-divY},
      {key:'rutina',x:divX,y:divY,w:marL+areaW-divX,h:marT+areaH-divY},
    ];
    cuads.forEach(q=>{ctx2.fillStyle=COLORES_CU[q.key].fill;ctx2.fillRect(q.x,q.y,q.w,q.h);});
    ctx2.strokeStyle='rgba(255,255,255,.04)';ctx2.lineWidth=1;
    for(let v=2;v<=9;v++){
      const px=marL+esc(v,1,10,0,areaW),py=marT+esc(10-v+1,1,10,0,areaH);
      ctx2.beginPath();ctx2.moveTo(px,marT);ctx2.lineTo(px,marT+areaH);ctx2.stroke();
      ctx2.beginPath();ctx2.moveTo(marL,py);ctx2.lineTo(marL+areaW,py);ctx2.stroke();
    }
    ctx2.strokeStyle='rgba(255,255,255,.25)';ctx2.lineWidth=1.5;ctx2.setLineDash([6,4]);
    ctx2.beginPath();ctx2.moveTo(divX,marT);ctx2.lineTo(divX,marT+areaH);ctx2.stroke();
    ctx2.beginPath();ctx2.moveTo(marL,divY);ctx2.lineTo(marL+areaW,divY);ctx2.stroke();
    ctx2.setLineDash([]);
    ctx2.strokeStyle='rgba(255,255,255,.1)';ctx2.lineWidth=1;ctx2.strokeRect(marL,marT,areaW,areaH);
    ctx2.font='bold 9px system-ui,sans-serif';ctx2.textAlign='center';
    cuads.forEach(q=>{ctx2.fillStyle=COLORES_CU[q.key].stroke+'cc';ctx2.fillText(ETIQ_MAT[q.key].toUpperCase(),q.x+q.w/2,q.y+q.h/2);});
    ctx2.fillStyle='rgba(255,255,255,.4)';ctx2.font='10px system-ui,sans-serif';
    ctx2.textAlign='right';
    [1,3,5,7,10].forEach(v=>{const py=marT+esc(10-v+1,1,10,0,areaH);ctx2.fillText(v,marL-6,py+4);});
    ctx2.textAlign='center';
    [1,3,5,7,10].forEach(v=>{const px=marL+esc(v,1,10,0,areaW);ctx2.fillText(v,px,marT+areaH+14);});
    ctx2.save();ctx2.translate(12,marT+areaH/2);ctx2.rotate(-Math.PI/2);
    ctx2.fillStyle='rgba(255,255,255,.5)';ctx2.font='bold 10px system-ui,sans-serif';ctx2.textAlign='center';
    ctx2.fillText('IMPORTANCIA',0,0);ctx2.restore();
    ctx2.fillStyle='rgba(255,255,255,.5)';ctx2.font='bold 10px system-ui,sans-serif';ctx2.textAlign='center';
    ctx2.fillText('GOBERNABILIDAD',marL+areaW/2,H-4);
    const calif=est.iniciativas.filter(i=>i.importancia!=null),R=7;
    calif.forEach((ini,idx)=>{
      const px=marL+esc(Number(ini.gobernabilidad),1,10,PAD,areaW-PAD);
      const py=marT+esc(10-Number(ini.importancia)+1,1,10,PAD,areaH-PAD);
      const tema=est.temas?est.temas.find(t=>t.id===ini.tema_id):null;
      const col=tema?tema.color:(ini.cuadrante?COLORES_CU[ini.cuadrante].stroke:'#ffffff');
      ctx2.beginPath();ctx2.arc(px,py,R+4,0,Math.PI*2);ctx2.fillStyle=col+'22';ctx2.fill();
      ctx2.beginPath();ctx2.arc(px,py,R,0,Math.PI*2);ctx2.fillStyle=col;ctx2.fill();
      ctx2.fillStyle='#000';ctx2.font='bold 8px system-ui,sans-serif';
      ctx2.textAlign='center';ctx2.textBaseline='middle';ctx2.fillText(idx+1,px,py);ctx2.textBaseline='alphabetic';
      ctx2.font='9px system-ui,sans-serif';ctx2.fillStyle=col+'cc';ctx2.textAlign='left';
      ctx2.fillText(`${idx+1}. ${ini.titulo.substring(0,18)}${ini.titulo.length>18?'…':''}`,px+R+4,py+3);
    });
    if(calif.length===0){ctx2.fillStyle='rgba(255,255,255,.15)';ctx2.font='13px system-ui,sans-serif';ctx2.textAlign='center';ctx2.fillText('Califica tus iniciativas para verlas aquí',marL+areaW/2,marT+areaH/2);}
    const h=document.getElementById('matrizHint');
    if(h)h.textContent=calif.length>0?`Prom. I: ${est.promedioI.toFixed(1)} · Prom. G: ${est.promedioG.toFixed(1)}`:'Califica iniciativas para verlas aquí';
  }

  function renderMatriz(){dibujarMatrizEnCanvas(canvas,ctx,estado,canvas.width,canvas.height);}

  // ── Modal TEMA ────────────────────────────────────────────────────────────
  const modalTema=document.getElementById('modalTema');
  const inputTemaNombre=document.getElementById('inputTemaNombre');
  const inputTemaDesc=document.getElementById('inputTemaDesc');
  const inputTemaColor=document.getElementById('inputTemaColor');
  const modalIdTema=document.getElementById('modalIdTema');

  function buildColorPicker(){
    document.getElementById('colorPicker').innerHTML=COLORES_SWATCH.map(c=>
      `<div class="color-swatch ${c===inputTemaColor.value?'selected':''}" style="background:${c}" data-color="${c}" onclick="seleccionarColor('${c}')"></div>`
    ).join('');
  }
  window.seleccionarColor=function(c){
    inputTemaColor.value=c;
    document.querySelectorAll('.color-swatch').forEach(s=>s.classList.toggle('selected',s.dataset.color===c));
  };

  function abrirNuevoTema(){
    modalIdTema.value='';inputTemaNombre.value='';inputTemaDesc.value='';
    inputTemaColor.value=COLORES_SWATCH[estado.temas.length%COLORES_SWATCH.length];
    document.getElementById('modalTemaTitulo').textContent='Nuevo tema';
    buildColorPicker();modalTema.style.display='flex';inputTemaNombre.focus();
  }
  window.editarTema=function(id){
    const t=estado.temas.find(t=>t.id===id);if(!t)return;
    modalIdTema.value=id;inputTemaNombre.value=t.nombre;inputTemaDesc.value=t.descripcion||'';
    inputTemaColor.value=t.color;document.getElementById('modalTemaTitulo').textContent='Editar tema';
    buildColorPicker();modalTema.style.display='flex';
  };
  function cerrarModalTema(){modalTema.style.display='none';}
  async function guardarTema(){
    const id=modalIdTema.value,nombre=inputTemaNombre.value.trim();
    if(!nombre)return mostrarAlerta('error','El nombre del tema es obligatorio');
    try{
      id?await api('PUT',`/api/temas/${id}`,{nombre,descripcion:inputTemaDesc.value.trim(),color:inputTemaColor.value})
        :await api('POST','/api/temas',{nombre,descripcion:inputTemaDesc.value.trim(),color:inputTemaColor.value});
      mostrarAlerta('ok',id?'Tema actualizado':'Tema creado');cerrarModalTema();await cargarTodo();
    }catch(err){mostrarAlerta('error',err.message);}
  }
  window.eliminarTema=function(id){
    const t=estado.temas.find(t=>t.id===id);
    mostrarConfirmar('Eliminar tema',`¿Eliminar "${t?.nombre}"? Solo si no tiene iniciativas.`,async()=>{
      try{await api('DELETE',`/api/temas/${id}`);mostrarAlerta('ok','Tema eliminado');await cargarTodo();}
      catch(err){mostrarAlerta('error',err.message);}
    });
  };
  document.getElementById('btnNuevaTema').onclick=abrirNuevoTema;
  document.getElementById('btnCerrarModalTema').onclick=cerrarModalTema;
  document.getElementById('btnCancelarModalTema').onclick=cerrarModalTema;
  document.getElementById('btnGuardarTema').onclick=guardarTema;
  modalTema.onclick=e=>{if(e.target===modalTema)cerrarModalTema();};
  inputTemaNombre.onkeydown=e=>{if(e.key==='Enter')guardarTema();};

  // ── Modal INICIATIVA ──────────────────────────────────────────────────────
  const modalIni=document.getElementById('modalIniciativa');
  const selectTemaIni=document.getElementById('selectTemaIniciativa');
  const inputTitulo=document.getElementById('inputTitulo');
  const inputDescEl=document.getElementById('inputDescripcion');
  const modalIdEl=document.getElementById('modalIdIniciativa');

  window.abrirNuevaIniciativa=function(temaId){
    modalIdEl.value='';inputTitulo.value='';inputDescEl.value='';
    selectTemaIni.value=temaId||'';selectTemaIni.disabled=!!temaId;
    document.getElementById('modalTitulo').textContent='Nueva iniciativa';
    modalIni.style.display='flex';inputTitulo.focus();
  };
  window.abrirEditar=function(id){
    const ini=estado.iniciativas.find(i=>i.id===id);if(!ini)return;
    modalIdEl.value=id;selectTemaIni.value=ini.tema_id||'';selectTemaIni.disabled=false;
    inputTitulo.value=ini.titulo;inputDescEl.value=ini.descripcion||'';
    document.getElementById('modalTitulo').textContent='Editar iniciativa';
    modalIni.style.display='flex';inputTitulo.focus();
  };
  function cerrarModalIni(){modalIni.style.display='none';selectTemaIni.disabled=false;}
  async function guardarIniciativa(){
    const id=modalIdEl.value,titulo=inputTitulo.value.trim(),descripcion=inputDescEl.value.trim(),tema_id=selectTemaIni.value;
    if(!titulo)return mostrarAlerta('error','El título es obligatorio');
    if(!tema_id)return mostrarAlerta('error','Selecciona un tema');
    try{
      id?await api('PUT',`/api/iniciativas/${id}`,{titulo,descripcion,tema_id})
        :await api('POST','/api/iniciativas',{titulo,descripcion,tema_id});
      mostrarAlerta('ok',id?'Iniciativa actualizada':'Iniciativa creada');cerrarModalIni();await cargarTodo();
    }catch(err){mostrarAlerta('error',err.message);}
  }
  window.eliminarIniciativa=function(id){
    const ini=estado.iniciativas.find(i=>i.id===id);
    mostrarConfirmar('Eliminar iniciativa',`¿Eliminar "${ini?.titulo}"? No se puede deshacer.`,async()=>{
      try{await api('DELETE',`/api/iniciativas/${id}`);mostrarAlerta('ok','Iniciativa eliminada');await cargarTodo();}
      catch(err){mostrarAlerta('error',err.message);}
    });
  };
  document.getElementById('btnNuevaIniciativa').onclick=()=>window.abrirNuevaIniciativa(null);
  document.getElementById('btnCerrarModal').onclick=cerrarModalIni;
  document.getElementById('btnCancelarModal').onclick=cerrarModalIni;
  document.getElementById('btnGuardarModal').onclick=guardarIniciativa;
  modalIni.onclick=e=>{if(e.target===modalIni)cerrarModalIni();};
  inputTitulo.onkeydown=e=>{if(e.key==='Enter')guardarIniciativa();};

  // ── Modal CALIFICAR ───────────────────────────────────────────────────────
  const modalCal=document.getElementById('modalCalificar');
  const calIdEl=document.getElementById('calificarId');
  const sliderImp=document.getElementById('sliderImportancia');
  const sliderGob=document.getElementById('sliderGobernabilidad');
  const valImpEl=document.getElementById('valImportancia');
  const valGobEl=document.getElementById('valGobernabilidad');

  function actualizarSliderBg(s){const p=((s.value-s.min)/(s.max-s.min))*100;s.style.backgroundSize=`${p}% 100%`;}
  sliderImp.oninput=()=>{valImpEl.textContent=sliderImp.value;actualizarSliderBg(sliderImp);};
  sliderGob.oninput=()=>{valGobEl.textContent=sliderGob.value;actualizarSliderBg(sliderGob);};

  window.abrirCalificar=function(id){
    const ini=estado.iniciativas.find(i=>i.id===id);if(!ini)return;
    calIdEl.value=id;document.getElementById('calificarTitulo').textContent=`Calificar: ${ini.titulo}`;
    sliderImp.value=ini.importancia||5;sliderGob.value=ini.gobernabilidad||5;
    valImpEl.textContent=sliderImp.value;valGobEl.textContent=sliderGob.value;
    actualizarSliderBg(sliderImp);actualizarSliderBg(sliderGob);modalCal.style.display='flex';
  };
  function cerrarModalCal(){modalCal.style.display='none';}
  async function guardarCalificacion(){
    try{
      await api('PUT',`/api/iniciativas/${calIdEl.value}/calificar`,{importancia:sliderImp.value,gobernabilidad:sliderGob.value});
      mostrarAlerta('ok','Calificación guardada');cerrarModalCal();await cargarTodo();
    }catch(err){mostrarAlerta('error',err.message);}
  }
  document.getElementById('btnCerrarCalificar').onclick=cerrarModalCal;
  document.getElementById('btnCancelarCalificar').onclick=cerrarModalCal;
  document.getElementById('btnGuardarCalificacion').onclick=guardarCalificacion;
  modalCal.onclick=e=>{if(e.target===modalCal)cerrarModalCal();};

  // ── Premium ───────────────────────────────────────────────────────────────
  let usuarioEsPremium=false;
  async function verificarPremium(){
    try{const r=await fetch('/api/premium/estado');const d=await r.json();usuarioEsPremium=d.esPremium;
      const btn=document.getElementById('btnResumen'),lock=document.getElementById('lockIcon');
      if(usuarioEsPremium){btn.classList.add('desbloqueado');lock.textContent='·';}
    }catch(_){}
  }
  const modalPremium=document.getElementById('modalPremium');
  const inputCodigo=document.getElementById('inputCodigo');
  function abrirModalPremium(){inputCodigo.value='';document.getElementById('premiumError').style.display='none';document.getElementById('premiumSuccess').style.display='none';modalPremium.style.display='flex';setTimeout(()=>inputCodigo.focus(),100);}
  function cerrarModalPremium(){modalPremium.style.display='none';}
  async function activarPremium(){
    const codigo=inputCodigo.value.trim();if(!codigo)return;
    const btn=document.getElementById('btnActivarPremium');btn.textContent='Verificando...';btn.disabled=true;
    document.getElementById('premiumError').style.display='none';
    try{
      await api('POST','/api/premium/activar',{codigo});
      document.getElementById('premiumSuccess').textContent='¡Acceso activado!';document.getElementById('premiumSuccess').style.display='block';
      usuarioEsPremium=true;document.getElementById('btnResumen').classList.add('desbloqueado');document.getElementById('lockIcon').textContent='·';
      setTimeout(()=>{cerrarModalPremium();abrirModalResumen();},1400);
    }catch(err){document.getElementById('premiumError').textContent=err.message;document.getElementById('premiumError').style.display='block';}
    finally{btn.textContent='Activar acceso →';btn.disabled=false;}
  }
  document.getElementById('btnResumen').onclick=()=>usuarioEsPremium?abrirModalResumen():abrirModalPremium();
  document.getElementById('btnCerrarPremiumModal').onclick=cerrarModalPremium;
  document.getElementById('btnCancelarPremium').onclick=cerrarModalPremium;
  document.getElementById('btnActivarPremium').onclick=activarPremium;
  modalPremium.onclick=e=>{if(e.target===modalPremium)cerrarModalPremium();};
  inputCodigo.oninput=()=>{inputCodigo.value=inputCodigo.value.toUpperCase();};
  inputCodigo.onkeydown=e=>{if(e.key==='Enter')activarPremium();};

  // ── Resumen ejecutivo ─────────────────────────────────────────────────────
  const modalResumen=document.getElementById('modalResumen');
  const resumenCargando=document.getElementById('resumenCargando');
  const resumenError=document.getElementById('resumenError');
  const resumenContenido=document.getElementById('resumenContenido');
  const resumenTextoEl=document.getElementById('resumenTexto');

  function abrirModalResumen(){modalResumen.style.display='flex';resumenCargando.style.display='none';resumenError.style.display='none';resumenContenido.style.display='none';generarResumen();}
  function cerrarModalResumen(){modalResumen.style.display='none';}
  function renderMd(t){return t.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/^#{1,3}\s+(.+)$/gm,'<strong>$1</strong>');}
  async function generarResumen(){
    const calif=estado.iniciativas.filter(i=>i.cuadrante);
    if(calif.length===0){resumenError.textContent='Debes calificar al menos una iniciativa.';resumenError.style.display='block';return;}
    resumenCargando.style.display='flex';resumenError.style.display='none';resumenContenido.style.display='none';
    try{const r=await fetch('/api/resumen',{method:'POST'});const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Error');
      resumenTextoEl.innerHTML=renderMd(data.resumen);resumenCargando.style.display='none';resumenContenido.style.display='block';
    }catch(err){resumenCargando.style.display='none';resumenError.textContent=err.message;resumenError.style.display='block';}
  }
  document.getElementById('btnCopiarResumen').onclick=()=>{
    navigator.clipboard.writeText(resumenTextoEl.innerText).then(()=>{const b=document.getElementById('btnCopiarResumen');b.textContent='Copiado';setTimeout(()=>b.textContent='Copiar texto',2000);});
  };
  document.getElementById('btnDescargarPDF').onclick=()=>{
    const btn=document.getElementById('btnDescargarPDF'),texto=resumenTextoEl.innerText;
    if(!texto)return;btn.textContent='Generando...';btn.disabled=true;
    try{
      const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
      const mI=20,aU=170;let cY=20;
      doc.setFillColor(18,18,28);doc.rect(0,0,210,35,'F');
      doc.setTextColor(167,139,250);doc.setFontSize(18);doc.setFont('helvetica','bold');doc.text('IGO Manager',mI,18);
      doc.setTextColor(148,163,184);doc.setFontSize(8);doc.setFont('helvetica','normal');
      doc.text('Dinámica del Oriente S.A.S. · Resumen Ejecutivo',mI,26);
      doc.text(new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'}),190,26,{align:'right'});
      cY=45;doc.setTextColor(30,30,30);doc.setFontSize(14);doc.setFont('helvetica','bold');
      doc.text('Resumen Ejecutivo del Diagnóstico IGO',mI,cY);cY+=8;
      doc.setDrawColor(220,220,220);doc.setLineWidth(0.4);doc.line(mI,cY,190,cY);cY+=8;
      doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(50,50,50);
      doc.splitTextToSize(texto,aU).forEach(l=>{
        if(cY>270){doc.addPage();cY=20;}
        if(!l.trim()){cY+=4;return;}
        if(/^\d+\./.test(l.trim())){doc.setFont('helvetica','bold');doc.setTextColor(80,60,180);doc.text(l,mI,cY);doc.setFont('helvetica','normal');doc.setTextColor(50,50,50);}
        else doc.text(l,mI,cY);
        cY+=6;
      });
      const tot=doc.getNumberOfPages();
      for(let i=1;i<=tot;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(160,160,160);doc.text(`IGO Manager · Dinámica del Oriente S.A.S. · Página ${i} de ${tot}`,105,290,{align:'center'});}
      doc.save(`Resumen_IGO_${new Date().toISOString().split('T')[0]}.pdf`);
    }catch(err){console.error(err);}
    finally{btn.textContent='Descargar PDF';btn.disabled=false;}
  };
  document.getElementById('btnCerrarResumen').onclick=cerrarModalResumen;
  modalResumen.onclick=e=>{if(e.target===modalResumen)cerrarModalResumen();};

  // ── Exportar PNG ──────────────────────────────────────────────────────────
  document.getElementById('btnExportarPNG').onclick=()=>{
    const tmp=document.createElement('canvas'),e=2;
    tmp.width=canvas.width*e;tmp.height=canvas.height*e;
    const tc=tmp.getContext('2d');tc.scale(e,e);tc.drawImage(canvas,0,0);
    tc.scale(1/e,1/e);tc.fillStyle='rgba(255,255,255,.2)';tc.font='bold 14px system-ui';
    tc.textAlign='right';tc.fillText('IGO Manager · Dinámica del Oriente',tmp.width-16,tmp.height-12);
    const l=document.createElement('a');l.download=`Matriz_IGO_${new Date().toISOString().split('T')[0]}.png`;l.href=tmp.toDataURL('image/png');l.click();
  };

  // ── Modo presentación ─────────────────────────────────────────────────────
  const overlayPresent=document.getElementById('overlayPresentacion');
  const canvasPresent=document.getElementById('canvasPresentacion');
  async function abrirPresentacion(){
    const W=Math.min(window.innerWidth*.9,1100),H=Math.min(window.innerHeight*.72,700);
    canvasPresent.width=W;canvasPresent.height=H;
    document.getElementById('presentFecha').textContent=new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});
    try{const p=await fetch('/app/perfil/datos').then(r=>r.json());document.getElementById('presentEmpresa').textContent=p.empresa?.nombre||'Mi empresa';}catch(_){}
    dibujarMatrizEnCanvas(canvasPresent,canvasPresent.getContext('2d'),estado,W,H);
    overlayPresent.style.display='flex';
    if(overlayPresent.requestFullscreen)overlayPresent.requestFullscreen().catch(()=>{});
  }
  function cerrarPresentacion(){overlayPresent.style.display='none';if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}
  document.getElementById('btnPresentacion').onclick=abrirPresentacion;
  document.getElementById('btnCerrarPresentacion').onclick=cerrarPresentacion;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlayPresent.style.display==='flex')cerrarPresentacion();});

  // ── Historial ─────────────────────────────────────────────────────────────
  const modalHistorial=document.getElementById('modalHistorial');
  function abrirHistorial(){modalHistorial.style.display='flex';document.getElementById('historialDetalle').style.display='none';document.getElementById('listaHistorial').style.display='block';document.getElementById('historialVacio').style.display='none';cargarHistorial();}
  function cerrarHistorial(){modalHistorial.style.display='none';}
  async function cargarHistorial(){
    const cEl=document.getElementById('historialCargando'),vEl=document.getElementById('historialVacio'),lEl=document.getElementById('listaHistorial');
    cEl.style.display='block';lEl.innerHTML='';
    try{
      const data=await api('GET','/api/historial');cEl.style.display='none';
      if(!data.historial||data.historial.length===0){vEl.style.display='block';return;}
      lEl.innerHTML=data.historial.map(h=>{
        const f=new Date(h.creado_en).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
        return `<div class="historial-card" onclick="verDetalleHistorial(${h.id},'${f}')">
          <div><div class="historial-fecha">${f}</div>
          <div class="historial-meta">Prom. I: ${Number(h.promedio_i).toFixed(1)} · Prom. G: ${Number(h.promedio_g).toFixed(1)} · ${h.total_iniciativas} iniciativa${h.total_iniciativas!==1?'s':''}</div></div>
          <span class="historial-badge">Ver matriz →</span></div>`;
      }).join('');
    }catch(err){cEl.style.display='none';mostrarAlerta('error','Error al cargar el historial');}
  }
  window.verDetalleHistorial=async function(id,fl){
    document.getElementById('listaHistorial').style.display='none';
    document.getElementById('historialCargando').style.display='block';
    document.getElementById('historialDetalle').style.display='none';
    try{
      const data=await api('GET',`/api/historial/${id}`);
      document.getElementById('historialCargando').style.display='none';
      document.getElementById('historialDetalle').style.display='block';
      document.getElementById('historialDetalletitulo').textContent=fl;
      const cvs=document.getElementById('canvasHistorial');
      dibujarMatrizEnCanvas(cvs,cvs.getContext('2d'),{iniciativas:data.iniciativas,promedioI:Number(data.promedio_i),promedioG:Number(data.promedio_g),temas:estado.temas,etiquetas:estado.etiquetas},cvs.width,cvs.height);
    }catch(err){document.getElementById('historialCargando').style.display='none';document.getElementById('listaHistorial').style.display='block';mostrarAlerta('error','Error al cargar el diagnóstico');}
  };
  document.getElementById('btnHistorial').onclick=abrirHistorial;
  document.getElementById('btnCerrarHistorial').onclick=cerrarHistorial;
  document.getElementById('btnVolverHistorial').onclick=()=>{document.getElementById('historialDetalle').style.display='none';document.getElementById('listaHistorial').style.display='block';};
  modalHistorial.onclick=e=>{if(e.target===modalHistorial)cerrarHistorial();};

  // ── Arranque ──────────────────────────────────────────────────────────────
  fetch('/api/sesion').then(r=>r.json()).then(s=>{
    document.getElementById('navUser').textContent=s.nombre;
    document.getElementById('titleBienvenida').textContent=`Bienvenido, ${s.nombre.split(' ')[0]}`;
  });
  verificarPremium();
  cargarTodo();

  // ── Sistema de pagos premium ──────────────────────────────────────────────

  // Cambiar entre tab "Ya tengo código" y "Obtener acceso"
  window.switchPremiumTab = function(tab) {
    const panelCodigo = document.getElementById('panelCodigo');
    const panelPagar  = document.getElementById('panelPagar');
    const tabCodigo   = document.getElementById('tabCodigo');
    const tabPagar    = document.getElementById('tabPagar');

    if (tab === 'codigo') {
      panelCodigo.style.display = 'block';
      panelPagar.style.display  = 'none';
      tabCodigo.classList.add('premium-tab-active');
      tabPagar.classList.remove('premium-tab-active');
    } else {
      panelCodigo.style.display = 'none';
      panelPagar.style.display  = 'block';
      tabCodigo.classList.remove('premium-tab-active');
      tabPagar.classList.add('premium-tab-active');
      cargarDatosPago();
    }
  };

  // Cargar precio y número Nequi desde el servidor
  async function cargarDatosPago() {
    try {
      const r = await fetch('/api/pagos/config');
      if (r.ok) {
        const d = await r.json();
        const precio = Number(d.precio || 50000).toLocaleString('es-CO');
        document.getElementById('pagoPrecio').textContent    = `$${precio} COP`;
        document.getElementById('pagoNequiNum').textContent  = d.nequi || 'Consultar con el administrador';
      }
    } catch (_) {
      document.getElementById('pagoNequiNum').textContent = 'Consultar con el administrador';
    }
  }

  // Precargar correo del usuario en el formulario
  document.getElementById('btnResumen').addEventListener('click', () => {
    // Pre-llenar correo si está disponible
    fetch('/api/sesion').then(r => r.json()).then(s => {
      const pagoCorreo = document.getElementById('pagoCorreo');
      const pagoNombre = document.getElementById('pagoNombre');
      if (pagoCorreo && !pagoCorreo.value) pagoCorreo.value = s.correo || '';
      if (pagoNombre && !pagoNombre.value) pagoNombre.value = s.nombre || '';
    }).catch(() => {});
  }, { once: false });

  // Enviar solicitud de pago
  document.getElementById('btnEnviarPago').addEventListener('click', async () => {
    const nombre      = document.getElementById('pagoNombre').value.trim();
    const correo      = document.getElementById('pagoCorreo').value.trim();
    const metodo      = document.getElementById('pagoMetodo').value;
    const comprobante = document.getElementById('pagoComprobante').files[0];
    const pagoError   = document.getElementById('pagoError');
    const pagoSuccess = document.getElementById('pagoSuccess');
    const btn         = document.getElementById('btnEnviarPago');

    pagoError.style.display   = 'none';
    pagoSuccess.style.display = 'none';

    if (!nombre) { pagoError.textContent = 'Ingresa tu nombre'; pagoError.style.display = 'block'; return; }
    if (!correo) { pagoError.textContent = 'Ingresa tu correo'; pagoError.style.display = 'block'; return; }
    if (!metodo) { pagoError.textContent = 'Selecciona el método de pago'; pagoError.style.display = 'block'; return; }

    btn.textContent = 'Enviando...';
    btn.disabled    = true;

    try {
      const formData = new FormData();
      formData.append('nombre',      nombre);
      formData.append('correo',      correo);
      formData.append('metodo_pago', metodo);
      if (comprobante) formData.append('comprobante', comprobante);

      const r    = await fetch('/api/pagos/solicitar', { method: 'POST', body: formData });
      const data = await r.json();

      if (!r.ok) throw new Error(data.error || 'Error al enviar');

      pagoSuccess.textContent  = data.mensaje;
      pagoSuccess.style.display = 'block';
      btn.textContent = 'Solicitud enviada';

      // Limpiar formulario
      document.getElementById('pagoNombre').value      = '';
      document.getElementById('pagoMetodo').value      = '';
      document.getElementById('pagoComprobante').value = '';

    } catch (err) {
      pagoError.textContent  = err.message;
      pagoError.style.display = 'block';
      btn.textContent = 'Enviar solicitud →';
      btn.disabled    = false;
    }
  });

  document.getElementById('btnCancelarPago').addEventListener('click', () => {
    document.getElementById('modalPremium').style.display = 'none';
  });


  // ══════════════════════════════════════════════════════════════════════════
  // INFORME PDF COMPLETO
  // Genera un documento profesional con: portada, matriz IGO, iniciativas
  // por cuadrante, plan de acción y (si es premium) resumen IA.
  // ══════════════════════════════════════════════════════════════════════════

  document.getElementById('btnInformePDF').addEventListener('click', async () => {
    const btn = document.getElementById('btnInformePDF');
    btn.textContent = 'Generando...';
    btn.disabled    = true;

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Colores corporativos
      const MORADO  = [124, 109, 250];
      const VERDE   = [34,  197, 94];
      const CYAN    = [34,  211, 238];
      const GRIS    = [100, 116, 139];
      const BG_DARK = [18,  18,  28];
      const TEXT    = [30,  30,  50];
      const MUTED   = [100, 116, 139];

      // Obtener datos de la empresa
      let empresa = {}, sesion = {};
      try {
        const [pe, ps] = await Promise.all([
          fetch('/app/perfil/datos').then(r => r.json()),
          fetch('/api/sesion').then(r => r.json()),
        ]);
        empresa = pe.empresa || {};
        sesion  = ps;
      } catch (_) {}

      const nombreEmpresa = empresa.nombre || sesion.nombre || 'Mi empresa';
      const fecha = new Date().toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric'
      });

      // ── PÁGINA 1: PORTADA ─────────────────────────────────────────────────
      // Fondo oscuro
      doc.setFillColor(...BG_DARK);
      doc.rect(0, 0, 210, 297, 'F');

      // Franja lateral izquierda
      doc.setFillColor(...MORADO);
      doc.rect(0, 0, 6, 297, 'F');

      // Logo / nombre app
      doc.setTextColor(...MORADO);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('IGO MANAGER', 20, 35);

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Dinámica del Oriente S.A.S.', 20, 42);

      // Línea decorativa
      doc.setDrawColor(...MORADO);
      doc.setLineWidth(0.5);
      doc.line(20, 48, 190, 48);

      // Título principal
      doc.setTextColor(241, 245, 249);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('Diagnóstico', 20, 90);
      doc.text('IGO', 20, 108);

      doc.setTextColor(...MORADO);
      doc.setFontSize(28);
      doc.text('Empresarial', 55, 108);

      // Nombre empresa
      doc.setTextColor(241, 245, 249);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(nombreEmpresa, 20, 130);

      // Datos
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      if (empresa.sector)   doc.text(`Sector: ${empresa.sector}`, 20, 142);
      if (empresa.tamano)   doc.text(`Tamaño: ${empresa.tamano}`, 20, 149);
      if (empresa.ubicacion) doc.text(`Ciudad: ${empresa.ubicacion}`, 20, 156);

      // Fecha
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(9);
      doc.text(fecha, 20, 175);

      // Stats en portada
      const calificadas = estado.iniciativas.filter(i => i.cuadrante);
      const cuadrantes  = { hacer_ya:0, estrategico:0, rutina:0, descarte:0 };
      calificadas.forEach(i => { if(cuadrantes[i.cuadrante]!==undefined) cuadrantes[i.cuadrante]++; });

      const stats = [
        { label: 'Temas',       val: estado.temas.length,       color: MORADO },
        { label: 'Iniciativas', val: estado.iniciativas.length,  color: CYAN   },
        { label: 'Calificadas', val: calificadas.length,         color: VERDE  },
      ];
      stats.forEach((s, idx) => {
        const x = 20 + idx * 60;
        doc.setFillColor(...s.color);
        doc.roundedRect(x, 195, 52, 28, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20); doc.setFont('helvetica', 'bold');
        doc.text(String(s.val), x + 26, 210, { align: 'center' });
        doc.setFontSize(7); doc.setFont('helvetica', 'normal');
        doc.text(s.label.toUpperCase(), x + 26, 217, { align: 'center' });
      });

      // Pie de portada
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(7);
      doc.text('Metodología IGO — Importancia vs. Gobernabilidad', 105, 285, { align: 'center' });

      // ── PÁGINA 2: MATRIZ IGO ──────────────────────────────────────────────
      doc.addPage();
      encabezadoPagina(doc, 'Matriz IGO', nombreEmpresa, MORADO, BG_DARK, MUTED);

      // Dibujar la matriz en un canvas temporal y añadirla como imagen
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width  = 900; tmpCanvas.height = 640;
      const tmpCtx = tmpCanvas.getContext('2d');
      dibujarMatrizEnCanvas(tmpCanvas, tmpCtx, estado, 900, 640);
      const matrizImg = tmpCanvas.toDataURL('image/png');
      doc.addImage(matrizImg, 'PNG', 15, 35, 180, 115);

      // Leyenda de temas
      let ly = 158;
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEXT);
      doc.text('Referencias:', 15, ly); ly += 6;

      const temasConInis = estado.temas.filter(t =>
        calificadas.some(i => i.tema_id === t.id)
      );
      temasConInis.forEach((tema, idx) => {
        const col = hexToRgb(tema.color);
        doc.setFillColor(...col);
        doc.circle(18, ly - 1.5, 2, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.setTextColor(...TEXT);
        doc.text(tema.nombre, 23, ly);
        ly += 6;
        if (ly > 270) { doc.addPage(); encabezadoPagina(doc,'Matriz IGO (cont.)','',MORADO,BG_DARK,MUTED); ly = 35; }
      });

      // ── PÁGINA 3+: INICIATIVAS POR CUADRANTE ─────────────────────────────
      doc.addPage();
      encabezadoPagina(doc, 'Iniciativas por cuadrante', nombreEmpresa, MORADO, BG_DARK, MUTED);

      const CUAD_INFO = {
        hacer_ya:    { label: '¡Hacer Ya!',  color: VERDE,  desc: 'Ejecutar de inmediato — alta importancia y capacidad' },
        estrategico: { label: 'Estratégico', color: MORADO, desc: 'Buscar recursos o aliados antes de ejecutar' },
        rutina:      { label: 'Rutina',      color: CYAN,   desc: 'Delegar o automatizar' },
        descarte:    { label: 'Descarte',    color: GRIS,   desc: 'No invertir energía ahora' },
      };

      let py = 35;
      ['hacer_ya','estrategico','rutina','descarte'].forEach(clave => {
        const inis = calificadas.filter(i => i.cuadrante === clave);
        if (inis.length === 0) return;
        const info = CUAD_INFO[clave];

        // Encabezado de cuadrante
        doc.setFillColor(...info.color);
        doc.roundedRect(15, py, 180, 10, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text(info.label.toUpperCase(), 20, py + 6.5);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal');
        doc.text(info.desc, 105, py + 6.5, { align: 'center' });
        py += 13;

        inis.forEach(ini => {
          if (py > 265) {
            doc.addPage();
            encabezadoPagina(doc, 'Iniciativas (cont.)', '', MORADO, BG_DARK, MUTED);
            py = 35;
          }
          // Nombre del tema
          const tema = estado.temas.find(t => t.id === ini.tema_id);
          const temaCol = tema ? hexToRgb(tema.color) : GRIS;

          doc.setFillColor(245, 245, 250);
          doc.roundedRect(15, py, 180, 14, 2, 2, 'F');

          // Dot de tema
          doc.setFillColor(...temaCol);
          doc.circle(21, py + 5, 2, 'F');

          doc.setTextColor(...TEXT);
          doc.setFontSize(9); doc.setFont('helvetica', 'bold');
          doc.text(ini.titulo, 26, py + 5.5);

          doc.setFontSize(7); doc.setFont('helvetica', 'normal');
          doc.setTextColor(...MUTED);
          const meta = `Imp: ${ini.importancia}/10  ·  Gob: ${ini.gobernabilidad}/10${tema ? '  ·  ' + tema.nombre : ''}`;
          doc.text(meta, 26, py + 10.5);

          py += 16;
        });
        py += 4;
      });

      // ── PÁGINA PLAN DE ACCIÓN ─────────────────────────────────────────────
      try {
        const dataTareas = await fetch('/api/tareas').then(r => r.json());
        const tareas = dataTareas.tareas || [];

        if (tareas.length > 0) {
          doc.addPage();
          encabezadoPagina(doc, 'Plan de acción', nombreEmpresa, MORADO, BG_DARK, MUTED);

          // Barra de progreso
          const terminadas = tareas.filter(t => t.estado === 'Terminado').length;
          const pctPlan    = Math.round((terminadas / tareas.length) * 100);
          py = 35;

          doc.setFillColor(230, 230, 240);
          doc.roundedRect(15, py, 180, 6, 3, 3, 'F');
          if (pctPlan > 0) {
            doc.setFillColor(...VERDE);
            doc.roundedRect(15, py, 180 * pctPlan / 100, 6, 3, 3, 'F');
          }
          doc.setTextColor(...MUTED);
          doc.setFontSize(7);
          doc.text(`${pctPlan}% completado · ${terminadas} de ${tareas.length} tareas`, 105, py + 4.5, { align: 'center' });
          py += 12;

          const ESTADO_COLOR = {
            'Pendiente':  [245, 158,  11],
            'En proceso': [ 34, 211, 238],
            'Terminado':  [ 34, 197,  94],
            'Abortado':   [244,  63,  94],
          };

          tareas.forEach(t => {
            if (py > 265) {
              doc.addPage();
              encabezadoPagina(doc, 'Plan de acción (cont.)', '', MORADO, BG_DARK, MUTED);
              py = 35;
            }
            const ec = ESTADO_COLOR[t.estado] || GRIS;
            doc.setFillColor(245, 245, 250);
            doc.roundedRect(15, py, 180, 16, 2, 2, 'F');

            // Pill de estado
            doc.setFillColor(...ec);
            doc.roundedRect(155, py + 3, 38, 6, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(6); doc.setFont('helvetica', 'bold');
            doc.text(t.estado.toUpperCase(), 174, py + 7, { align: 'center' });

            doc.setTextColor(...TEXT);
            doc.setFontSize(8); doc.setFont('helvetica', 'bold');
            const descCorta = t.descripcion.length > 60 ? t.descripcion.substring(0,60)+'…' : t.descripcion;
            doc.text(descCorta, 20, py + 6);

            doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
            doc.setTextColor(...MUTED);
            let meta2 = `Iniciativa: ${t.iniciativa_titulo}`;
            if (t.fecha_limite) {
              const fl = new Date(t.fecha_limite+'T00:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
              meta2 += `  ·  Fecha: ${fl}`;
            }
            if (t.responsable) meta2 += `  ·  Resp.: ${t.responsable}`;
            doc.text(meta2, 20, py + 12);
            py += 18;
          });
        }
      } catch (_) {}

      // ── PIE DE PÁGINA en todas las páginas ────────────────────────────────
      const totalPags = doc.getNumberOfPages();
      for (let i = 1; i <= totalPags; i++) {
        doc.setPage(i);
        doc.setFillColor(...BG_DARK);
        doc.rect(0, 289, 210, 8, 'F');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(`IGO Manager · Dinámica del Oriente S.A.S. · ${fecha}`, 15, 294);
        doc.text(`${i} / ${totalPags}`, 195, 294, { align: 'right' });
      }

      doc.save(`Informe_IGO_${nombreEmpresa.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (err) {
      console.error('Error generando informe PDF:', err);
      mostrarAlerta('error', 'Error al generar el informe. Intenta de nuevo.');
    } finally {
      btn.textContent = 'Informe PDF';
      btn.disabled    = false;
    }
  });

  // Helper: encabezado de página interior
  function encabezadoPagina(doc, titulo, subtitulo, colorMorado, colorBG, colorMuted) {
    doc.setFillColor(...colorBG);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setFillColor(...colorMorado);
    doc.rect(0, 0, 4, 20, 'F');
    doc.setTextColor(...colorMorado);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(titulo, 10, 13);
    if (subtitulo) {
      doc.setTextColor(...colorMuted);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(subtitulo, 210 - 15, 13, { align: 'right' });
    }
    doc.setDrawColor(...colorMorado);
    doc.setLineWidth(0.3);
    doc.line(10, 18, 200, 18);
  }

  // Helper: hex color a RGB array
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return [r, g, b];
  }


})();
