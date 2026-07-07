/* ==========================================================================
   DASHBOARD.JS - Panel principal 100% conectado a SQL (sin datos quemados)
   ========================================================================= */

const API_BASE = 'http://127.0.0.1:8000/api';

let tooltipData = null;
let popoverEl = null;
let hideTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [resActivos, resRiesgos, resTratamientos, resControles, resIso, resAmenazas, resTiposActivo] = await Promise.all([
            fetch(`${API_BASE}/activos/`),
            fetch(`${API_BASE}/riesgos/`),
            fetch(`${API_BASE}/tratamientos/`),
            fetch(`${API_BASE}/controles-empresa/`),
            fetch(`${API_BASE}/catalogo-iso/`),
            fetch(`${API_BASE}/amenazas/`),
            fetch(`${API_BASE}/tipos-activo/`)
        ]);

        const activos = await resActivos.json();
        const riesgos = await resRiesgos.json();
        const tratamientos = await resTratamientos.json();
        const controles = await resControles.json();
        const catalogoIso = await resIso.json();
        const amenazas = await resAmenazas.json();
        const tiposActivo = await resTiposActivo.json();

        pintarKPIs(activos, riesgos, tratamientos, controles, catalogoIso);
        pintarPanelMonitoreo(riesgos, tratamientos);
        pintarActivosPorTipo(activos, tiposActivo);
        pintarRiesgosPorNivel(riesgos);
        pintarDonutResidual(riesgos, tratamientos);
        pintarActividadReciente(activos, riesgos, tratamientos, controles);
        pintarResumenGeneral(activos, riesgos, tratamientos, controles);
        pintarTop5Riesgos(riesgos, activos, amenazas, tratamientos);

        // Guarda los datos ya traídos de la API para alimentar los popovers en hover
        iniciarTooltips({ activos, riesgos, tratamientos, controles, catalogoIso, amenazas, tiposActivo });

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

function formatoFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

// --- 3a. Activos por Tipo ---
function pintarActivosPorTipo(activos, tiposActivo) {
    const contenedor = document.getElementById('activos-tipo-list');
    if (!contenedor) return;

    if (activos.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Aún no hay activos registrados.</p>';
        return;
    }

    const conteoPorTipo = new Map();
    activos.forEach(a => {
        const tipo = tiposActivo.find(t => t.id_tipo_activo === a.id_tipo_activo);
        const nombre = tipo ? tipo.nombre_tipo : 'Sin categoría';
        conteoPorTipo.set(nombre, (conteoPorTipo.get(nombre) || 0) + 1);
    });

    const filas = [...conteoPorTipo.entries()].sort((a, b) => b[1] - a[1]);
    const maximo = Math.max(...filas.map(f => f[1]));

    let html = '';
    filas.forEach(([nombre, cantidad]) => {
        const porcentaje = Math.round((cantidad / maximo) * 100);
        html += `
            <div class="tipo-bar-row" onclick="window.location.href='pages/activos.html'">
                <div class="tipo-bar-label">
                    <span>${nombre}</span>
                    <span>${cantidad}</span>
                </div>
                <div class="tipo-bar-track"><div class="tipo-bar-fill" style="width:${porcentaje}%"></div></div>
            </div>
        `;
    });

    contenedor.innerHTML = html;
}

// --- 3b. Riesgos por Nivel (dona circular alto/medio/bajo/crítico) ---
function pintarRiesgosPorNivel(riesgos) {
    const donut = document.getElementById('nivel-donut-chart');
    const leyenda = document.getElementById('riesgos-nivel-leyenda');
    const totalTexto = document.getElementById('nivel-donut-total');
    if (!donut || !leyenda) return;

    totalTexto.textContent = riesgos.length;

    if (riesgos.length === 0) {
        donut.style.background = '#f1f5f9';
        leyenda.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Aún no hay riesgos registrados.</p>';
        return;
    }

    const niveles = [
        { clase: 'critico', texto: 'CRÍTICO', color: '#e11d48' },
        { clase: 'alto', texto: 'ALTO', color: '#ea580c' },
        { clase: 'medio', texto: 'MEDIO', color: '#ca8a04' },
        { clase: 'bajo', texto: 'BAJO', color: '#16a34a' }
    ];

    const conteos = niveles.map(nivel => ({
        ...nivel,
        cantidad: riesgos.filter(r => nivelPorScore(scoreInherente(r)).clase === nivel.clase).length
    })).filter(n => n.cantidad > 0);

    let acumulado = 0;
    const segmentos = conteos.map(n => {
        const desde = acumulado;
        acumulado += (n.cantidad / riesgos.length) * 100;
        return `${n.color} ${desde}% ${acumulado}%`;
    });
    donut.style.background = `conic-gradient(${segmentos.join(', ')})`;

    leyenda.innerHTML = conteos.map(n => `
        <div class="nivel-leyenda-item" onclick="window.location.href='pages/analisis.html?nivel=${n.clase}'">
            <span class="nivel-leyenda-dot" style="background:${n.color}"></span>
            <span class="nivel-leyenda-label">Riesgo ${n.texto.toLowerCase()}</span>
            <span class="nivel-leyenda-count">${n.cantidad}</span>
        </div>
    `).join('');
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
// Considera que hubo una edición real si la fecha de modificación quedó más de 2s después de la de creación
// (en la creación, ambas fechas se graban casi al mismo instante).
function huboEdicion(fechaCreacion, fechaModificacion) {
    if (!fechaCreacion || !fechaModificacion) return false;
    return (new Date(fechaModificacion) - new Date(fechaCreacion)) > 2000;
}

function pintarActividadReciente(activos, riesgos, tratamientos, controles) {
    const contenedor = document.getElementById('actividad-reciente-list');
    let eventos = [];

    activos.forEach(a => {
        if (a.fecha_registro) {
            eventos.push({
                tipo: 'activo',
                fecha: a.fecha_registro,
                texto: `Activo registrado: ${a.nombre_activo}`,
                detalle: `Impacto ${a.nivel_impacto || a.valor_final_max || 'N/A'}/5`
            });
        }
        if (huboEdicion(a.fecha_registro, a.fecha_modificacion)) {
            eventos.push({
                tipo: 'activo-mod',
                fecha: a.fecha_modificacion,
                texto: `Activo modificado: ${a.nombre_activo}`,
                detalle: `Impacto ${a.nivel_impacto || a.valor_final_max || 'N/A'}/5`
            });
        }
    });
    riesgos.forEach(r => {
        const nivel = nivelPorScore(scoreInherente(r));
        if (r.fecha_registro) {
            eventos.push({
                tipo: 'riesgo',
                fecha: r.fecha_registro,
                texto: `Riesgo identificado: ${r.nombre_riesgo}`,
                detalle: `Score inherente ${scoreInherente(r)} — nivel ${nivel.texto}`
            });
        }
        if (huboEdicion(r.fecha_registro, r.fecha_modificacion)) {
            eventos.push({
                tipo: 'riesgo-mod',
                fecha: r.fecha_modificacion,
                texto: `Riesgo modificado: ${r.nombre_riesgo}`,
                detalle: `Score inherente ${scoreInherente(r)} — nivel ${nivel.texto}`
            });
        }
    });
    controles.forEach(c => {
        if (c.fecha_registro) {
            eventos.push({
                tipo: 'control',
                fecha: c.fecha_registro,
                texto: `Control creado: ${c.nombre_control}`,
                detalle: `ISO ${c.id_iso_padre} — Eficacia ${c.eficacia_porcentaje}%`
            });
        }
        if (huboEdicion(c.fecha_registro, c.fecha_modificacion)) {
            eventos.push({
                tipo: 'control-mod',
                fecha: c.fecha_modificacion,
                texto: `Control modificado: ${c.nombre_control}`,
                detalle: `ISO ${c.id_iso_padre} — Eficacia ${c.eficacia_porcentaje}%`
            });
        }
    });
    tratamientos.forEach(t => {
        const riesgo = riesgos.find(r => r.id_riesgo === t.id_riesgo);
        if (t.fecha_actualizacion) {
            eventos.push({
                tipo: 'tratamiento',
                fecha: t.fecha_actualizacion,
                texto: `Tratamiento aplicado: ${t.estrategia}${riesgo ? ` sobre "${riesgo.nombre_riesgo}"` : ''}`,
                detalle: `Score residual: ${t.score_residual}`
            });
        }
        if (huboEdicion(t.fecha_actualizacion, t.fecha_modificacion)) {
            eventos.push({
                tipo: 'tratamiento-mod',
                fecha: t.fecha_modificacion,
                texto: `Tratamiento modificado: ${t.estrategia}${riesgo ? ` sobre "${riesgo.nombre_riesgo}"` : ''}`,
                detalle: `Score residual: ${t.score_residual}`
            });
        }
    });

    eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    eventos = eventos.slice(0, 12);

    if (eventos.length === 0) {
        contenedor.innerHTML = '<p style="color:#94a3b8; font-size:13px;">Aún no hay actividad registrada.</p>';
        return;
    }

    const iconos = {
        activo: { clase: 'alert-blue', icono: '<i class="bx bx-server"></i>', destino: 'pages/activos.html', etiqueta: 'Activo' },
        'activo-mod': { clase: 'alert-blue', icono: '<i class="bx bx-edit-alt"></i>', destino: 'pages/activos.html', etiqueta: 'Editado' },
        riesgo: { clase: 'alert-yellow', icono: '<i class="bx bx-error-alt"></i>', destino: 'pages/analisis.html', etiqueta: 'Riesgo' },
        'riesgo-mod': { clase: 'alert-yellow', icono: '<i class="bx bx-edit-alt"></i>', destino: 'pages/analisis.html', etiqueta: 'Editado' },
        control: { clase: 'alert-blue', icono: '<i class="bx bx-list-check"></i>', destino: 'pages/tratamiento.html?tab=biblioteca', etiqueta: 'Control' },
        'control-mod': { clase: 'alert-blue', icono: '<i class="bx bx-edit-alt"></i>', destino: 'pages/tratamiento.html?tab=biblioteca', etiqueta: 'Editado' },
        tratamiento: { clase: 'alert-red', icono: '<i class="bx bx-check-shield"></i>', destino: 'pages/tratamiento.html?tab=historial', etiqueta: 'Tratamiento' },
        'tratamiento-mod': { clase: 'alert-red', icono: '<i class="bx bx-edit-alt"></i>', destino: 'pages/tratamiento.html?tab=historial', etiqueta: 'Editado' }
    };

    let html = '';
    eventos.forEach(e => {
        const meta = iconos[e.tipo];
        const fecha = new Date(e.fecha).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        html += `
            <div class="alert-item ${meta.clase}" onclick="window.location.href='${meta.destino}'">
                <div class="alert-icon">${meta.icono}</div>
                <div class="alert-info">
                    <strong>${e.texto}</strong>
                    <span class="alert-detalle">${e.detalle}</span>
                    <span>${fecha}</span>
                </div>
                <span class="alert-tipo-tag">${meta.etiqueta}</span>
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
        <div class="threat-item threat-red" data-tooltip="resumen-activos" onclick="window.location.href='pages/activos.html?impacto=5'">
            <span class="threat-title">Activos Críticos</span>
            <strong>${activosCriticos}</strong>
            <small>De ${activos.length} activos totales</small>
        </div>
        <div class="threat-item threat-purple" data-tooltip="resumen-riesgos" onclick="window.location.href='pages/analisis.html?nivel=alto-critico'">
            <span class="threat-title">Riesgos Alto/Crítico</span>
            <strong>${riesgosAltos}</strong>
            <small>De ${riesgos.length} riesgos totales</small>
        </div>
        <div class="threat-item threat-green" data-tooltip="resumen-controles" onclick="window.location.href='pages/tratamiento.html?tab=biblioteca'">
            <span class="threat-title">Eficacia Prom. de Controles</span>
            <strong>${eficaciaPromedio}%</strong>
            <small>Basado en ${controles.length} control${controles.length !== 1 ? 'es' : ''}</small>
        </div>
    `;
}

// ==========================================================================
// POPOVERS EN HOVER - datos en tiempo real (traídos de la API al cargar)
// ==========================================================================

// Reconstruye la misma lista de eventos que arma pintarActividadReciente, solo para
// alimentar el popover de "Actividad Reciente" sin tocar esa función existente.
function obtenerEventosRecientes(activos, riesgos, tratamientos, controles) {
    let eventos = [];

    activos.forEach(a => {
        if (a.fecha_registro) {
            eventos.push({
                tipo: 'activo',
                fecha: a.fecha_registro,
                texto: `Activo registrado: ${a.nombre_activo}`,
                detalle: `Impacto ${a.nivel_impacto || a.valor_final_max || 'N/A'}/5`
            });
        }
        if (huboEdicion(a.fecha_registro, a.fecha_modificacion)) {
            eventos.push({
                tipo: 'activo-mod',
                fecha: a.fecha_modificacion,
                texto: `Activo modificado: ${a.nombre_activo}`,
                detalle: `Impacto ${a.nivel_impacto || a.valor_final_max || 'N/A'}/5`
            });
        }
    });
    riesgos.forEach(r => {
        const nivel = nivelPorScore(scoreInherente(r));
        if (r.fecha_registro) {
            eventos.push({
                tipo: 'riesgo',
                fecha: r.fecha_registro,
                texto: `Riesgo identificado: ${r.nombre_riesgo}`,
                detalle: `Score inherente ${scoreInherente(r)} — nivel ${nivel.texto}`
            });
        }
        if (huboEdicion(r.fecha_registro, r.fecha_modificacion)) {
            eventos.push({
                tipo: 'riesgo-mod',
                fecha: r.fecha_modificacion,
                texto: `Riesgo modificado: ${r.nombre_riesgo}`,
                detalle: `Score inherente ${scoreInherente(r)} — nivel ${nivel.texto}`
            });
        }
    });
    controles.forEach(c => {
        if (c.fecha_registro) {
            eventos.push({
                tipo: 'control',
                fecha: c.fecha_registro,
                texto: `Control creado: ${c.nombre_control}`,
                detalle: `ISO ${c.id_iso_padre} — Eficacia ${c.eficacia_porcentaje}%`
            });
        }
        if (huboEdicion(c.fecha_registro, c.fecha_modificacion)) {
            eventos.push({
                tipo: 'control-mod',
                fecha: c.fecha_modificacion,
                texto: `Control modificado: ${c.nombre_control}`,
                detalle: `ISO ${c.id_iso_padre} — Eficacia ${c.eficacia_porcentaje}%`
            });
        }
    });
    tratamientos.forEach(t => {
        const riesgo = riesgos.find(r => r.id_riesgo === t.id_riesgo);
        if (t.fecha_actualizacion) {
            eventos.push({
                tipo: 'tratamiento',
                fecha: t.fecha_actualizacion,
                texto: `Tratamiento aplicado: ${t.estrategia}${riesgo ? ` sobre "${riesgo.nombre_riesgo}"` : ''}`,
                detalle: `Score residual: ${t.score_residual}`
            });
        }
        if (huboEdicion(t.fecha_actualizacion, t.fecha_modificacion)) {
            eventos.push({
                tipo: 'tratamiento-mod',
                fecha: t.fecha_modificacion,
                texto: `Tratamiento modificado: ${t.estrategia}${riesgo ? ` sobre "${riesgo.nombre_riesgo}"` : ''}`,
                detalle: `Score residual: ${t.score_residual}`
            });
        }
    });

    eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    return eventos;
}

function iniciarTooltips(data) {
    tooltipData = data;
    popoverEl = document.getElementById('dash-popover');
    if (!popoverEl) {
        popoverEl = document.createElement('div');
        popoverEl.id = 'dash-popover';
        popoverEl.className = 'dash-popover';
        document.body.appendChild(popoverEl);
    }

    document.addEventListener('mouseover', (e) => {
        const card = e.target.closest('[data-tooltip]');
        if (card) mostrarPopover(card);
    });

    document.addEventListener('mouseout', (e) => {
        const card = e.target.closest('[data-tooltip]');
        if (!card) return;
        const destino = e.relatedTarget;
        if (destino && card.contains(destino)) return; // seguimos dentro de la misma tarjeta
        ocultarPopover();
    });

    document.addEventListener('scroll', ocultarPopover, true);
}

function mostrarPopover(card) {
    clearTimeout(hideTimer);
    if (!tooltipData) return;

    const tipo = card.getAttribute('data-tooltip');
    const html = construirContenidoTooltip(tipo);
    if (!html) return;

    popoverEl.innerHTML = html;
    posicionarPopover(card);
    popoverEl.classList.add('visible');
}

function ocultarPopover() {
    hideTimer = setTimeout(() => {
        popoverEl.classList.remove('visible');
    }, 80);
}

function posicionarPopover(card) {
    const rect = card.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    popoverEl.style.left = '0px';
    popoverEl.style.top = '0px';
    popoverEl.style.visibility = 'hidden';
    popoverEl.style.display = 'block';

    const popRect = popoverEl.getBoundingClientRect();

    let top = rect.bottom + scrollY + 10;
    let left = rect.left + scrollX;

    const maxLeft = window.innerWidth + scrollX - popRect.width - 16;
    if (left > maxLeft) left = Math.max(maxLeft, 16);

    if (rect.bottom + popRect.height + 20 > window.innerHeight) {
        top = rect.top + scrollY - popRect.height - 10;
    }

    popoverEl.style.top = `${top}px`;
    popoverEl.style.left = `${left}px`;
    popoverEl.style.visibility = 'visible';
}

function construirContenidoTooltip(tipo) {
    const { activos, riesgos, tratamientos, controles, catalogoIso } = tooltipData;

    switch (tipo) {

        case 'activos':
        case 'resumen-activos': {
            const total = activos.length;
            const criticos = activos.filter(a => (a.nivel_impacto || a.valor_final_max) === 5).length;
            const ultimos = [...activos]
                .filter(a => a.fecha_registro)
                .sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro))
                .slice(0, 3);

            return `
                <h4>Activos Registrados</h4>
                <ul class="dash-popover-list">
                    <li class="dash-popover-row"><span>Total de activos</span><strong>${total}</strong></li>
                    <li class="dash-popover-row"><span>Activos críticos</span><strong class="text-critico">${criticos}</strong></li>
                    ${ultimos.length ? `
                    <li class="dash-popover-block">
                        <span class="dash-popover-label">Últimos registrados</span>
                        <strong>${ultimos.map(a => `${a.nombre_activo} (${formatoFecha(a.fecha_registro)})`).join(' · ')}</strong>
                    </li>` : ''}
                </ul>
            `;
        }

        case 'riesgos':
        case 'resumen-riesgos': {
            const total = riesgos.length;
            const conteo = { bajo: 0, medio: 0, alto: 0, critico: 0 };
            riesgos.forEach(r => conteo[nivelPorScore(scoreInherente(r)).clase]++);

            return `
                <h4>Riesgos Registrados</h4>
                <ul class="dash-popover-list">
                    <li class="dash-popover-row"><span>Total registrados</span><strong>${total}</strong></li>
                    <li class="dash-popover-row"><span>Críticos</span><strong class="text-critico">${conteo.critico}</strong></li>
                    <li class="dash-popover-row"><span>Altos</span><strong class="text-alto">${conteo.alto}</strong></li>
                    <li class="dash-popover-row"><span>Medios</span><strong class="text-medio">${conteo.medio}</strong></li>
                    <li class="dash-popover-row"><span>Bajos</span><strong class="text-bajo">${conteo.bajo}</strong></li>
                </ul>
            `;
        }

        case 'controles':
        case 'resumen-controles': {
            const implementados = controles.length;
            const totalCatalogo = catalogoIso.length;
            const pendientes = Math.max(totalCatalogo - implementados, 0);
            const pct = totalCatalogo > 0 ? Math.round((implementados / totalCatalogo) * 100) : 0;

            return `
                <h4>Controles ISO</h4>
                <ul class="dash-popover-list">
                    <li class="dash-popover-row"><span>Implementados</span><strong>${implementados}</strong></li>
                    <li class="dash-popover-row"><span>Pendientes</span><strong>${pendientes}</strong></li>
                    <li class="dash-popover-row"><span>Cumplimiento</span><strong class="text-azul">${pct}%</strong></li>
                </ul>
            `;
        }

        case 'residual': {
            const base = tratamientos.length > 0
                ? tratamientos.map(t => ({ score: t.score_residual, idRiesgo: t.id_riesgo }))
                : riesgos.map(r => ({ score: scoreInherente(r), idRiesgo: r.id_riesgo }));

            if (base.length === 0) {
                return `<h4>Riesgo Residual</h4><p class="dash-popover-empty">Aún no hay datos suficientes.</p>`;
            }

            const promedio = Math.round(base.reduce((acc, b) => acc + b.score, 0) / base.length);
            const mayor = base.reduce((a, b) => (b.score > a.score ? b : a));
            const menor = base.reduce((a, b) => (b.score < a.score ? b : a));
            const nombreRiesgo = (id) => {
                const r = riesgos.find(r => r.id_riesgo === id);
                return r ? r.nombre_riesgo : `Riesgo #${id}`;
            };

            return `
                <h4>Riesgo Residual</h4>
                <ul class="dash-popover-list">
                    <li class="dash-popover-row"><span>Promedio</span><strong>${promedio}</strong></li>
                    <li class="dash-popover-block">
                        <span class="dash-popover-label">Mayor riesgo</span>
                        <strong class="text-critico">${mayor.score} · ${nombreRiesgo(mayor.idRiesgo)}</strong>
                    </li>
                    <li class="dash-popover-block">
                        <span class="dash-popover-label">Menor riesgo</span>
                        <strong class="text-bajo">${menor.score} · ${nombreRiesgo(menor.idRiesgo)}</strong>
                    </li>
                </ul>
            `;
        }

        case 'reduccion': {
            if (tratamientos.length === 0) {
                return `<h4>Reducción Promedio</h4><p class="dash-popover-empty">Aún no hay tratamientos aplicados.</p>`;
            }

            const reducciones = tratamientos.map(t => {
                const riesgo = riesgos.find(r => r.id_riesgo === t.id_riesgo);
                const inherente = riesgo ? scoreInherente(riesgo) : null;
                const pct = (inherente && inherente > 0) ? ((inherente - t.score_residual) / inherente) * 100 : null;
                return { pct, idRiesgo: t.id_riesgo, riesgo };
            }).filter(r => r.pct !== null);

            if (reducciones.length === 0) {
                return `<h4>Reducción Promedio</h4><p class="dash-popover-empty">No se pudo calcular la reducción.</p>`;
            }

            const promedio = Math.round(reducciones.reduce((acc, r) => acc + r.pct, 0) / reducciones.length);
            const mejor = reducciones.reduce((a, b) => (b.pct > a.pct ? b : a));
            const peor = reducciones.reduce((a, b) => (b.pct < a.pct ? b : a));
            const nombre = (r) => r.riesgo ? r.riesgo.nombre_riesgo : `Riesgo #${r.idRiesgo}`;

            return `
                <h4>Reducción Promedio</h4>
                <ul class="dash-popover-list">
                    <li class="dash-popover-row"><span>Promedio</span><strong class="text-azul">${promedio}%</strong></li>
                    <li class="dash-popover-block">
                        <span class="dash-popover-label">Mejor tratamiento</span>
                        <strong class="text-bajo">${Math.round(mejor.pct)}% · ${nombre(mejor)}</strong>
                    </li>
                    <li class="dash-popover-block">
                        <span class="dash-popover-label">Peor tratamiento</span>
                        <strong class="text-critico">${Math.round(peor.pct)}% · ${nombre(peor)}</strong>
                    </li>
                </ul>
            `;
        }

        case 'actividad': {
            const eventos = obtenerEventosRecientes(activos, riesgos, tratamientos, controles);
            if (eventos.length === 0) {
                return `<h4>Actividad Reciente</h4><p class="dash-popover-empty">Sin actividad registrada.</p>`;
            }

            return `
                <h4>Actividad Reciente</h4>
                <ul class="dash-popover-list">
                    <li class="dash-popover-row"><span>Últimos registros</span><strong>${Math.min(eventos.length, 12)}</strong></li>
                    <li class="dash-popover-row"><span>Más reciente</span><strong>${formatoFecha(eventos[0].fecha)}</strong></li>
                    <li class="dash-popover-block">
                        <span class="dash-popover-label">Último evento</span>
                        <strong>${eventos[0].texto}</strong>
                    </li>
                </ul>
            `;
        }

        default:
            return '';
    }
}