/* ==========================================================================
   TRATAMIENTO.JS - Lógica de Pestañas, Mapeo ISO y Riesgo Residual
   ========================================================================= */

// 1. SISTEMA DE PESTAÑAS (TABS)
function switchTab(evt, tabId) {
    const contents = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');
    
    contents.forEach(c => c.classList.remove('active'));
    buttons.forEach(b => b.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');
}

// 2. MAPEO POR INTENCIÓN (Diccionario UX a ISO 27002)
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
    selectIntencion.addEventListener('change', function() {
        const intencionElegida = this.value;
        
        selectControlEspecifico.innerHTML = '<option value="">Selecciona la opción que mejor describa tu control...</option>';
        
        if (intencionElegida === "") {
            selectControlEspecifico.disabled = true;
        } else {
            selectControlEspecifico.disabled = false;
            const controlesAInyectar = diccionarioAmigable[intencionElegida];
            
            controlesAInyectar.forEach(control => {
                const nuevaOpcion = document.createElement('option');
                nuevaOpcion.value = control.id;
                nuevaOpcion.textContent = control.texto;
                selectControlEspecifico.appendChild(nuevaOpcion);
            });
        }
    });
}

// 3. CÁLCULO DE FUERZA DEL CONTROL (Pestaña 1)
const radiosControl = document.querySelectorAll('#tab-biblioteca input[type="radio"]');
const strengthLabel = document.getElementById('ctrl-strength-percent');

const calcularFuerzaControl = () => {
    const radioTipo = document.querySelector('input[name="c_tipo"]:checked');
    const radioExec = document.querySelector('input[name="c_exec"]:checked');
    const radioDoc = document.querySelector('input[name="c_doc"]:checked');

    if (!radioTipo || !radioExec || !radioDoc) return;

    const tipo = parseInt(radioTipo.value);
    const exec = parseInt(radioExec.value);
    const doc = parseInt(radioDoc.value);

    const eficacia = Math.round((tipo + exec + doc) / 3);
    strengthLabel.textContent = `Fuerza: ${eficacia}%`;
    strengthLabel.style.color = eficacia > 70 ? "#10b981" : eficacia > 40 ? "#ca8a04" : "#dc2626";

    document.getElementById('lbl-c-tipo').textContent = tipo === 100 ? "Preventivo" : tipo === 60 ? "Detectivo" : "Correctivo";
    document.getElementById('lbl-c-exec').textContent = exec === 100 ? "Automático" : exec === 50 ? "Semiautomático" : "Manual";
    document.getElementById('lbl-c-doc').textContent = doc === 100 ? "Formalizado" : doc === 50 ? "Parcial" : "Ninguno";
};

radiosControl.forEach(r => r.addEventListener('change', calcularFuerzaControl));

// 4. CÁLCULO DE RIESGO RESIDUAL (Pestaña 2)
const selectRiesgo = document.getElementById('select-riesgo');
const selectControlLib = document.getElementById('select-control-lib');
const resScore = document.getElementById('residual-score-inline');
const resLabel = document.getElementById('residual-label-inline');

const calcularResidual = () => {
    if (!selectRiesgo || !selectControlLib || !resScore || !resLabel) return;

    const inherente = parseInt(selectRiesgo.value);
    const eficaciaControl = parseFloat(selectControlLib.value);

    const residual = Math.max(1, Math.round(inherente * (1 - eficaciaControl)));
    
    resScore.textContent = residual;
    
    if (residual <= 4) {
        resLabel.className = "badge-impacto impacto-bajo";
        resLabel.textContent = "Nivel Bajo";
    } else if (residual <= 9) {
        resLabel.className = "badge-impacto impacto-medio";
        resLabel.textContent = "Nivel Medio";
    } else {
        resLabel.className = "badge-impacto impacto-alto";
        resLabel.textContent = "Nivel Alto";
    }
};

if (selectRiesgo) selectRiesgo.addEventListener('change', calcularResidual);
if (selectControlLib) selectControlLib.addEventListener('change', calcularResidual);

// Iniciar cálculos al cargar si los elementos existen
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('input[name="c_tipo"]:checked')) calcularFuerzaControl();
    if (selectRiesgo && selectControlLib) calcularResidual();
});