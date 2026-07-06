/* ==========================================================================
   TRATAMIENTO.JS - Pestañas + Mapeo ISO + Conexión real a SQL
   ========================================================================= */

const API_BASE = 'http://127.0.0.1:8000/api';

let catalogoISOTrat = [];
let catalogoActivosTrat = [];
let catalogoRiesgosTrat = [];
let bibliotecaControles = []; // ControlEmpresa reales desde SQL

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([cargarCatalogoISOTrat(), cargarActivosTrat(), cargarRiesgosTrat()]);
    activarFiltrosBiblioteca();
    await cargarBiblioteca();

    // Si venimos desde "+ Aplicar Tratamiento" de un riesgo específico
    const params = new URLSearchParams(window.location.search);
    const riesgoPreseleccionado = params.get('riesgo');
    if (riesgoPreseleccionado && selectRiesgo) {
        selectRiesgo.value = riesgoPreseleccionado;
        document.querySelector('.tab-btn[onclick*="tab-plan"]')?.click();
        calcularResidual();
    }

    // Acceso directo desde el Panel: tratamiento.html?tab=biblioteca|plan|historial abre esa pestaña
    const tabSolicitada = params.get('tab');
    if (tabSolicitada) {
        document.querySelector(`.tab-btn[onclick*="tab-${tabSolicitada}"]`)?.click();
    }
});

// --- 1. SISTEMA DE PESTAÑAS (TABS) ---
function switchTab(evt, tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');
}

// --- 2. SELECCIÓN POR DOMINIO ISO 27002:2022 (cubre las 93 normas reales del catálogo) ---
// Ordena "5.1, 5.2, ... 5.10, 5.11" correctamente (no alfabéticamente) al comparar mayor.menor por separado
function compararIdControlIso(idA, idB) {
    const [mayorA, menorA] = idA.split('.').map(Number);
    const [mayorB, menorB] = idB.split('.').map(Number);
    return mayorA !== mayorB ? mayorA - mayorB : menorA - menorB;
}

const selectIntencion = document.getElementById('intencion_usuario');
const selectControlEspecifico = document.getElementById('ctrl_iso');

if (selectIntencion && selectControlEspecifico) {
    selectIntencion.addEventListener('change', function () {
        const dominioElegido = this.value;
        selectControlEspecifico.innerHTML = '<option value="">Selecciona el control ISO 27002 específico...</option>';
        if (dominioElegido === "") {
            selectControlEspecifico.disabled = true;
            return;
        }
        selectControlEspecifico.disabled = false;

        catalogoISOTrat
            .filter(c => c.dominio === dominioElegido)
            .sort((a, b) => compararIdControlIso(a.id_control, b.id_control))
            .forEach(control => {
                const opt = document.createElement('option');
                opt.value = control.id_control;
                opt.textContent = `${control.id_control} - ${control.titulo_control}`;
                selectControlEspecifico.appendChild(opt);
            });
    });
}

// --- 2b. ABRIR/CERRAR MODAL "CREAR NUEVO CONTROL" ---
const modalControl = document.getElementById('modalNuevoControl');
const btnAbrirModalControl = document.getElementById('btnAbrirModalControl');
const btnCerrarModalControl = document.getElementById('btnCerrarModalControl');

if (btnAbrirModalControl && modalControl) {
    btnAbrirModalControl.addEventListener('click', () => modalControl.classList.remove('hidden'));
}
if (btnCerrarModalControl && modalControl) {
    btnCerrarModalControl.addEventListener('click', () => modalControl.classList.add('hidden'));
}
if (modalControl) {
    modalControl.addEventListener('click', (e) => {
        if (e.target === modalControl) modalControl.classList.add('hidden');
    });
}

// --- 3. CÁLCULO DE FUERZA DEL CONTROL (Pestaña 1) ---
const radiosControl = document.querySelectorAll('#modalNuevoControl input[type="radio"]');
const strengthLabel = document.getElementById('ctrl-strength-percent');

const calcularFuerzaControl = () => {
    const radioTipo = document.querySelector('input[name="c_tipo"]:checked');
    const radioExec = document.querySelector('input[name="c_exec"]:checked');
    const radioDoc = document.querySelector('input[name="c_doc"]:checked');
    if (!radioTipo || !radioExec || !radioDoc) return null;

    const tipo = parseInt(radioTipo.value);
    const exec = parseInt(radioExec.value);
    const doc = parseInt(radioDoc.value);
    const eficacia = Math.round((tipo + exec + doc) / 3);

    strengthLabel.textContent = `Fuerza: ${eficacia}%`;
    strengthLabel.style.color = eficacia > 70 ? "#10b981" : eficacia > 40 ? "#ca8a04" : "#dc2626";

    document.getElementById('lbl-c-tipo').textContent = tipo === 100 ? "Preventivo" : tipo === 60 ? "Detectivo" : "Correctivo";
    document.getElementById('lbl-c-exec').textContent = exec === 100 ? "Automático" : exec === 50 ? "Semiautomático" : "Manual";
    document.getElementById('lbl-c-doc').textContent = doc === 100 ? "Formalizado" : doc === 50 ? "Parcial" : "Ninguno";

    return { tipo, exec, doc, eficacia };
};

radiosControl.forEach(r => r.addEventListener('change', calcularFuerzaControl));

// --- 4. CARGA DE CATÁLOGOS REALES DESDE SQL ---
async function cargarCatalogoISOTrat() {
    const res = await fetch(`${API_BASE}/catalogo-iso/`);
    catalogoISOTrat = await res.json();
}

async function cargarActivosTrat() {
    const res = await fetch(`${API_BASE}/activos/`);
    catalogoActivosTrat = await res.json();
}

async function cargarRiesgosTrat() {
    const res = await fetch(`${API_BASE}/riesgos/`);
    catalogoRiesgosTrat = await res.json();
    pintarSelectRiesgos();
}

function scoreInherenteDe(r) {
    return r.score_inherente ?? (r.nivel_probabilidad * r.nivel_vulnerabilidad);
}

function pintarSelectRiesgos() {
    if (!selectRiesgo) return;
    if (catalogoRiesgosTrat.length === 0) {
        selectRiesgo.innerHTML = '<option value="" disabled selected>No hay riesgos registrados aún</option>';
        return;
    }
    let html = '';
    catalogoRiesgosTrat.forEach(r => {
        html += `<option value="${r.id_riesgo}">${r.nombre_riesgo} - Inherente: ${scoreInherenteDe(r)}</option>`;
    });
    selectRiesgo.innerHTML = html;
    calcularResidual();
}

// --- 5. GUARDAR CONTROL EN BIBLIOTECA (POST real a SQL) ---
const btnGuardarBiblioteca = document.querySelector('#modalNuevoControl .btn-primary-solid');

if (btnGuardarBiblioteca) {
    btnGuardarBiblioteca.addEventListener('click', async () => {
        const nombre = document.getElementById('ctrl_name').value.trim();
        const idControlIso = document.getElementById('ctrl_iso').value;
        const datosFuerza = calcularFuerzaControl();

        if (!nombre || !idControlIso || !datosFuerza) {
            alert('Completa el nombre, selecciona un control ISO y calibra las 3 características del diseño.');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/controles-empresa/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre_control: nombre,
                    id_iso_padre: idControlIso,
                    naturaleza_valor: datosFuerza.tipo,
                    ejecucion_valor: datosFuerza.exec,
                    documentacion_valor: datosFuerza.doc,
                    eficacia_porcentaje: datosFuerza.eficacia
                })
            });

            if (res.ok) {
                alert('¡Control guardado en la biblioteca!');
                document.getElementById('ctrl_name').value = '';
                document.getElementById('intencion_usuario').selectedIndex = 0;
                document.getElementById('ctrl_iso').innerHTML = '<option value="">Primero selecciona el objetivo arriba...</option>';
                document.getElementById('ctrl_iso').disabled = true;
                document.querySelectorAll('#modalNuevoControl input[type="radio"]').forEach(r => r.checked = false);
                strengthLabel.textContent = 'Fuerza: 0%';
                if (modalControl) modalControl.classList.add('hidden');
                cargarBiblioteca();
            } else {
                const err = await res.json();
                console.error(err);
                alert('Error al guardar el control.');
            }
        } catch (e) {
            console.error(e);
            alert('No se pudo conectar con el servidor.');
        }
    });
}

// --- 6. CARGAR Y PINTAR BIBLIOTECA REAL ---
let vinculosPorControlGlobal = {}; // id_control_emp -> [nombres de activos vinculados]

async function cargarBiblioteca() {
    const [resControles, resTratamientos] = await Promise.all([
        fetch(`${API_BASE}/controles-empresa/`),
        fetch(`${API_BASE}/tratamientos/`)
    ]);
    bibliotecaControles = await resControles.json();
    const tratamientos = await resTratamientos.json();

    // Cruzamos tratamiento -> riesgo -> activo para saber a qué activo quedó vinculado cada control
    const vinculosPorControl = {};
    tratamientos.forEach(t => {
        if (!t.id_control_emp) return;
        const riesgo = catalogoRiesgosTrat.find(r => r.id_riesgo === t.id_riesgo);
        const activo = riesgo ? catalogoActivosTrat.find(a => a.id_activo === riesgo.id_activo) : null;
        const nombreActivo = activo ? activo.nombre_activo : (riesgo ? `#ACT-${riesgo.id_activo}` : 'Activo desconocido');
        if (!vinculosPorControl[t.id_control_emp]) vinculosPorControl[t.id_control_emp] = [];
        vinculosPorControl[t.id_control_emp].push(nombreActivo);
    });
    vinculosPorControlGlobal = vinculosPorControl;

    const contenedor = document.getElementById('library-list');
    const contadorBiblioteca = document.getElementById('contador-biblioteca');
    if (contadorBiblioteca) {
        contadorBiblioteca.textContent = `${bibliotecaControles.length} control${bibliotecaControles.length !== 1 ? 'es' : ''}`;
    }

    if (bibliotecaControles.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Aún no hay controles en la biblioteca. Crea uno con "+ Nuevo Control".</p>';
    } else {
        let html = '';
        bibliotecaControles.forEach(c => {
            const vinculado = !!vinculosPorControl[c.id_control_emp];
            html += `
                <div class="saved-risk-item" data-vinculado="${vinculado ? 'si' : 'no'}" data-eficacia="${c.eficacia_porcentaje}">
                    <div class="sr-info">
                        <strong>${c.nombre_control}</strong>
                        <span>ISO ${c.id_iso_padre} - Eficacia: ${c.eficacia_porcentaje}%</span>
                    </div>
                    <div class="sr-score ${vinculado ? 'impacto-bajo' : 'impacto-critico'}">${vinculado ? 'VINCULADO' : 'NO VINCULADO'}</div>
                </div>
            `;
        });
        contenedor.innerHTML = html;
    }

    pintarSelectControlLib();
    pintarHistorialVinculos();
    actualizarConteosVinculo();
    aplicarFiltrosBiblioteca();
}

// --- FILTROS: ESTADO DE VÍNCULO + EFICACIA MÍNIMA (COLUMNA IZQUIERDA) ---
let filtroVinculo = 'todos'; // 'todos' | 'si' | 'no'
let filtroEficaciaMin = 0;

function aplicarFiltrosBiblioteca() {
    document.querySelectorAll('#library-list .saved-risk-item').forEach(item => {
        const coincideVinculo = (filtroVinculo === 'todos') || (item.getAttribute('data-vinculado') === filtroVinculo);
        const coincideEficacia = parseFloat(item.getAttribute('data-eficacia')) >= filtroEficaciaMin;
        item.style.display = (coincideVinculo && coincideEficacia) ? 'flex' : 'none';
    });
}

function activarFiltrosBiblioteca() {
    document.querySelectorAll('input[name="filtro-vinculo"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            filtroVinculo = e.target.value;
            aplicarFiltrosBiblioteca();
        });
    });

    const slider = document.getElementById('filtroEficaciaMin');
    const sliderValor = document.getElementById('filtroEficaciaMinValor');
    if (slider) {
        slider.addEventListener('input', (e) => {
            filtroEficaciaMin = parseInt(e.target.value);
            sliderValor.textContent = `${filtroEficaciaMin}%`;
            aplicarFiltrosBiblioteca();
        });
    }
}

function actualizarConteosVinculo() {
    let si = 0, no = 0;
    document.querySelectorAll('#library-list .saved-risk-item').forEach(item => {
        if (item.getAttribute('data-vinculado') === 'si') si++; else no++;
    });
    const spanSi = document.getElementById('count-vinculo-si');
    const spanNo = document.getElementById('count-vinculo-no');
    if (spanSi) spanSi.textContent = `(${si})`;
    if (spanNo) spanNo.textContent = `(${no})`;
}

// --- HISTORIAL DE VÍNCULOS (COLUMNA DERECHA): control -> activo(s) al que fue vinculado ---
function pintarHistorialVinculos() {
    const contenedor = document.getElementById('historial-vinculos-container');
    if (!contenedor) return;

    const controlesConVinculo = bibliotecaControles.filter(c => vinculosPorControlGlobal[c.id_control_emp]);

    if (controlesConVinculo.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Aún no hay controles vinculados a ningún activo.</p>';
        return;
    }

    let html = '';
    controlesConVinculo.forEach(c => {
        const activos = vinculosPorControlGlobal[c.id_control_emp];
        html += `
            <div class="historial-vinculo-item">
                <strong>${c.nombre_control}</strong>
                <div class="historial-vinculo-activos">
                    ${activos.map(nombre => `<span class="historial-vinculo-activo"><i class='bx bx-server'></i> ${nombre}</span>`).join('')}
                </div>
            </div>
        `;
    });
    contenedor.innerHTML = html;
}

function pintarSelectControlLib() {
    if (!selectControlLib) return;
    if (bibliotecaControles.length === 0) {
        selectControlLib.innerHTML = '<option value="" disabled selected>Crea un control en "Biblioteca de Controles" primero</option>';
        return;
    }

    // Detectamos la amenaza del riesgo seleccionado para recomendar controles
    const riesgo = catalogoRiesgosTrat.find(r => r.id_riesgo === parseInt(selectRiesgo.value));
    const idsRecomendados = (riesgo && mapeoAmenazaControlesISO[riesgo.id_amenaza]) || [];

    const ordenados = [...bibliotecaControles].sort((a, b) => {
        const aRec = idsRecomendados.includes(a.id_iso_padre) ? 0 : 1;
        const bRec = idsRecomendados.includes(b.id_iso_padre) ? 0 : 1;
        return aRec - bRec;
    });

    let html = '';
    ordenados.forEach(c => {
        const eficaciaDecimal = (parseFloat(c.eficacia_porcentaje) / 100).toFixed(2);
        const esRecomendado = idsRecomendados.includes(c.id_iso_padre);
        html += `<option value="${c.id_control_emp}" data-eficacia="${eficaciaDecimal}">${esRecomendado ? '⭐ ' : ''}${c.nombre_control} (Eficacia ${c.eficacia_porcentaje}%)</option>`;
    });
    selectControlLib.innerHTML = html;
    calcularResidual();
}

// Mapeo compartido con analisis.js (Amenaza -> Controles ISO recomendados)
const mapeoAmenazaControlesISO = {
    1: ['5.15', '5.16', '5.17', '5.18', '8.2', '8.5'],
    2: ['8.7', '8.8', '8.13', '5.26'],
    3: ['6.3', '5.26', '8.23'],
    4: ['7.8', '7.13', '8.13', '8.14'],
    5: ['7.5', '5.29', '5.30', '8.14'],
    6: ['6.3', '5.37', '8.32']
};  

// --- 7. CÁLCULO DE RIESGO RESIDUAL (Pestaña 2) ---
const selectRiesgo = document.getElementById('select-riesgo');
const selectControlLib = document.getElementById('select-control-lib');
const resScore = document.getElementById('residual-score-inline');
const resLabel = document.getElementById('residual-label-inline');

function nivelYClasePorScoreTrat(score) {
    if (score <= 4) return { clase: 'impacto-bajo', texto: 'Nivel Bajo' };
    if (score <= 9) return { clase: 'impacto-medio', texto: 'Nivel Medio' };
    if (score <= 16) return { clase: 'impacto-alto', texto: 'Nivel Alto' };
    return { clase: 'impacto-critico', texto: 'Nivel Crítico' };
}

// Resalta en la Matriz de Riesgo Residual la casilla "antes" (riesgo inherente) y "después" (riesgo residual)
function actualizarMatrizResidual(antes, despues) {
    document.querySelectorAll('#heatmap-grid-residual .hm-cell').forEach(c => {
        c.classList.remove('hm-antes', 'hm-despues');
    });
    if (antes) {
        const celdaAntes = document.querySelector(`#heatmap-grid-residual .hm-r-${antes.imp}.hm-c-${antes.prob}`);
        if (celdaAntes) celdaAntes.classList.add('hm-antes');
    }
    if (despues) {
        const celdaDespues = document.querySelector(`#heatmap-grid-residual .hm-r-${despues.imp}.hm-c-${despues.prob}`);
        if (celdaDespues) celdaDespues.classList.add('hm-despues');
    }
}

const calcularResidual = () => {
    if (!selectRiesgo || !resScore || !resLabel) return null;
    const riesgo = catalogoRiesgosTrat.find(r => r.id_riesgo === parseInt(selectRiesgo.value));
    if (!riesgo) {
        actualizarMatrizResidual(null, null);
        return null;
    }

    const inherente = scoreInherenteDe(riesgo);
    const estrategiaActual = document.querySelector('input[name="estrategia_plan"]:checked').value;
    const wrapperControl = document.getElementById('wrapper-control-lib');
    const mensajeSinControl = document.getElementById('mensaje-sin-control');

    let residual, opcionControl = null;

    if (estrategiaActual === 'aceptar') {
        // Aceptar: no se reduce el riesgo, la organización lo asume conscientemente
        wrapperControl.classList.add('hidden');
        mensajeSinControl.classList.remove('hidden');
        mensajeSinControl.innerHTML = '<i class="bx bx-info-circle"></i> Al "Aceptar" el riesgo, no se aplica un control técnico — el riesgo residual queda igual al inherente, pero queda documentada la decisión.';
        residual = inherente;
    } else if (estrategiaActual === 'evitar') {
        // Evitar: se elimina la fuente del riesgo (se descontinúa el proceso/activo que lo genera)
        wrapperControl.classList.add('hidden');
        mensajeSinControl.classList.remove('hidden');
        mensajeSinControl.innerHTML = '<i class="bx bx-info-circle"></i> Al "Evitar" el riesgo, se elimina la actividad o condición que lo origina — el riesgo residual se considera prácticamente nulo.';
        residual = 1;
    } else {
        // Mitigar o Transferir: requieren un control vinculado
        wrapperControl.classList.remove('hidden');
        mensajeSinControl.classList.add('hidden');

        opcionControl = selectControlLib.selectedOptions[0];
        if (!opcionControl || !opcionControl.dataset.eficacia) {
            resScore.textContent = '-';
            resLabel.textContent = 'Selecciona un control';
            resLabel.className = 'badge-impacto';
            actualizarMatrizResidual({ prob: riesgo.nivel_probabilidad, imp: riesgo.nivel_vulnerabilidad }, null);
            return null;
        }
        const eficaciaControl = parseFloat(opcionControl.dataset.eficacia);
        residual = Math.max(1, Math.round(inherente * (1 - eficaciaControl)));
    }

    resScore.textContent = residual;
    const nivel = nivelYClasePorScoreTrat(residual);
    resLabel.className = `badge-impacto ${nivel.clase}`;
    resLabel.textContent = nivel.texto;

    const antesCelda = { prob: riesgo.nivel_probabilidad, imp: riesgo.nivel_vulnerabilidad };
    const despuesDescompuesto = descomponerScore(residual);
    actualizarMatrizResidual(antesCelda, { prob: despuesDescompuesto.prob, imp: despuesDescompuesto.impacto });

    return { riesgo, residual, opcionControl, estrategia: estrategiaActual };
};

document.querySelectorAll('input[name="estrategia_plan"]').forEach(r => r.addEventListener('change', calcularResidual));

if (selectRiesgo) selectRiesgo.addEventListener('change', calcularResidual);
if (selectControlLib) selectControlLib.addEventListener('change', calcularResidual);

// Descompone un score total (ej. 4) en Probabilidad x Impacto (1-5 cada uno) lo más cercano posible
function descomponerScore(score) {
    score = Math.max(1, Math.min(25, score));
    let mejorProb = 1, mejorImp = score, mejorDiff = Infinity;
    for (let p = 1; p <= 5; p++) {
        let imp = Math.max(1, Math.min(5, Math.round(score / p)));
        let diff = Math.abs(p * imp - score);
        if (diff < mejorDiff) { mejorDiff = diff; mejorProb = p; mejorImp = imp; }
    }
    return { prob: mejorProb, impacto: mejorImp };
}

// --- 8. GUARDAR PLAN DE TRATAMIENTO (POST real a SQL) ---
const btnFinalizarPlan = document.querySelector('#tab-plan .btn-primary-solid');

if (btnFinalizarPlan) {
    btnFinalizarPlan.addEventListener('click', async () => {
        const resultado = calcularResidual();
        if (!resultado) {
            alert('Completa la selección de riesgo (y control, si la estrategia lo requiere) antes de finalizar.');
            return;
        }

        const estrategiaRaw = document.querySelector('input[name="estrategia_plan"]:checked').value;
        const estrategia = estrategiaRaw.charAt(0).toUpperCase() + estrategiaRaw.slice(1);
        const observaciones = document.querySelector('#tab-plan textarea').value;
        const { prob, impacto } = descomponerScore(resultado.residual);
        const nivel = nivelYClasePorScoreTrat(resultado.residual);

        try {
            const res = await fetch(`${API_BASE}/tratamientos/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_riesgo: resultado.riesgo.id_riesgo,
                    id_control_emp: resultado.opcionControl ? parseInt(resultado.opcionControl.value) : null,
                    estrategia: estrategia,
                    probabilidad_residual: prob,
                    impacto_residual: impacto,
                    score_residual: resultado.residual,
                    nivel_residual: nivel.texto,
                    id_responsable: 1,
                    observaciones: observaciones,
                    es_activo: true
                })
            });

            if (res.ok) {
                alert(`¡Plan de tratamiento guardado! Riesgo reducido de ${scoreInherenteDe(resultado.riesgo)} a ${resultado.residual} (${nivel.texto}).`);
                document.querySelector('#tab-plan textarea').value = '';
            } else {
                const err = await res.json();
                console.error(err);
                alert('Error al guardar el plan de tratamiento.');
            }
        } catch (e) {
            console.error(e);
            alert('No se pudo conectar con el servidor.');
        }
    });
}

// --- 9. HISTORIAL DE TRATAMIENTOS (Antes vs Después) ---
let historialEnriquecidoGlobal = []; // Cache usado por el filtro de fechas y el reporte

async function cargarHistorialTratamientos() {
    const contenedor = document.getElementById('lista-historial-tratamientos');
    if (!contenedor) return;

    try {
        const [resTrat, resRiesgos, resControles, resIso] = await Promise.all([
            fetch(`${API_BASE}/tratamientos/`),
            fetch(`${API_BASE}/riesgos/`),
            fetch(`${API_BASE}/controles-empresa/`),
            fetch(`${API_BASE}/catalogo-iso/`)
        ]);

        const tratamientos = await resTrat.json();
        const riesgos = await resRiesgos.json();
        const controles = await resControles.json();
        const isoControles = await resIso.json();

        document.getElementById('contador-historial').textContent =
            `${tratamientos.length} tratamiento${tratamientos.length !== 1 ? 's' : ''}`;

        if (tratamientos.length === 0) {
            historialEnriquecidoGlobal = [];
            contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Aún no se han aplicado tratamientos. Ve a "Plan de Tratamiento" para crear el primero.</p>';
            return;
        }

        // Ordenamos del más reciente al más antiguo
        tratamientos.sort((a, b) => new Date(b.fecha_actualizacion) - new Date(a.fecha_actualizacion));

        let html = '';
        historialEnriquecidoGlobal = [];

        tratamientos.forEach(t => {
            const riesgo = riesgos.find(r => r.id_riesgo === t.id_riesgo);
            const control = controles.find(c => c.id_control_emp === t.id_control_emp);
            const iso = control ? isoControles.find(i => i.id_control === control.id_iso_padre) : null;

            const inherente = riesgo ? (riesgo.score_inherente ?? (riesgo.nivel_probabilidad * riesgo.nivel_vulnerabilidad)) : '-';
            const nivelInherente = riesgo ? nivelYClasePorScoreTrat(inherente) : { clase: '', texto: 'N/A' };
            const nivelResidual = nivelYClasePorScoreTrat(t.score_residual);

            const fechaISO = t.fecha_actualizacion ? t.fecha_actualizacion.slice(0, 10) : '';
            const fecha = t.fecha_actualizacion
                ? new Date(t.fecha_actualizacion).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'N/A';

            const reduccion = (riesgo && inherente > 0)
                ? Math.round(((inherente - t.score_residual) / inherente) * 100)
                : 0;

            historialEnriquecidoGlobal.push({
                nombreRiesgo: riesgo ? riesgo.nombre_riesgo : 'Riesgo eliminado',
                nombreControl: control ? control.nombre_control : 'Control no encontrado',
                estrategia: t.estrategia,
                inherente, residual: t.score_residual,
                nivelInherente: nivelInherente.texto, nivelResidual: nivelResidual.texto,
                reduccion, fecha, observaciones: t.observaciones || ''
            });

            html += `
                <div class="historial-item" data-fecha="${fechaISO}">
                    <div class="historial-item-top">
                        <div>
                            <strong>${riesgo ? riesgo.nombre_riesgo : 'Riesgo eliminado'}</strong>
                            <span class="historial-meta">${control ? control.nombre_control : 'Control no encontrado'} ${iso ? `(ISO ${iso.id_control})` : ''}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="tratamiento-estrategia-tag">${t.estrategia}</span>
                            <button class="btn-eliminar-historial" onclick="eliminarTratamiento(${t.id_tratamiento})" title="Eliminar tratamiento (revertir)">
                                <i class='bx bx-trash'></i>
                            </button>
                        </div>
                    </div>

                    <div class="historial-comparativa">
                        <div class="historial-box historial-antes">
                            <small>ANTES</small>
                            <span class="badge-impacto ${nivelInherente.clase}">${inherente} - ${nivelInherente.texto}</span>
                        </div>
                        <i class='bx bx-right-arrow-alt historial-flecha'></i>
                        <div class="historial-box historial-despues">
                            <small>DESPUÉS</small>
                            <span class="badge-impacto ${nivelResidual.clase}">${t.score_residual} - ${nivelResidual.texto}</span>
                        </div>
                        <div class="historial-reduccion">
                            ${reduccion > 0 ? `<i class='bx bx-trending-down'></i> -${reduccion}%` : 'Sin cambio'}
                        </div>
                    </div>

                    <div class="historial-item-footer">
                        <span><i class='bx bx-user'></i> Responsable ID: ${t.id_responsable}</span>
                        <span><i class='bx bx-calendar'></i> ${fecha}</span>
                    </div>
                    ${t.observaciones ? `<p class="historial-observaciones">${t.observaciones}</p>` : ''}
                </div>
            `;
        });

        contenedor.innerHTML = html;
        aplicarFiltroFechaHistorial();
    } catch (e) {
        console.error('Error al cargar historial:', e);
        contenedor.innerHTML = '<p style="color:red; font-size:13px;">Error al cargar el historial de tratamientos.</p>';
    }
}

// --- ELIMINAR UN TRATAMIENTO (revertir, por si quedó mal aplicado) ---
async function eliminarTratamiento(id) {
    if (!confirm('¿Eliminar este tratamiento? El riesgo volverá a quedar sin tratar. Esta acción no se puede deshacer.')) return;
    try {
        const res = await fetch(`${API_BASE}/tratamientos/${id}/`, { method: 'DELETE' });
        if (res.ok) {
            alert('Tratamiento eliminado correctamente.');
            cargarHistorialTratamientos();
        } else {
            alert('No se pudo eliminar el tratamiento.');
        }
    } catch (e) {
        console.error('Error al eliminar tratamiento:', e);
        alert('Error de conexión al eliminar el tratamiento.');
    }
}

// --- FILTRO POR FECHA (EXACTA O RANGO) EN EL HISTORIAL ---
let filtroTipoFecha = 'todas'; // 'todas' | 'exacta' | 'rango'

function aplicarFiltroFechaHistorial() {
    const items = document.querySelectorAll('#lista-historial-tratamientos .historial-item');
    const fechaExacta = document.getElementById('filtroFechaExacta')?.value || '';
    const fechaDesde = document.getElementById('filtroFechaDesde')?.value || '';
    const fechaHasta = document.getElementById('filtroFechaHasta')?.value || '';

    let visibles = 0;
    items.forEach(item => {
        const fechaItem = item.getAttribute('data-fecha');
        let visible = true;

        if (filtroTipoFecha === 'exacta' && fechaExacta) {
            visible = fechaItem === fechaExacta;
        } else if (filtroTipoFecha === 'rango' && (fechaDesde || fechaHasta)) {
            if (fechaDesde && fechaItem < fechaDesde) visible = false;
            if (fechaHasta && fechaItem > fechaHasta) visible = false;
        }

        item.style.display = visible ? 'block' : 'none';
        if (visible) visibles++;
    });

    const contador = document.getElementById('contador-historial');
    if (contador) contador.textContent = `${visibles} tratamiento${visibles !== 1 ? 's' : ''}`;
}

function activarFiltroFechaHistorial() {
    document.querySelectorAll('input[name="filtro-tipo-fecha"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            filtroTipoFecha = e.target.value;
            document.getElementById('wrapper-fecha-exacta').classList.toggle('hidden', filtroTipoFecha !== 'exacta');
            document.getElementById('wrapper-fecha-rango').classList.toggle('hidden', filtroTipoFecha !== 'rango');
            aplicarFiltroFechaHistorial();
        });
    });

    ['filtroFechaExacta', 'filtroFechaDesde', 'filtroFechaHasta'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.addEventListener('change', aplicarFiltroFechaHistorial);
    });
}

// Cargamos el historial también cuando abre la página, y cada vez que se cambia a esa pestaña
document.addEventListener('DOMContentLoaded', () => {
    activarFiltroFechaHistorial();
    cargarHistorialTratamientos();
});

const tabHistorialBtn = document.querySelector('.tab-btn[onclick*="tab-historial"]');
if (tabHistorialBtn) {
    tabHistorialBtn.addEventListener('click', cargarHistorialTratamientos);
}

// Refrescamos el historial automáticamente después de guardar un nuevo tratamiento
if (btnFinalizarPlan) {
    btnFinalizarPlan.addEventListener('click', () => {
        setTimeout(cargarHistorialTratamientos, 500);
    });
}

/* ==========================================================================
   GENERAR REPORTE DE CONTROLES (Vista + Descarga Excel), igual que en Activos
   ========================================================================== */
function generarReporteControles() {
    if (!bibliotecaControles || bibliotecaControles.length === 0) {
        alert('No hay controles registrados en la biblioteca para generar el reporte.');
        return;
    }

    const fecha = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' });

    let filas = '';
    bibliotecaControles.forEach(c => {
        const vinculado = !!vinculosPorControlGlobal[c.id_control_emp];
        const activos = vinculado ? vinculosPorControlGlobal[c.id_control_emp].join(', ') : 'N/A';

        filas += `
            <tr>
                <td>${c.nombre_control}</td>
                <td>ISO ${c.id_iso_padre}</td>
                <td>${c.eficacia_porcentaje}%</td>
                <td>${vinculado ? 'Vinculado' : 'No Vinculado'}</td>
                <td>${activos}</td>
            </tr>
        `;
    });

    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <html>
        <head>
            <title>Reporte de Controles - SecureCore</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #1f2937; }
                h1 { color: #4f46e5; margin-bottom: 4px; }
                p.fecha { color: #6b7280; margin-top: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 12px; }
                th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
                th { background: #f3f4f6; }
                .botones { margin-top: 20px; display: flex; gap: 12px; }
                button { padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; }
                .btn-print { background: #e5e7eb; color: #1f2937; }
                @media print { .botones { display: none; } }
            </style>
        </head>
        <body>
            <h1>Reporte de Biblioteca de Controles</h1>
            <p class="fecha">Generado el ${fecha} — SecureCore Plataforma de Riesgo</p>
            <p>Total de controles registrados: <strong>${bibliotecaControles.length}</strong></p>
            <table>
                <thead>
                    <tr>
                        <th>Control</th><th>Control ISO</th><th>Eficacia</th><th>Estado de Vínculo</th><th>Activos Vinculados</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
            <div class="botones">
                <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
            </div>
        </body>
        </html>
    `);
    ventana.document.close();

    descargarExcelControles();
}

function descargarExcelControles() {
    if (typeof XLSX === 'undefined') {
        alert('No se pudo cargar la librería de Excel. Verifica tu conexión a internet.');
        return;
    }

    const datosExcel = bibliotecaControles.map(c => {
        const vinculado = !!vinculosPorControlGlobal[c.id_control_emp];
        const activos = vinculado ? vinculosPorControlGlobal[c.id_control_emp].join(', ') : 'N/A';

        return {
            'Control': c.nombre_control,
            'Control ISO': `ISO ${c.id_iso_padre}`,
            'Eficacia': `${c.eficacia_porcentaje}%`,
            'Estado de Vínculo': vinculado ? 'Vinculado' : 'No Vinculado',
            'Activos Vinculados': activos
        };
    });

    const hoja = XLSX.utils.json_to_sheet(datosExcel);
    hoja['!cols'] = [
        { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 40 }
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Controles');

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `Reporte_Controles_SecureCore_${fechaArchivo}.xlsx`);
}

const linkReporteControles = document.getElementById('btnVerReporteControles');
if (linkReporteControles) {
    linkReporteControles.addEventListener('click', (e) => {
        e.preventDefault();
        generarReporteControles();
    });
}

/* ==========================================================================
   GENERAR REPORTE DE HISTORIAL DE TRATAMIENTOS (respeta el filtro de fecha activo)
   ========================================================================== */
function generarReporteHistorial() {
    const idsVisibles = new Set();
    document.querySelectorAll('#lista-historial-tratamientos .historial-item').forEach((item, indice) => {
        if (item.style.display !== 'none') idsVisibles.add(indice);
    });
    const datos = historialEnriquecidoGlobal.filter((_, indice) => idsVisibles.has(indice));

    if (datos.length === 0) {
        alert('No hay tratamientos que coincidan con el filtro actual para generar el reporte.');
        return;
    }

    const fecha = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' });

    let filas = '';
    datos.forEach(d => {
        filas += `
            <tr>
                <td>${d.nombreRiesgo}</td>
                <td>${d.nombreControl}</td>
                <td>${d.estrategia}</td>
                <td>${d.inherente} - ${d.nivelInherente}</td>
                <td>${d.residual} - ${d.nivelResidual}</td>
                <td>${d.reduccion > 0 ? `-${d.reduccion}%` : 'Sin cambio'}</td>
                <td>${d.fecha}</td>
                <td>${d.observaciones || 'N/A'}</td>
            </tr>
        `;
    });

    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <html>
        <head>
            <title>Reporte de Historial de Tratamientos - SecureCore</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #1f2937; }
                h1 { color: #4f46e5; margin-bottom: 4px; }
                p.fecha { color: #6b7280; margin-top: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 12px; }
                th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
                th { background: #f3f4f6; }
                .botones { margin-top: 20px; display: flex; gap: 12px; }
                button { padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; }
                .btn-print { background: #e5e7eb; color: #1f2937; }
                @media print { .botones { display: none; } }
            </style>
        </head>
        <body>
            <h1>Reporte de Historial de Tratamientos</h1>
            <p class="fecha">Generado el ${fecha} — SecureCore Plataforma de Riesgo</p>
            <p>Total de tratamientos incluidos: <strong>${datos.length}</strong></p>
            <table>
                <thead>
                    <tr>
                        <th>Riesgo</th><th>Control Aplicado</th><th>Estrategia</th><th>Antes</th><th>Después</th><th>Reducción</th><th>Fecha</th><th>Observaciones</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
            <div class="botones">
                <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
            </div>
        </body>
        </html>
    `);
    ventana.document.close();

    descargarExcelHistorial(datos);
}

function descargarExcelHistorial(datos) {
    if (typeof XLSX === 'undefined') {
        alert('No se pudo cargar la librería de Excel. Verifica tu conexión a internet.');
        return;
    }

    const datosExcel = datos.map(d => ({
        'Riesgo': d.nombreRiesgo,
        'Control Aplicado': d.nombreControl,
        'Estrategia': d.estrategia,
        'Antes': `${d.inherente} - ${d.nivelInherente}`,
        'Después': `${d.residual} - ${d.nivelResidual}`,
        'Reducción': d.reduccion > 0 ? `-${d.reduccion}%` : 'Sin cambio',
        'Fecha': d.fecha,
        'Observaciones': d.observaciones || 'N/A'
    }));

    const hoja = XLSX.utils.json_to_sheet(datosExcel);
    hoja['!cols'] = [
        { wch: 30 }, { wch: 26 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 40 }
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Historial');

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `Reporte_Historial_Tratamientos_SecureCore_${fechaArchivo}.xlsx`);
}

const linkReporteHistorial = document.getElementById('btnVerReporteHistorial');
if (linkReporteHistorial) {
    linkReporteHistorial.addEventListener('click', (e) => {
        e.preventDefault();
        generarReporteHistorial();
    });
}