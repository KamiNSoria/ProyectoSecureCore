/* ==========================================================================
   CUMPLIMIENTO.JS - Madurez ISO y Gap Analysis 100% real (desde SQL)
   ========================================================================= */

const API_BASE = 'http://127.0.0.1:8000/api';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [resControles, resIso] = await Promise.all([
            fetch(`${API_BASE}/controles-empresa/`),
            fetch(`${API_BASE}/catalogo-iso/`)
        ]);

        const controlesEmpresa = await resControles.json();
        const catalogoIso = await resIso.json();

        pintarMadurezGeneral(controlesEmpresa, catalogoIso);
        pintarGapAnalysis(controlesEmpresa, catalogoIso);

    } catch (error) {
        console.error('Error al cargar cumplimiento:', error);
    }
});

// --- 1. MADUREZ GENERAL (Dona) ---
function pintarMadurezGeneral(controlesEmpresa, catalogoIso) {
    const totalCatalogo = catalogoIso.length;
    const totalAplicados = controlesEmpresa.length;
    const porcentaje = totalCatalogo > 0 ? Math.round((totalAplicados / totalCatalogo) * 100) : 0;

    document.getElementById('inner-circle-pct').textContent = `${porcentaje}%`;
    document.getElementById('circular-progress').style.background =
        `conic-gradient(#6366f1 0% ${porcentaje}%, #e2e8f0 ${porcentaje}% 100%)`;

    let nivel = 'Inicial';
    if (porcentaje >= 90) nivel = 'Optimizado';
    else if (porcentaje >= 70) nivel = 'Definido';
    else if (porcentaje >= 40) nivel = 'Gestionado';
    else if (porcentaje >= 15) nivel = 'Repetible';

    document.getElementById('nivel-madurez-texto').textContent = `Nivel: ${nivel}`;
    document.getElementById('detalle-madurez').textContent =
        `${totalAplicados} de ${totalCatalogo} controles aplicados`;
}

// --- 2. GAP ANALYSIS POR DOMINIO ---
function pintarGapAnalysis(controlesEmpresa, catalogoIso) {
    const contenedor = document.getElementById('gap-analysis-container');

    // Contamos cuántos controles existen en el catálogo por cada dominio (típicamente 37/8/14/34)
    const totalPorDominio = {};
    catalogoIso.forEach(c => {
        totalPorDominio[c.dominio] = (totalPorDominio[c.dominio] || 0) + 1;
    });

    // Contamos cuántos controles YA aplicó la empresa, agrupados por el dominio de su control ISO padre
    const aplicadosPorDominio = {};
    controlesEmpresa.forEach(ce => {
        const isoPadre = catalogoIso.find(c => c.id_control === ce.id_iso_padre);
        if (isoPadre) {
            aplicadosPorDominio[isoPadre.dominio] = (aplicadosPorDominio[isoPadre.dominio] || 0) + 1;
        }
    });

    // Orden fijo para que siempre se vea igual (Organizacional, Personas, Físico, Tecnológico)
    const ordenDominios = ['Organizacional', 'Personas', 'Físico', 'Tecnológico'];

    let html = '';
    ordenDominios.forEach(dominio => {
        const total = totalPorDominio[dominio] || 0;
        const aplicados = aplicadosPorDominio[dominio] || 0;
        const porcentaje = total > 0 ? Math.round((aplicados / total) * 100) : 0;

        let color = '#ef4444'; // rojo (brecha grande)
        if (porcentaje >= 70) color = '#6366f1'; // morado (bien cubierto)
        else if (porcentaje >= 40) color = '#f59e0b'; // naranja (parcial)

        html += `
            <div class="gap-item">
                <div class="gap-info">
                    <span>${dominio} <small style="color:#94a3b8;">(${aplicados}/${total})</small></span>
                    <strong>${porcentaje}%</strong>
                </div>
                <div class="gap-bar"><div class="gap-fill" style="width: ${porcentaje}%; background: ${color};"></div></div>
            </div>
        `;
    });

    contenedor.innerHTML = html;
}