/* ==========================================================================
   DASHBOARD.JS - Panel principal 100% conectado a SQL (sin datos quemados)
   ========================================================================= */

const API_BASE = 'http://127.0.0.1:8000/api';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [resActivos, resRiesgos, resTratamientos, resControles, resIso, resAmenazas] = await Promise.all([
            fetch(`${API_BASE}/activos/`),
            fetch(`${API_BASE}/riesgos/`),
            fetch(`${API_BASE}/tratamientos/`),
            fetch(`${API_BASE}/controles-empresa/`),
            fetch(`${API_BASE}/catalogo-iso/`),
            fetch(`${API_BASE}/amenazas/`)
        ]);

        const activos = await resActivos.json();
        const riesgos = await resRiesgos.json();
        const tratamientos = await resTratamientos.json();
        const controles = await resControles.json();
        const catalogoIso = await resIso.json();
        const amenazas = await resAmenazas.json();

        pintarKPIs(activos, riesgos, tratamientos, controles, catalogoIso);
        pintarPanelMonitoreo(riesgos, tratamientos);
        pintarDonutResidual(riesgos, tratamientos);
        pintarMapaCalorAmenazas(riesgos, amenazas);
        pintarActividadReciente(activos, riesgos, tratamientos);
        pintarResumenGeneral(activos, riesgos, tratamientos, controles);
        pintarTop5Riesgos(riesgos, activos, amenazas, tratamientos);

    } catch (error) {
        console.error('Error al cargar el dashboard:', error);
    }
});

function scoreInherente(r) {
    return r.score_inherente ?? (r.nivel_probabilidad * r.nivel_vulnerabilidad);
}

function nivelPorScore(score) {
    if (score <= 4) return { clase: 'bajo', texto: 'BAJO' };
    if (score <= 9) return { clase: 'medio', texto: 'MEDIO' };
    if (score <= 16) return { clase: 'alto', texto: 'ALTO' };
    return { clase: 'critico', texto: 'CRÍTICO' };
}

// --- 1. KPIs ---
function pintarKPIs(activos, riesgos, tratamientos, controles, catalogoIso) {
    // Activos
    const criticos = activos.filter(a => (a.nivel_impacto || a.valor_final_max) === 5).length;
    document.getElementById('kpi-activos').textContent = activos.length;
    document.getElementById('kpi-activos-detalle').textContent = activos.length > 0
        ? `${criticos} crítico${criticos !== 1 ? 's' : ''} de ${activos.length}`
        : 'Sin activos registrados';

    // Riesgos
    const idsTratados = new Set(tratamientos.map(t => t.id_riesgo));
    const riesgosTratados = idsTratados.size;
    const riesgosPendientes = riesgos.length - riesgosTratados;
    document.getElementById('kpi-riesgos').textContent = riesgos.length;
    document.getElementById('kpi-riesgos-detalle').textContent = riesgos.length > 0
        ? `${riesgosPendientes} sin tratar, ${riesgosTratados} tratado${riesgosTratados !== 1 ? 's' : ''}`
        : 'Sin riesgos registrados';

    // Controles ISO
    const porcentajeIso = catalogoIso.length > 0 ? Math.round((controles.length / catalogoIso.length) * 100) : 0;
    document.getElementById('kpi-controles').textContent = controles.length;
    document.getElementById('kpi-controles-detalle').textContent = `${porcentajeIso}% del catálogo (${catalogoIso.length} controles)`;

    // Reducción promedio
    if (tratamientos.length === 0) {
        document.getElementById('kpi-reduccion').textContent = '0%';
        document.getElementById('kpi-reduccion-detalle').textContent = 'Aún no hay tratamientos aplicados';
    } else {
        let sumaReduccion = 0, contados = 0;
        tratamientos.forEach(t => {
            const riesgo = riesgos.find(r => r.id_riesgo === t.id_riesgo);
            if (riesgo) {
                const inherente = scoreInherente(riesgo);
                if (inherente > 0) {
                    sumaReduccion += ((inherente - t.score_residual) / inherente) * 100;
                    contados++;
                }
            }
        });
        const promedio = contados > 0 ? Math.round(sumaReduccion / contados) : 0;
        document.getElementById('kpi-reduccion').textContent = `${promedio}%`;
        document.getElementById('kpi-reduccion-detalle').textContent = `Basado en ${tratamientos.length} tratamiento${tratamientos.length !== 1 ? 's' : ''} aplicado${tratamientos.length !== 1 ? 's' : ''}`;
    }
}

// --- 1b. Panel de Monitoreo y Supervisión (coberturas) ---
function pintarPanelMonitoreo(riesgos, tratamientos) {
    const totalRiesgos = riesgos.length;

    // Cobertura de Tratamientos: cuántos riesgos ya tienen una estrategia aplicada (cualquiera)
    const idsTratados = new Set(tratamientos.map(t => t.id_riesgo));
    const riesgosTratados = idsTratados.size;
    const pctTratamientos = totalRiesgos > 0 ? Math.round((riesgosTratados / totalRiesgos) * 100) : 0;

    // Cobertura de Riesgo Residual: cuántos riesgos tienen una reducción real medida (no solo "Aceptar"/"Evitar")
    let riesgosConReduccionReal = 0;
    tratamientos.forEach(t => {
        const riesgo = riesgos.find(r => r.id_riesgo === t.id_riesgo);
        if (riesgo && t.score_residual < scoreInherente(riesgo)) riesgosConReduccionReal++;
    });
    const pctResidual = totalRiesgos > 0 ? Math.round((riesgosConReduccionReal / totalRiesgos) * 100) : 0;

    document.getElementById('cobertura-tratamientos-pct').textContent = `${pctTratamientos}%`;
    document.getElementById('cobertura-tratamientos-fill').style.width = `${pctTratamientos}%`;
    document.getElementById('cobertura-tratamientos-detalle').textContent = totalRiesgos > 0
        ? `${pctTratamientos}% — ${riesgosTratados} de ${totalRiesgos} riesgos tratados`
        : 'Sin riesgos registrados';

    document.getElementById('cobertura-residual-pct').textContent = `${pctResidual}%`;
    document.getElementById('cobertura-residual-fill').style.width = `${pctResidual}%`;
    document.getElementById('cobertura-residual-detalle').textContent = totalRiesgos > 0
        ? `${pctResidual}% — ${riesgosConReduccionReal} de ${totalRiesgos} con residual calculado`
        : 'Sin riesgos registrados';
}

// --- 2. Dona de Riesgo Residual ---
function pintarDonutResidual(riesgos, tratamientos) {
    let scorePromedio = 0;

    if (tratamientos.length > 0) {
        scorePromedio = tratamientos.reduce((acc, t) => acc + t.score_residual, 0) / tratamientos.length;
    } else if (riesgos.length > 0) {
        scorePromedio = riesgos.reduce((acc, r) => acc + scoreInherente(r), 0) / riesgos.length;
    }

    const puntaje = Math.round(scorePromedio);
    const porcentaje = Math.min(100, Math.round((scorePromedio / 25) * 100));

    document.getElementById('donut-puntaje').textContent = puntaje;

    const donut = document.getElementById('donut-chart');
    let color = '#16a34a';
    let nivelTexto = 'Nivel Bajo';
    if (porcentaje > 64) { color = '#dc2626'; nivelTexto = 'Nivel Crítico'; }
    else if (porcentaje > 36) { color = '#ea580c'; nivelTexto = 'Nivel Elevado'; }
    else if (porcentaje > 16) { color = '#ca8a04'; nivelTexto = 'Nivel Moderado'; }

    donut.style.background = `conic-gradient(${color} 0% ${porcentaje}%, #f1f5f9 ${porcentaje}% 100%)`;
    document.querySelector('.donut-inner strong').style.color = color;

    const badge = document.getElementById('badge-nivel-residual');
    badge.textContent = riesgos.length === 0 ? 'Sin datos aún' : nivelTexto;
    badge.style.color = color;
    badge.style.background = `${color}15`;
    badge.style.borderColor = `${color}40`;
}

// --- 3. Mapa de Calor por Amenaza ---
function pintarMapaCalorAmenazas(riesgos, amenazas) {
    const contenedor = document.getElementById('heat-grid-real');

    if (riesgos.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px; grid-column: 1/-1;">Aún no hay riesgos registrados para mostrar en el mapa de calor.</p>';
        return;
    }

    let html = '';
    amenazas.forEach(amenaza => {
        const riesgosDeEstaAmenaza = riesgos.filter(r => r.id_amenaza === amenaza.id_amenaza);
        if (riesgosDeEstaAmenaza.length === 0) return; // Solo mostramos amenazas con riesgos reales

        const scorePromedio = riesgosDeEstaAmenaza.reduce((acc, r) => acc + scoreInherente(r), 0) / riesgosDeEstaAmenaza.length;
        const nivel = nivelPorScore(scorePromedio);

        html += `
            <div class="heat-item ${nivel.clase}" onclick="window.location.href='pages/analisis.html'">
                <span>${amenaza.nombre_amenaza}</span>
                <strong>${riesgosDeEstaAmenaza.length}</strong>
                <small>${nivel.texto}</small>
            </div>
        `;
    });

    contenedor.innerHTML = html || '<p style="color:#94a3b8; font-size:13px; grid-column: 1/-1;">Todos tus riesgos usan amenazas personalizadas ("otro"), no hay agrupación por catálogo.</p>';
}

// --- 3b. Top 5 Riesgos por Nivel ---
function pintarTop5Riesgos(riesgos, activos, amenazas, tratamientos) {
    const contenedor = document.getElementById('top5-riesgos-container');
    if (!contenedor) return;

    if (riesgos.length === 0) {
        contenedor.innerHTML = '<tr><td colspan="4" style="color:#94a3b8; font-size:13px; padding:16px;">Aún no hay riesgos registrados.</td></tr>';
        return;
    }

    const idsTratados = new Set(tratamientos.map(t => t.id_riesgo));
    const top5 = [...riesgos].sort((a, b) => scoreInherente(b) - scoreInherente(a)).slice(0, 5);

    let html = '';
    top5.forEach(r => {
        const activo = activos.find(a => a.id_activo === r.id_activo);
        const amenaza = amenazas.find(a => a.id_amenaza === r.id_amenaza);
        const score = scoreInherente(r);
        const nivel = nivelPorScore(score);
        const tratado = idsTratados.has(r.id_riesgo);

        html += `
            <tr onclick="window.location.href='pages/analisis.html'">
                <td><strong>${activo ? activo.nombre_activo : `#ACT-${r.id_activo}`}</strong></td>
                <td>${amenaza ? amenaza.nombre_amenaza : (r.amenaza_otro || 'N/A')}</td>
                <td><span class="nivel-badge ${nivel.clase}">${score}</span></td>
                <td><span class="estado-badge ${tratado ? 'estado-tratado' : 'estado-pendiente'}">${tratado ? 'Tratado' : 'Sin Tratar'}</span></td>
            </tr>
        `;
    });

    contenedor.innerHTML = html;
}

// --- 4. Actividad Reciente ---
function pintarActividadReciente(activos, riesgos, tratamientos) {
    const contenedor = document.getElementById('actividad-reciente-list');
    let eventos = [];

    activos.forEach(a => {
        if (a.fecha_registro) eventos.push({ tipo: 'activo', fecha: a.fecha_registro, texto: `Activo registrado: ${a.nombre_activo}` });
    });
    riesgos.forEach(r => {
        if (r.fecha_registro) eventos.push({ tipo: 'riesgo', fecha: r.fecha_registro, texto: `Riesgo identificado: ${r.nombre_riesgo}` });
    });
    tratamientos.forEach(t => {
        if (t.fecha_actualizacion) eventos.push({ tipo: 'tratamiento', fecha: t.fecha_actualizacion, texto: `Tratamiento aplicado (${t.estrategia})` });
    });

    eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    eventos = eventos.slice(0, 7);

    if (eventos.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Aún no hay actividad registrada.</p>';
        return;
    }

    const iconos = {
        activo: { clase: 'alert-blue', icono: '<i class="bx bx-server"></i>', destino: 'pages/activos.html' },
        riesgo: { clase: 'alert-yellow', icono: '<i class="bx bx-error-alt"></i>', destino: 'pages/analisis.html' },
        tratamiento: { clase: 'alert-red', icono: '<i class="bx bx-check-shield"></i>', destino: 'pages/tratamiento.html?tab=historial' }
    };

    let html = '';
    eventos.forEach(e => {
        const meta = iconos[e.tipo];
        const fecha = new Date(e.fecha).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        html += `
            <div class="alert-item ${meta.clase}" onclick="window.location.href='${meta.destino}'">
                <div class="alert-icon">${meta.icono}</div>
                <div class="alert-info">
                    <strong>${e.texto}</strong>
                    <span>${fecha}</span>
                </div>
            </div>
        `;
    });
    contenedor.innerHTML = html;
}

// --- 5. Resumen General ---
function pintarResumenGeneral(activos, riesgos, tratamientos, controles) {
    const contenedor = document.getElementById('resumen-general-grid');

    const activosCriticos = activos.filter(a => (a.nivel_impacto || a.valor_final_max) === 5).length;
    const riesgosAltos = riesgos.filter(r => scoreInherente(r) >= 10).length;
    const eficaciaPromedio = controles.length > 0
        ? Math.round(controles.reduce((acc, c) => acc + parseFloat(c.eficacia_porcentaje || 0), 0) / controles.length)
        : 0;

    contenedor.innerHTML = `
        <div class="threat-item threat-red" onclick="window.location.href='pages/activos.html'">
            <span class="threat-title">Activos Críticos</span>
            <strong>${activosCriticos}</strong>
            <small>De ${activos.length} activos totales</small>
        </div>
        <div class="threat-item threat-purple" onclick="window.location.href='pages/analisis.html'">
            <span class="threat-title">Riesgos Alto/Crítico</span>
            <strong>${riesgosAltos}</strong>
            <small>De ${riesgos.length} riesgos totales</small>
        </div>
        <div class="threat-item threat-green" onclick="window.location.href='pages/tratamiento.html?tab=biblioteca'">
            <span class="threat-title">Eficacia Prom. de Controles</span>
            <strong>${eficaciaPromedio}%</strong>
            <small>Basado en ${controles.length} control${controles.length !== 1 ? 'es' : ''}</small>
        </div>
    `;
}