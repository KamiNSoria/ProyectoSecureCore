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
    cargarRiesgosDesdeSQL();
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
function cargarRiesgosDesdeSQL() {
    fetch(`${API_BASE}/riesgos/`)
        .then(res => res.json())
        .then(datos => {
            riesgosGlobal = datos;
            pintarListaRiesgos(datos);
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
    if (score <= 4) return { clase: 'impacto-bajo', texto: 'BAJO' };
    if (score <= 9) return { clase: 'impacto-medio', texto: 'MEDIO' };
    if (score <= 16) return { clase: 'impacto-alto', texto: 'ALTO' };
    return { clase: 'impacto-critico', texto: 'CRÍTICO' };
}
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

    const contenedor = document.getElementById('lista-riesgos-container');
    document.getElementById('contadorRiesgos').textContent = `${datos.length} riesgo${datos.length !== 1 ? 's' : ''}`;

    if (datos.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Aún no hay riesgos registrados. Haz clic en "+ Registrar Nuevo Riesgo" para empezar.</p>';
        return;
    }

    let html = '';
    datos.forEach(r => {
        const score = r.score_inherente ?? (r.nivel_probabilidad * r.nivel_vulnerabilidad);
        const nivel = nivelYClasePorScore(score);
        const tieneTratamiento = idsConTratamiento.has(r.id_riesgo);

        html += `
            <div class="saved-risk-item">
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
}

// --- ABRIR/CERRAR FORMULARIO PRINCIPAL ---
const wrapperForm = document.getElementById('form-riesgo-wrapper');
const btnNuevoRiesgo = document.getElementById('btnNuevoRiesgo');
const btnCancelarRiesgo = document.getElementById('btnCancelarRiesgo');

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

btnNuevoRiesgo.addEventListener('click', () => {
    resetFormularioRiesgo();
    wrapperForm.classList.remove('hidden');
    wrapperForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

btnCancelarRiesgo.addEventListener('click', () => {
    wrapperForm.classList.add('hidden');
    resetFormularioRiesgo();
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

    document.querySelectorAll('.hm-cell').forEach(c => c.classList.remove('cell-active'));
    const celdaObjetivo = document.querySelector(`.hm-r-${impactoNivel}.hm-c-${probNivel}`);
    if (celdaObjetivo) celdaObjetivo.classList.add('cell-active');

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
        wrapperForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
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