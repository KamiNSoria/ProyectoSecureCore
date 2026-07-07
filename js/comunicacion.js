/* ==========================================================================
   COMUNICACION.JS - Registro centralizado de observaciones (100% conectado a SQL)
   ========================================================================= */

const API_BASE = 'http://127.0.0.1:8000/api';

let observaciones = [];
let filtroActivo = 'todos';

const etiquetasModulo = {
    activos: 'Activos',
    riesgos: 'Riesgos',
    tratamiento: 'Tratamiento',
    riesgo_residual: 'Riesgo Residual',
    monitoreo: 'Monitoreo',
    general: 'General'
};

document.addEventListener('DOMContentLoaded', async () => {
    await cargarObservaciones();
    activarFiltros();
    activarModal();
});

async function cargarObservaciones() {
    try {
        const res = await fetch(`${API_BASE}/observaciones/`);
        observaciones = await res.json();
    } catch (e) {
        console.error('Error al cargar observaciones:', e);
        observaciones = [];
    }
    pintarTabla();
}

function activarFiltros() {
    const contenedor = document.getElementById('comunicacion-filtros');
    if (!contenedor) return;
    contenedor.querySelectorAll('.filtro-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            contenedor.querySelectorAll('.filtro-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroActivo = btn.getAttribute('data-modulo');
            pintarTabla();
        });
    });
}

function pintarTabla() {
    const contenedor = document.getElementById('comunicacion-tabla-container');
    const totalTexto = document.getElementById('comunicacion-total');
    if (!contenedor) return;

    const filtradas = filtroActivo === 'todos'
        ? observaciones
        : observaciones.filter(o => o.modulo === filtroActivo);

    if (filtradas.length === 0) {
        contenedor.innerHTML = `<tr><td colspan="6" style="color:#94a3b8; font-size:13px; padding:16px;">No hay observaciones registradas${filtroActivo !== 'todos' ? ' en este módulo' : ''}.</td></tr>`;
    } else {
        contenedor.innerHTML = filtradas.map((o, i) => `
            <tr>
                <td>${i + 1}</td>
                <td><span class="badge-modulo">${etiquetasModulo[o.modulo] || o.modulo}</span></td>
                <td>${o.texto}</td>
                <td><span class="obs-autor"><i class='bx bx-user-circle'></i> ${o.autor}</span></td>
                <td>${formatoFecha(o.fecha_registro)}</td>
                <td><button class="btn-eliminar-obs" onclick="eliminarObservacion(${o.id_observacion})" title="Eliminar"><i class='bx bx-trash'></i></button></td>
            </tr>
        `).join('');
    }

    totalTexto.textContent = `Total: ${filtradas.length} observación${filtradas.length !== 1 ? 'es' : ''} registrada${filtradas.length !== 1 ? 's' : ''}`;
}

function formatoFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function eliminarObservacion(id) {
    if (!confirm('¿Eliminar esta observación? Esta acción no se puede deshacer.')) return;
    try {
        await fetch(`${API_BASE}/observaciones/${id}/`, { method: 'DELETE' });
        await cargarObservaciones();
    } catch (e) {
        console.error('Error al eliminar la observación:', e);
        alert('Error de conexión al eliminar la observación.');
    }
}

function activarModal() {
    const modal = document.getElementById('modalNuevaObservacion');
    const btnAbrir = document.getElementById('btnNuevaObservacion');
    const btnCerrar = document.getElementById('btnCerrarModalObservacion');
    const btnGuardar = document.getElementById('btnGuardarObservacion');
    if (!modal || !btnAbrir) return;

    const cerrar = () => {
        modal.classList.add('hidden');
        document.getElementById('obs_modulo').value = 'general';
        document.getElementById('obs_autor').value = '';
        document.getElementById('obs_texto').value = '';
    };

    btnAbrir.addEventListener('click', () => modal.classList.remove('hidden'));
    btnCerrar.addEventListener('click', cerrar);
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrar(); });

    btnGuardar.addEventListener('click', async () => {
        const modulo = document.getElementById('obs_modulo').value;
        const autor = document.getElementById('obs_autor').value.trim();
        const texto = document.getElementById('obs_texto').value.trim();

        if (!autor || !texto) {
            alert('Completa el autor y la observación antes de guardar.');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/observaciones/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modulo, autor, texto })
            });
            if (!res.ok) throw new Error('Respuesta no exitosa del servidor');
            cerrar();
            await cargarObservaciones();
        } catch (e) {
            console.error('Error al guardar la observación:', e);
            alert('Error de conexión al guardar la observación.');
        }
    });
}
