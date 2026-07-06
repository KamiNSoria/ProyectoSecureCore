/* ==========================================================================
   ANALISIS.JS - Riesgos derivados de Amenaza + Vulnerabilidad (conexión SQL)
   ========================================================================= */

const API_BASE = 'http://127.0.0.1:8000/api';

let catalogoAmenazas = [];
let catalogoVulnerabilidades = [];
let catalogoActivosRiesgo = [];
let riesgosGlobal = [];
let idRiesgoEditar = null;

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([cargarAmenazas(), cargarVulnerabilidades(), cargarActivosParaSelect()]);
    activarFiltroTratado();
    activarSeleccionHeatmap();

    // Accesos directos desde el Panel (KPIs / Acciones Rápidas)
    const paramsUrl = new URLSearchParams(window.location.search);
    const filtroSolicitado = paramsUrl.get('filtro'); // 'tratado' | 'no-tratado'
    if (filtroSolicitado) {
        const valorRadio = filtroSolicitado === 'no-tratado' ? 'no' : filtroSolicitado === 'tratado' ? 'si' : 'todos';
        const radio = document.querySelector(`input[name="filtro-tratado"][value="${valorRadio}"]`);
        if (radio) {
            radio.checked = true;
            filtroTratado = valorRadio;
        }
    }

    cargarRiesgosDesdeSQL();

    if (paramsUrl.get('accion') === 'nuevo') {
        btnNuevoRiesgo.click();
    }
});

// --- CARGA DE CATÁLOGOS ---
async function cargarAmenazas() {
    try {
        const res = await fetch(`${API_BASE}/amenazas/`);
        catalogoAmenazas = await res.json();
        const select = document.getElementById('in-riesgo-amenaza');
        let html = '<option value="" disabled selected>Selecciona una amenaza...</option>';
        catalogoAmenazas.forEach(a => {
            html += `<option value="${a.id_amenaza}">${a.nombre_amenaza}</option>`;
        });
        html += '<option value="otro">Otro (especificar)</option>';
        select.innerHTML = html;
    } catch (e) {
        console.error('Error cargando amenazas:', e);
    }
}

async function cargarVulnerabilidades() {
    try {
        const res = await fetch(`${API_BASE}/vulnerabilidades/`);
        catalogoVulnerabilidades = await res.json();
        const select = document.getElementById('in-riesgo-vulnerabilidad');
        let html = '<option value="" disabled selected>Selecciona una vulnerabilidad...</option>';
        catalogoVulnerabilidades.forEach(v => {
            html += `<option value="${v.id_vulnerabilidad}">${v.nombre_vulnerabilidad}</option>`;
        });
        html += '<option value="otro">Otro (especificar)</option>';
        select.innerHTML = html;
    } catch (e) {
        console.error('Error cargando vulnerabilidades:', e);
    }
}

async function cargarActivosParaSelect() {
    try {
        const res = await fetch(`${API_BASE}/activos/`);
        catalogoActivosRiesgo = await res.json();
        const select = document.getElementById('in-riesgo-activo');
        let html = '<option value="" disabled selected>Selecciona un activo...</option>';
        catalogoActivosRiesgo.forEach(a => {
            html += `<option value="${a.id_activo}">#ACT-${a.id_activo} - ${a.nombre_activo}</option>`;
        });
        select.innerHTML = html;
    } catch (e) {
        console.error('Error cargando activos:', e);
    }
}

// --- Mostrar/ocultar input "otro" ---
document.getElementById('in-riesgo-amenaza').addEventListener('change', (e) => {
    document.getElementById('in-riesgo-amenaza-otro').classList.toggle('hidden', e.target.value !== 'otro');
});
document.getElementById('in-riesgo-vulnerabilidad').addEventListener('change', (e) => {
    document.getElementById('in-riesgo-vulnerabilidad-otro').classList.toggle('hidden', e.target.value !== 'otro');
});

// --- CARGAR Y PINTAR LISTA DE RIESGOS ---
let reporteAutoDisparado = false; // Evita re-disparar el reporte automático en recargas posteriores

function cargarRiesgosDesdeSQL() {
    fetch(`${API_BASE}/riesgos/`)
        .then(res => res.json())
        .then(datos => {
            riesgosGlobal = datos;
            pintarListaRiesgos(datos);
            actualizarHeatmapRiesgos(datos);

            // Acceso directo desde el Panel: analisis.html?accion=reporte genera el reporte automáticamente
            if (!reporteAutoDisparado && new URLSearchParams(window.location.search).get('accion') === 'reporte') {
                reporteAutoDisparado = true;
                generarReporteRiesgos();
            }
        })
        .catch(err => {
            console.error('Error al cargar riesgos:', err);
            document.getElementById('lista-riesgos-container').innerHTML =
                '<p style="color:red;">Error al cargar los riesgos.</p>';
        });
}

function nombreActivoPorId(id) {
    const a = catalogoActivosRiesgo.find(x => x.id_activo === id);
    return a ? `#ACT-${a.id_activo} - ${a.nombre_activo}` : `#ACT-${id}`;
}

function nombreAmenazaRiesgo(r) {
    if (r.amenaza_otro) return r.amenaza_otro;
    const a = catalogoAmenazas.find(x => x.id_amenaza === r.id_amenaza);
    return a ? a.nombre_amenaza : 'N/A';
}

function nombreVulnerabilidadRiesgo(r) {
    if (r.vulnerabilidad_otro) return r.vulnerabilidad_otro;
    const v = catalogoVulnerabilidades.find(x => x.id_vulnerabilidad === r.id_vulnerabilidad_cat);
    return v ? v.nombre_vulnerabilidad : 'N/A';
}

function nivelYClasePorScore(score) {
    if (score <= 4) return { clase: 'impacto-bajo', texto: 'BAJO', clave: 'bajo' };
    if (score <= 9) return { clase: 'impacto-medio', texto: 'MEDIO', clave: 'medio' };
    if (score <= 16) return { clase: 'impacto-alto', texto: 'ALTO', clave: 'alto' };
    return { clase: 'impacto-critico', texto: 'CRÍTICO', clave: 'critico' };
}
let idsConTratamientoGlobal = new Set();

async function pintarListaRiesgos(datos) {
    // Traemos los tratamientos ya aplicados para saber qué riesgos ya tienen control
    let idsConTratamiento = new Set();
    try {
        const resTrat = await fetch(`${API_BASE}/tratamientos/`);
        const tratamientos = await resTrat.json();
        idsConTratamiento = new Set(tratamientos.map(t => t.id_riesgo));
    } catch (e) {
        console.error('No se pudo verificar tratamientos existentes:', e);
    }
    idsConTratamientoGlobal = idsConTratamiento;

    const contenedor = document.getElementById('lista-riesgos-container');
    document.getElementById('contadorRiesgos').textContent = `${datos.length} riesgo${datos.length !== 1 ? 's' : ''}`;

    if (datos.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Aún no hay riesgos registrados. Haz clic en "+ Registrar Nuevo Riesgo" para empezar.</p>';
        actualizarConteosTratamiento(datos, idsConTratamiento);
        return;
    }

    let html = '';
    datos.forEach(r => {
        const score = r.score_inherente ?? (r.nivel_probabilidad * r.nivel_vulnerabilidad);
        const nivel = nivelYClasePorScore(score);
        const tieneTratamiento = idsConTratamiento.has(r.id_riesgo);

        html += `
            <div class="saved-risk-item" data-tratado="${tieneTratamiento ? 'si' : 'no'}" data-imp="${r.nivel_vulnerabilidad}" data-prob="${r.nivel_probabilidad}">
                <div class="sr-info" style="cursor:pointer;" onclick="prepararEditarRiesgo(${r.id_riesgo})">
                    <strong>${r.nombre_riesgo} ${tieneTratamiento ? '<span class="badge-tratado"><i class=\'bx bx-check-shield\'></i> Tratado</span>' : ''}</strong>
                    <span>${nombreActivoPorId(r.id_activo)}</span>
                    <span style="color:#6366f1;"><i class='bx bx-skull'></i> ${nombreAmenazaRiesgo(r)} &nbsp;|&nbsp; <i class='bx bx-bug'></i> ${nombreVulnerabilidadRiesgo(r)}</span>
                </div>
                <div class="sr-actions">
                    <div class="sr-score ${nivel.clase}">${score} - ${nivel.texto}</div>
                    <button class="btn-tratamiento" onclick="window.location.href='tratamiento.html?riesgo=${r.id_riesgo}'">
                        <i class='bx bx-shield-quarter'></i> ${tieneTratamiento ? 'Ver Tratamiento' : 'Tratamiento'}
                    </button>
                </div>
            </div>
        `;
    });
    contenedor.innerHTML = html;

    actualizarConteosTratamiento(datos, idsConTratamiento);
    aplicarFiltrosRiesgos();
}

// --- FILTROS COMBINABLES: ESTADO DE TRATAMIENTO (IZQUIERDA) + CELDA DEL MAPA DE CALOR ---
let filtroTratado = 'todos'; // 'todos' | 'si' | 'no'
let celdaSeleccionada = null; // { imp, prob } o null

function obtenerFiltroTratadoActual() {
    const radioMarcado = document.querySelector('input[name="filtro-tratado"]:checked');
    return radioMarcado ? radioMarcado.value : 'todos';
}

function aplicarFiltrosRiesgos() {
    const items = document.querySelectorAll('.saved-risk-item');
    let visibles = 0;
    items.forEach(item => {
        const coincideTratado = (filtroTratado === 'todos') || (item.getAttribute('data-tratado') === filtroTratado);
        const coincideCelda = !celdaSeleccionada ||
            (item.getAttribute('data-imp') === celdaSeleccionada.imp && item.getAttribute('data-prob') === celdaSeleccionada.prob);
        const visible = coincideTratado && coincideCelda;
        item.style.display = visible ? 'flex' : 'none';
        if (visible) visibles++;
    });
    document.getElementById('contadorRiesgos').textContent = `${visibles} riesgo${visibles !== 1 ? 's' : ''}`;
}

function activarFiltroTratado() {
    document.querySelectorAll('input[name="filtro-tratado"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            filtroTratado = e.target.value;
            aplicarFiltrosRiesgos();
        });
    });
}

function actualizarConteosTratamiento(datos, idsConTratamiento) {
    let tratados = 0;
    datos.forEach(r => { if (idsConTratamiento.has(r.id_riesgo)) tratados++; });
    const spanSi = document.getElementById('count-tratado-si');
    const spanNo = document.getElementById('count-tratado-no');
    if (spanSi) spanSi.textContent = `(${tratados})`;
    if (spanNo) spanNo.textContent = `(${datos.length - tratados})`;
}

// --- MAPA DE CALOR: MUESTRA CUÁNTOS RIESGOS REALES CAEN EN CADA CASILLA Y PERMITE FILTRAR AL HACER CLIC ---
function actualizarHeatmapRiesgos(datos) {
    const conteoCeldas = {};
    datos.forEach(r => {
        const clave = `${r.nivel_vulnerabilidad}-${r.nivel_probabilidad}`;
        conteoCeldas[clave] = (conteoCeldas[clave] || 0) + 1;
    });

    document.querySelectorAll('.hm-cell').forEach(celda => {
        const fila = [...celda.classList].find(c => c.startsWith('hm-r-')).replace('hm-r-', '');
        const columna = [...celda.classList].find(c => c.startsWith('hm-c-')).replace('hm-c-', '');
        const cantidad = conteoCeldas[`${fila}-${columna}`] || 0;
        celda.textContent = cantidad;
        celda.title = `${cantidad} riesgo${cantidad !== 1 ? 's' : ''} registrado${cantidad !== 1 ? 's' : ''} — clic para filtrar`;
        celda.classList.toggle('tiene-riesgos', cantidad > 0);
    });
}

// Permite hacer clic en una celda del mapa de calor para filtrar la lista por esa combinación Probabilidad x Impacto
function activarSeleccionHeatmap() {
    document.querySelectorAll('.hm-cell').forEach(celda => {
        celda.addEventListener('click', () => {
            const fila = [...celda.classList].find(c => c.startsWith('hm-r-')).replace('hm-r-', '');
            const columna = [...celda.classList].find(c => c.startsWith('hm-c-')).replace('hm-c-', '');
            const esLaMismaCelda = celdaSeleccionada && celdaSeleccionada.imp === fila && celdaSeleccionada.prob === columna;

            document.querySelectorAll('.hm-cell').forEach(c => c.classList.remove('hm-cell-seleccionada'));

            if (esLaMismaCelda) {
                celdaSeleccionada = null;
            } else {
                celdaSeleccionada = { imp: fila, prob: columna };
                celda.classList.add('hm-cell-seleccionada');
            }
            aplicarFiltrosRiesgos();
        });
    });
}

// --- ABRIR/CERRAR MODAL PRINCIPAL ---
const wrapperForm = document.getElementById('modalNuevoRiesgo');
const btnNuevoRiesgo = document.getElementById('btnNuevoRiesgo');
const btnCancelarRiesgo = document.getElementById('btnCancelarRiesgo');
const btnCerrarModalRiesgo = document.getElementById('btnCerrarModalRiesgo');

function resetFormularioRiesgo() {
    idRiesgoEditar = null;
    document.getElementById('in-id-riesgo').value = '';
    document.getElementById('form-riesgo-titulo').textContent = 'Ingreso de Datos del Riesgo';
    document.getElementById('btnGuardarRiesgo').textContent = 'Guardar Evaluación de Riesgo';
    document.getElementById('btnEliminarRiesgo').classList.add('hidden');
    document.getElementById('in-riesgo-nombre').value = '';
    document.getElementById('in-riesgo-descripcion').value = '';
    document.getElementById('in-riesgo-activo').selectedIndex = 0;
    document.getElementById('in-riesgo-amenaza').selectedIndex = 0;
    document.getElementById('in-riesgo-vulnerabilidad').selectedIndex = 0;
    document.getElementById('in-riesgo-amenaza-otro').value = '';
    document.getElementById('in-riesgo-amenaza-otro').classList.add('hidden');
    document.getElementById('in-riesgo-vulnerabilidad-otro').value = '';
    document.getElementById('in-riesgo-vulnerabilidad-otro').classList.add('hidden');
    document.querySelectorAll('input[name^="impact_"][value="3"]').forEach(r => r.checked = true);
    document.querySelector('input[name="prob_radio"][value="3"]').checked = true;
    actualizarEvaluacionRiesgo();
}

const cerrarModalRiesgo = () => {
    wrapperForm.classList.add('hidden');
    resetFormularioRiesgo();
};

btnNuevoRiesgo.addEventListener('click', () => {
    resetFormularioRiesgo();
    wrapperForm.classList.remove('hidden');
});

btnCancelarRiesgo.addEventListener('click', cerrarModalRiesgo);
btnCerrarModalRiesgo.addEventListener('click', cerrarModalRiesgo);

wrapperForm.addEventListener('click', (evento) => {
    if (evento.target === wrapperForm) cerrarModalRiesgo();
});

// --- 1. ACORDEONES INTERNOS (impacto / probabilidad) ---
const triggers = document.querySelectorAll('.collapsible-trigger');
triggers.forEach(trigger => {
    trigger.addEventListener('click', function() {
        this.classList.toggle('open');
        const targetId = this.getAttribute('data-target');
        const content = document.getElementById(targetId);
        if (content.style.display === "block") {
            content.style.opacity = "0";
            content.style.transform = "translateY(-5px)";
            setTimeout(() => content.style.display = "none", 250);
        } else {
            content.style.display = "block";
            setTimeout(() => {
                content.style.opacity = "1";
                content.style.transform = "translateY(0)";
            }, 10);
        }
    });
});

// --- 2. MAPAS DE TEXTO ---
const probTextMap = {
    "1": "1 - Posible (20%)", "2": "2 - Improbable (40%)", "3": "3 - Ocasional (60%)",
    "4": "4 - Probable (80%)", "5": "5 - Frecuente (100%)"
};
const impactTextMap = {
    "1": "1 - Marginal (20%)", "2": "2 - Menor (40%)", "3": "3 - Moderado (60%)",
    "4": "4 - Mayor (80%)", "5": "5 - Catastrófico (100%)"
};

// --- 3. CÁLCULO DEL RIESGO ---
const scoreTextInline = document.getElementById('risk-score-inline');
const labelTextInline = document.getElementById('risk-label-inline');
const impactAvgNumber = document.getElementById('impact-avg-number');
const impactAvgText = document.getElementById('impact-avg-text');
const lblProb = document.getElementById('lbl-prob');

const actualizarEvaluacionRiesgo = () => {
    const valLegal = parseInt(document.querySelector('input[name="impact_legal"]:checked').value);
    document.getElementById('lbl-imp-legal').textContent = impactTextMap[valLegal];

    const valRep = parseInt(document.querySelector('input[name="impact_reputational"]:checked').value);
    document.getElementById('lbl-imp-reputational').textContent = impactTextMap[valRep];

    const valOp = parseInt(document.querySelector('input[name="impact_operational"]:checked').value);
    document.getElementById('lbl-imp-operational').textContent = impactTextMap[valOp];

    const valFin = parseInt(document.querySelector('input[name="impact_financial"]:checked').value);
    document.getElementById('lbl-imp-financial').textContent = impactTextMap[valFin];

    const impactoNivel = Math.round((valLegal + valRep + valOp + valFin) / 4);
    impactAvgNumber.textContent = impactoNivel;

    let claseImpAvg = "", textoImpAvg = "";
    if (impactoNivel === 1) { claseImpAvg = "impacto-bajo"; textoImpAvg = "Marginal"; }
    else if (impactoNivel === 2) { claseImpAvg = "impacto-bajo"; textoImpAvg = "Menor"; }
    else if (impactoNivel === 3) { claseImpAvg = "impacto-medio"; textoImpAvg = "Moderado"; }
    else if (impactoNivel === 4) { claseImpAvg = "impacto-alto"; textoImpAvg = "Mayor"; }
    else { claseImpAvg = "impacto-critico"; textoImpAvg = "Catastrófico"; }
    impactAvgText.className = `badge-impacto ${claseImpAvg}`;
    impactAvgText.textContent = textoImpAvg;

    const probNivel = parseInt(document.querySelector('input[name="prob_radio"]:checked').value);
    lblProb.textContent = probTextMap[probNivel];

    const riesgoTotal = probNivel * impactoNivel;
    scoreTextInline.textContent = riesgoTotal;

    const nivel = nivelYClasePorScore(riesgoTotal);
    labelTextInline.className = `badge-impacto ${nivel.clase}`;
    labelTextInline.textContent = `Nivel ${nivel.texto.charAt(0) + nivel.texto.slice(1).toLowerCase()}`;

    // Vista previa mini dentro del modal: resalta dónde caería este riesgo en la matriz
    document.querySelectorAll('#heatmap-mini-grid .hm-mini-cell').forEach(c => c.classList.remove('cell-active'));
    const celdaMiniObjetivo = document.querySelector(`#heatmap-mini-grid .hm-r-${impactoNivel}.hm-c-${probNivel}`);
    if (celdaMiniObjetivo) celdaMiniObjetivo.classList.add('cell-active');

    return { probNivel, impactoNivel, riesgoTotal };
};

document.querySelectorAll('input[name="prob_radio"]').forEach(r => r.addEventListener('change', actualizarEvaluacionRiesgo));
document.querySelectorAll('.impact-calc-group input[type="radio"]').forEach(r => r.addEventListener('change', actualizarEvaluacionRiesgo));

// --- 4. GUARDAR (POST/PUT) ---
document.getElementById('btnGuardarRiesgo').addEventListener('click', async () => {
    const nombre = document.getElementById('in-riesgo-nombre').value.trim();
    const idActivo = document.getElementById('in-riesgo-activo').value;
    const selAmenaza = document.getElementById('in-riesgo-amenaza').value;
    const selVulnerabilidad = document.getElementById('in-riesgo-vulnerabilidad').value;

    if (!nombre || !idActivo || !selAmenaza || !selVulnerabilidad) {
        alert('Completa Nombre, Activo, Amenaza y Vulnerabilidad antes de guardar.');
        return;
    }

    const { probNivel, impactoNivel, riesgoTotal } = actualizarEvaluacionRiesgo();

    const payload = {
        nombre_riesgo: nombre,
        descripcion: document.getElementById('in-riesgo-descripcion').value,
        id_activo: parseInt(idActivo),
        id_amenaza: selAmenaza === 'otro' ? null : parseInt(selAmenaza),
        amenaza_otro: selAmenaza === 'otro' ? document.getElementById('in-riesgo-amenaza-otro').value : null,
        id_vulnerabilidad_cat: selVulnerabilidad === 'otro' ? null : parseInt(selVulnerabilidad),
        vulnerabilidad_otro: selVulnerabilidad === 'otro' ? document.getElementById('in-riesgo-vulnerabilidad-otro').value : null,
        nivel_probabilidad: probNivel,
        nivel_vulnerabilidad: impactoNivel, // Guarda el promedio de impacto (L,R,O,F)
        score_inherente: riesgoTotal
    };

    let url = `${API_BASE}/riesgos/`;
    let metodo = 'POST';
    if (idRiesgoEditar !== null) {
        url = `${API_BASE}/riesgos/${idRiesgoEditar}/`;
        metodo = 'PUT';
    }

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert(idRiesgoEditar !== null ? '¡Riesgo actualizado!' : '¡Riesgo registrado!');
            wrapperForm.classList.add('hidden');
            resetFormularioRiesgo();
            cargarRiesgosDesdeSQL();
        } else {
            const err = await res.json();
            console.error(err);
            alert('Error al guardar el riesgo. Revisa los datos.');
        }
    } catch (e) {
        console.error(e);
        alert('No se pudo conectar con el servidor.');
    }
});

// --- 5. EDITAR ---
async function prepararEditarRiesgo(id) {
    try {
        const res = await fetch(`${API_BASE}/riesgos/${id}/`);
        const r = await res.json();

        idRiesgoEditar = id;
        document.getElementById('in-id-riesgo').value = id;
        document.getElementById('form-riesgo-titulo').textContent = 'Modificar Riesgo';
        document.getElementById('btnGuardarRiesgo').textContent = 'Actualizar Riesgo';
        document.getElementById('btnEliminarRiesgo').classList.remove('hidden');
        document.getElementById('btnEliminarRiesgo').onclick = () => eliminarRiesgo(id);

        document.getElementById('in-riesgo-nombre').value = r.nombre_riesgo;
        document.getElementById('in-riesgo-descripcion').value = r.descripcion || '';
        document.getElementById('in-riesgo-activo').value = r.id_activo;

        if (r.amenaza_otro) {
            document.getElementById('in-riesgo-amenaza').value = 'otro';
            document.getElementById('in-riesgo-amenaza-otro').value = r.amenaza_otro;
            document.getElementById('in-riesgo-amenaza-otro').classList.remove('hidden');
        } else {
            document.getElementById('in-riesgo-amenaza').value = r.id_amenaza;
        }

        if (r.vulnerabilidad_otro) {
            document.getElementById('in-riesgo-vulnerabilidad').value = 'otro';
            document.getElementById('in-riesgo-vulnerabilidad-otro').value = r.vulnerabilidad_otro;
            document.getElementById('in-riesgo-vulnerabilidad-otro').classList.remove('hidden');
        } else {
            document.getElementById('in-riesgo-vulnerabilidad').value = r.id_vulnerabilidad_cat;
        }

        document.querySelector(`input[name="prob_radio"][value="${r.nivel_probabilidad}"]`).checked = true;
        // Repartimos el promedio de impacto guardado en las 4 categorías por igual (aproximación)
        document.querySelectorAll(`input[name^="impact_"][value="${r.nivel_vulnerabilidad}"]`).forEach(el => el.checked = true);

        actualizarEvaluacionRiesgo();

        wrapperForm.classList.remove('hidden');
    } catch (e) {
        console.error('Error al preparar edición:', e);
        alert('No se pudo cargar el riesgo para editar.');
    }
}

// --- 6. ELIMINAR ---
async function eliminarRiesgo(id) {
    if (!confirm('¿Eliminar este riesgo? Esta acción no se puede deshacer.')) return;
    try {
        const res = await fetch(`${API_BASE}/riesgos/${id}/`, { method: 'DELETE' });
        if (res.ok) {
            alert('Riesgo eliminado.');
            wrapperForm.classList.add('hidden');
            resetFormularioRiesgo();
            cargarRiesgosDesdeSQL();
        } else {
            alert('No se pudo eliminar el riesgo.');
        }
    } catch (e) {
        console.error(e);
        alert('Error de conexión al eliminar.');
    }
}

// --- 7. INICIALIZACIÓN ---
actualizarEvaluacionRiesgo();

/* ==========================================================================
   MEJORAS CONCEPTUALES: Banner de riesgo activo + Controles ISO sugeridos
   ========================================================================= */

// Mapeo Amenaza (por ID de tu catálogo) -> Controles ISO recomendados
const mapeoAmenazaControlesISO = {
    1: ['5.15', '5.16', '5.17', '5.18', '8.2', '8.5'],   // Acceso no autorizado
    2: ['8.7', '8.8', '8.13', '5.26'],                    // Malware / Ransomware
    3: ['6.3', '5.26', '8.23'],                           // Phishing / Ingeniería social
    4: ['7.8', '7.13', '8.13', '8.14'],                   // Falla de hardware
    5: ['7.5', '5.29', '5.30', '8.14'],                   // Desastre natural
    6: ['6.3', '5.37', '8.32']                            // Error humano
};

let catalogoISOparaAnalisis = [];

async function cargarCatalogoISOparaAnalisis() {
    try {
        const res = await fetch(`${API_BASE}/catalogo-iso/`);
        catalogoISOparaAnalisis = await res.json();
    } catch (e) {
        console.error('Error cargando catálogo ISO:', e);
    }
}

function actualizarControlesRecomendados() {
    const box = document.getElementById('controles-recomendados-box');
    const lista = document.getElementById('recomendados-lista');
    const selAmenaza = document.getElementById('in-riesgo-amenaza').value;

    if (!selAmenaza || selAmenaza === 'otro' || catalogoISOparaAnalisis.length === 0) {
        box.classList.add('hidden');
        return;
    }

    const idsRecomendados = mapeoAmenazaControlesISO[parseInt(selAmenaza)];
    if (!idsRecomendados) {
        box.classList.add('hidden');
        return;
    }

    const controles = catalogoISOparaAnalisis.filter(c => idsRecomendados.includes(c.id_control));
    lista.innerHTML = controles.map(c =>
        `<span class="chip-recomendado">${c.id_control} - ${c.titulo_control}</span>`
    ).join('');

    box.classList.remove('hidden');
}

function actualizarBannerRiesgo() {
    const nombre = document.getElementById('in-riesgo-nombre').value.trim();
    const banner = document.getElementById('banner-riesgo-actual');
    const nombreSpan = document.getElementById('banner-riesgo-nombre');

    if (nombre.length > 0) {
        nombreSpan.textContent = nombre;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarCatalogoISOparaAnalisis();

    document.getElementById('in-riesgo-nombre').addEventListener('input', actualizarBannerRiesgo);
    document.getElementById('in-riesgo-amenaza').addEventListener('change', actualizarControlesRecomendados);
    document.getElementById('in-riesgo-vulnerabilidad').addEventListener('change', actualizarControlesRecomendados);
});

// Nos aseguramos de que al abrir "Editar" también se actualice el banner
const _prepararEditarRiesgoOriginal = prepararEditarRiesgo;
prepararEditarRiesgo = async function (id) {
    await _prepararEditarRiesgoOriginal(id);
    actualizarBannerRiesgo();
    actualizarControlesRecomendados();
};

const _resetFormularioRiesgoOriginal = resetFormularioRiesgo;
resetFormularioRiesgo = function () {
    _resetFormularioRiesgoOriginal();
    document.getElementById('banner-riesgo-actual').classList.add('hidden');
    document.getElementById('controles-recomendados-box').classList.add('hidden');
};

/* ==========================================================================
   GENERAR REPORTE DE RIESGOS (Vista + Descarga Excel), igual que en Activos
   ========================================================================== */
function generarReporteRiesgos() {
    if (!riesgosGlobal || riesgosGlobal.length === 0) {
        alert('No hay riesgos registrados para generar el reporte.');
        return;
    }

    const fecha = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' });

    let filas = '';
    riesgosGlobal.forEach(r => {
        const score = r.score_inherente ?? (r.nivel_probabilidad * r.nivel_vulnerabilidad);
        const nivel = nivelYClasePorScore(score);
        const tratado = idsConTratamientoGlobal.has(r.id_riesgo);

        filas += `
            <tr>
                <td>#RSK-${r.id_riesgo}</td>
                <td>${r.nombre_riesgo}</td>
                <td>${nombreActivoPorId(r.id_activo)}</td>
                <td>${nombreAmenazaRiesgo(r)}</td>
                <td>${nombreVulnerabilidadRiesgo(r)}</td>
                <td>${r.nivel_probabilidad}</td>
                <td>${r.nivel_vulnerabilidad}</td>
                <td><strong>${score} - ${nivel.texto}</strong></td>
                <td>${tratado ? 'Tratado' : 'No Tratado'}</td>
                <td>${r.descripcion || 'N/A'}</td>
            </tr>
        `;
    });

    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <html>
        <head>
            <title>Reporte de Riesgos - SecureCore</title>
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
            <h1>Reporte de Análisis de Riesgos</h1>
            <p class="fecha">Generado el ${fecha} — SecureCore Plataforma de Riesgo</p>
            <p>Total de riesgos registrados: <strong>${riesgosGlobal.length}</strong></p>
            <table>
                <thead>
                    <tr>
                        <th>ID</th><th>Riesgo</th><th>Activo Afectado</th><th>Amenaza</th><th>Vulnerabilidad</th>
                        <th>Probabilidad</th><th>Impacto</th><th>Riesgo Inherente</th><th>Tratamiento</th><th>Descripción</th>
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

    descargarExcelRiesgos();
}

function descargarExcelRiesgos() {
    if (typeof XLSX === 'undefined') {
        alert('No se pudo cargar la librería de Excel. Verifica tu conexión a internet.');
        return;
    }

    const datosExcel = riesgosGlobal.map(r => {
        const score = r.score_inherente ?? (r.nivel_probabilidad * r.nivel_vulnerabilidad);
        const nivel = nivelYClasePorScore(score);
        const tratado = idsConTratamientoGlobal.has(r.id_riesgo);

        return {
            'ID': `#RSK-${r.id_riesgo}`,
            'Riesgo': r.nombre_riesgo,
            'Activo Afectado': nombreActivoPorId(r.id_activo),
            'Amenaza': nombreAmenazaRiesgo(r),
            'Vulnerabilidad': nombreVulnerabilidadRiesgo(r),
            'Probabilidad': r.nivel_probabilidad,
            'Impacto': r.nivel_vulnerabilidad,
            'Riesgo Inherente': `${score} - ${nivel.texto}`,
            'Tratamiento': tratado ? 'Tratado' : 'No Tratado',
            'Descripción': r.descripcion || 'N/A'
        };
    });

    const hoja = XLSX.utils.json_to_sheet(datosExcel);
    hoja['!cols'] = [
        { wch: 8 }, { wch: 30 }, { wch: 26 }, { wch: 20 }, { wch: 20 },
        { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 40 }
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Riesgos');

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `Reporte_Riesgos_SecureCore_${fechaArchivo}.xlsx`);
}

const linkReporteRiesgos = document.getElementById('btnVerReporteRiesgos');
if (linkReporteRiesgos) {
    linkReporteRiesgos.addEventListener('click', (e) => {
        e.preventDefault();
        generarReporteRiesgos();
    });
}