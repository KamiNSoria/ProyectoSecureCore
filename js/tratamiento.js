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
    await cargarBiblioteca();

    // Si venimos desde "+ Aplicar Tratamiento" de un riesgo específico
    const params = new URLSearchParams(window.location.search);
    const riesgoPreseleccionado = params.get('riesgo');
    if (riesgoPreseleccionado && selectRiesgo) {
        selectRiesgo.value = riesgoPreseleccionado;
        document.querySelector('.tab-btn[onclick*="tab-plan"]')?.click();
        calcularResidual();
    }
});

// --- 1. SISTEMA DE PESTAÑAS (TABS) ---
function switchTab(evt, tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');
}

// --- 2. MAPEO POR INTENCIÓN (Diccionario UX a ISO 27002) ---
const diccionarioAmigable = {
    accesos: [
        { id: "5.15", texto: "Gestión de Permisos y Cuentas (ISO 5.15 Control de acceso)" },
        { id: "8.2", texto: "Accesos de Administrador (ISO 8.2 Derechos de acceso privilegiado)" },
        { id: "8.5", texto: "Autenticación Segura / MFA (ISO 8.5 Autenticación segura)" }
    ],
    tecnologia: [
        { id: "8.8", texto: "Antivirus y Parches de Software (ISO 8.8 Gestión de vulnerabilidades)" },
        { id: "8.12", texto: "Bloqueo de fuga de datos o WAF (ISO 8.12 Prevención de fuga de datos)" },
        { id: "8.1", texto: "Proteger Laptops/Móviles de la empresa (ISO 8.1 Dispositivos finales)" }
    ],
    personas: [
        { id: "6.3", texto: "Charlas de seguridad y Phishing (ISO 6.3 Concienciación y formación)" },
        { id: "6.1", texto: "Revisión de antecedentes al contratar (ISO 6.1 Investigación de antecedentes)" }
    ],
    fisico: [
        { id: "7.1", texto: "Seguridad en puertas y edificios (ISO 7.1 Perímetros de seguridad física)" },
        { id: "7.4", texto: "Cámaras y Monitoreo de oficinas (ISO 7.4 Monitoreo de seguridad física)" }
    ],
    respaldos: [
        { id: "8.13", texto: "Copias de Seguridad en Nube/Local (ISO 8.13 Copias de seguridad)" },
        { id: "5.29", texto: "Plan de recuperación ante desastres (ISO 5.29 Seguridad durante interrupciones)" }
    ]
};

const selectIntencion = document.getElementById('intencion_usuario');
const selectControlEspecifico = document.getElementById('ctrl_iso');

if (selectIntencion && selectControlEspecifico) {
    selectIntencion.addEventListener('change', function () {
        const intencionElegida = this.value;
        selectControlEspecifico.innerHTML = '<option value="">Selecciona la opción que mejor describa tu control...</option>';
        if (intencionElegida === "") {
            selectControlEspecifico.disabled = true;
        } else {
            selectControlEspecifico.disabled = false;
            diccionarioAmigable[intencionElegida].forEach(control => {
                const opt = document.createElement('option');
                opt.value = control.id;
                opt.textContent = control.texto;
                selectControlEspecifico.appendChild(opt);
            });
        }
    });
}

// --- 3. CÁLCULO DE FUERZA DEL CONTROL (Pestaña 1) ---
const radiosControl = document.querySelectorAll('#tab-biblioteca input[type="radio"]');
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
const btnGuardarBiblioteca = document.querySelector('#tab-biblioteca .btn-primary-solid');

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
                document.querySelectorAll('#tab-biblioteca input[type="radio"]').forEach(r => r.checked = false);
                strengthLabel.textContent = 'Fuerza: 0%';
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
async function cargarBiblioteca() {
    const res = await fetch(`${API_BASE}/controles-empresa/`);
    bibliotecaControles = await res.json();

    const contenedor = document.getElementById('library-list');
    if (bibliotecaControles.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Aún no hay controles en la biblioteca. Crea uno en el formulario de la izquierda.</p>';
    } else {
        let html = '';
        bibliotecaControles.forEach(c => {
            const iso = catalogoISOTrat.find(i => i.id_control === c.id_iso_padre);
            html += `
                <div class="saved-risk-item">
                    <div class="sr-info">
                        <strong>${c.nombre_control}</strong>
                        <span>ISO ${c.id_iso_padre} - Eficacia: ${c.eficacia_porcentaje}%</span>
                    </div>
                    <div class="sr-score impacto-bajo">VINCULADO</div>
                </div>
            `;
        });
        contenedor.innerHTML = html;
    }

    pintarSelectControlLib();
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

const calcularResidual = () => {
    if (!selectRiesgo || !resScore || !resLabel) return null;
    const riesgo = catalogoRiesgosTrat.find(r => r.id_riesgo === parseInt(selectRiesgo.value));
    if (!riesgo) return null;

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
            return null;
        }
        const eficaciaControl = parseFloat(opcionControl.dataset.eficacia);
        residual = Math.max(1, Math.round(inherente * (1 - eficaciaControl)));
    }

    resScore.textContent = residual;
    const nivel = nivelYClasePorScoreTrat(residual);
    resLabel.className = `badge-impacto ${nivel.clase}`;
    resLabel.textContent = nivel.texto;

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
            contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Aún no se han aplicado tratamientos. Ve a "Plan de Tratamiento" para crear el primero.</p>';
            return;
        }

        // Ordenamos del más reciente al más antiguo
        tratamientos.sort((a, b) => new Date(b.fecha_actualizacion) - new Date(a.fecha_actualizacion));

        let html = '';
        tratamientos.forEach(t => {
            const riesgo = riesgos.find(r => r.id_riesgo === t.id_riesgo);
            const control = controles.find(c => c.id_control_emp === t.id_control_emp);
            const iso = control ? isoControles.find(i => i.id_control === control.id_iso_padre) : null;

            const inherente = riesgo ? (riesgo.score_inherente ?? (riesgo.nivel_probabilidad * riesgo.nivel_vulnerabilidad)) : '-';
            const nivelInherente = riesgo ? nivelYClasePorScoreTrat(inherente) : { clase: '', texto: 'N/A' };
            const nivelResidual = nivelYClasePorScoreTrat(t.score_residual);

            const fecha = t.fecha_actualizacion
                ? new Date(t.fecha_actualizacion).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'N/A';

            const reduccion = (riesgo && inherente > 0)
                ? Math.round(((inherente - t.score_residual) / inherente) * 100)
                : 0;

            html += `
                <div class="historial-item">
                    <div class="historial-item-top">
                        <div>
                            <strong>${riesgo ? riesgo.nombre_riesgo : 'Riesgo eliminado'}</strong>
                            <span class="historial-meta">${control ? control.nombre_control : 'Control no encontrado'} ${iso ? `(ISO ${iso.id_control})` : ''}</span>
                        </div>
                        <span class="tratamiento-estrategia-tag">${t.estrategia}</span>
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
    } catch (e) {
        console.error('Error al cargar historial:', e);
        contenedor.innerHTML = '<p style="color:red; font-size:13px;">Error al cargar el historial de tratamientos.</p>';
    }
}

// Cargamos el historial también cuando abre la página, y cada vez que se cambia a esa pestaña
document.addEventListener('DOMContentLoaded', cargarHistorialTratamientos);

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