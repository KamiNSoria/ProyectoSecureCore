/* ==========================================================================
   ANALISIS.JS - Lógica con etiquetas dinámicas y matriz a la derecha
   ========================================================================= */

// --- 1. LÓGICA DE ACORDEONES MÚLTIPLES ---
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

// --- 2. MAPAS DE TEXTO PARA ETIQUETAS DINÁMICAS ---
const probTextMap = {
    "1": "1 - Posible (20%)",
    "2": "2 - Improbable (40%)",
    "3": "3 - Ocasional (60%)",
    "4": "4 - Probable (80%)",
    "5": "5 - Frecuente (100%)"
};

const impactTextMap = {
    "1": "1 - Marginal (20%)",
    "2": "2 - Menor (40%)",
    "3": "3 - Moderado (60%)",
    "4": "4 - Mayor (80%)",
    "5": "5 - Catastrófico (100%)"
};

// --- 3. LÓGICA DE CÁLCULO NUMÉRICO (MATRIZ INTERACTIVA) ---
const scoreTextInline = document.getElementById('risk-score-inline');
const labelTextInline = document.getElementById('risk-label-inline');
const impactAvgNumber = document.getElementById('impact-avg-number');
const impactAvgText = document.getElementById('impact-avg-text');
const lblProb = document.getElementById('lbl-prob');

const actualizarEvaluacionRiesgo = () => {
    
    // A. ACTUALIZAR ETIQUETAS Y CALCULAR PROMEDIO DE IMPACTO
    const radLegal = document.querySelector('input[name="impact_legal"]:checked');
    const valLegal = parseInt(radLegal.value);
    document.getElementById('lbl-imp-legal').textContent = impactTextMap[valLegal];

    const radRep = document.querySelector('input[name="impact_reputational"]:checked');
    const valRep = parseInt(radRep.value);
    document.getElementById('lbl-imp-reputational').textContent = impactTextMap[valRep];

    const radOp = document.querySelector('input[name="impact_operational"]:checked');
    const valOp = parseInt(radOp.value);
    document.getElementById('lbl-imp-operational').textContent = impactTextMap[valOp];

    const radFin = document.querySelector('input[name="impact_financial"]:checked');
    const valFin = parseInt(radFin.value);
    document.getElementById('lbl-imp-financial').textContent = impactTextMap[valFin];

    const sumaImpacto = valLegal + valRep + valOp + valFin;
    const promedioImpactoRaw = sumaImpacto / 4;
    const impactoNivel = Math.round(promedioImpactoRaw); 

    impactAvgNumber.textContent = impactoNivel; 

    let claseImpAvg = "";
    let textoImpAvg = "";
    
    if (impactoNivel === 1) { claseImpAvg = "impacto-bajo"; textoImpAvg = "Marginal"; }
    else if (impactoNivel === 2) { claseImpAvg = "impacto-bajo"; textoImpAvg = "Menor"; }
    else if (impactoNivel === 3) { claseImpAvg = "impacto-medio"; textoImpAvg = "Moderado"; }
    else if (impactoNivel === 4) { claseImpAvg = "impacto-alto"; textoImpAvg = "Mayor"; }
    else { claseImpAvg = "impacto-critico"; textoImpAvg = "Catastrófico"; }

    impactAvgText.className = `badge-impacto ${claseImpAvg}`;
    impactAvgText.textContent = textoImpAvg;

    // B. OBTENCIÓN DE PROBABILIDAD Y ACTUALIZACIÓN DE ETIQUETA
    const probRadioSelected = document.querySelector('input[name="prob_radio"]:checked');
    const probNivel = parseInt(probRadioSelected.value);
    lblProb.textContent = probTextMap[probNivel];

    // C. CÁLCULO DEL RIESGO TOTAL (P x I)
    const riesgoTotal = probNivel * impactoNivel;
    scoreTextInline.textContent = riesgoTotal;

    let claseColorFinal = "";
    let textoFinal = "";
    labelTextInline.className = "badge-impacto"; 

    if (riesgoTotal <= 4) {
        claseColorFinal = "impacto-bajo"; textoFinal = "Nivel Bajo";
    } else if (riesgoTotal <= 9) {
        claseColorFinal = "impacto-medio"; textoFinal = "Nivel Medio";
    } else if (riesgoTotal <= 16) {
        claseColorFinal = "impacto-alto"; textoFinal = "Nivel Alto";
    } else {
        claseColorFinal = "impacto-critico"; textoFinal = "Nivel Crítico";
    }

    labelTextInline.classList.add(claseColorFinal);
    labelTextInline.textContent = textoFinal;

    // D. ILUMINAR LA CELDA EN LA MATRIZ (A LA DERECHA)
    const todasLasCeldas = document.querySelectorAll('.hm-cell');
    todasLasCeldas.forEach(celda => celda.classList.remove('cell-active'));

    const claseFila = `.hm-r-${impactoNivel}`;
    const claseColumna = `.hm-c-${probNivel}`;
    const celdaObjetivo = document.querySelector(`${claseFila}${claseColumna}`);
    
    if (celdaObjetivo) {
        celdaObjetivo.classList.add('cell-active');
    }
};

// --- 4. ASIGNACIÓN DE EVENTOS ---
const radiosProb = document.querySelectorAll('input[name="prob_radio"]');
radiosProb.forEach(radio => radio.addEventListener('change', actualizarEvaluacionRiesgo));

const radiosImpacto = document.querySelectorAll('.impact-calc-group input[type="radio"]');
radiosImpacto.forEach(radio => radio.addEventListener('change', actualizarEvaluacionRiesgo));

// --- 5. INICIALIZACIÓN ---
actualizarEvaluacionRiesgo();