/* ==========================================================================
     Lógica interactiva para la página de Gestión de Activos (Conexión SQL)
   ========================================================================== */

// Variables globales para guardar los catálogos en memoria y no hacer múltiples peticiones
let catalogoTipos = [];
let catalogoEstados = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Usamos 'await' para asegurar que primero bajen los catálogos antes de pintar las tarjetas
    await cargarTiposDeActivo(); 
    // Nota: Deberías hacer un endpoint similar para ParamEstadosActivo en tu API
    // await cargarEstadosDeActivo(); 
    
    cargarActivosDesdeSQL();
    cargarTiposDeActivo(); // <-- Agrega esta línea
});

// --- NUEVO: FUNCIÓN PARA TRAER DATOS DEL BACKEND ---
function cargarActivosDesdeSQL() {
    fetch('http://127.0.0.1:8000/api/activos/')
        .then(respuesta => respuesta.json())
        .then(datos_sql => {
            const contenedor = document.getElementById('contenedor-activos');
            if(!contenedor) return;
            
            contenedor.innerHTML = ''; 

            datos_sql.forEach(activo => {
                
                // 1. "Traducir" los IDs usando el catálogo que cargamos antes
                // Busca en el arreglo catalogoTipos el objeto cuyo ID coincida con la llave foránea del activo
                const tipoObjeto = catalogoTipos.find(t => t.id_tipo_activo === activo.id_tipo_activo);
                const nombreTipoReal = tipoObjeto ? tipoObjeto.nombre_tipo : 'Desconocido';
                const codigoTipoReal = tipoObjeto ? tipoObjeto.codigo : '';
                
                // 2. Asignar iconos de forma dinámica basándonos en el código de SQL Server
                let icono = 'bx-server'; // Por defecto (Hardware)
                if(codigoTipoReal === 'SW') icono = 'bx-code-alt';
                else if(codigoTipoReal === 'D') icono = 'bx-file';
                else if(codigoTipoReal === 'S') icono = 'bx-cloud';
                else if(codigoTipoReal === 'P') icono = 'bx-user';
                
                // TODO: Necesitas hacer lo mismo con id_estado_activo. Por ahora, forzamos un valor para el diseño.
                let claseEstado = 'estado-operativo'; 
                let nombreEstadoReal = 'Operativo';
                
                // 3. Renderizar la tarjeta
                const tarjetaHTML = `
                    <div class="asset-card" id="activo-${activo.id_activo}" data-categoria="${codigoTipoReal.toLowerCase()}">
                        <div class="asset-card-main">
                            <div class="asset-info-wrapper">
                                <div class="asset-icon"><i class='bx ${icono}'></i></div>
                                <div class="asset-details">
                                    <strong class="toggle-desc" title="Haz clic para ver detalles" style="cursor:pointer;">
                                        <span class="asset-id">#ACT-${activo.id_activo}</span> ${activo.nombre_activo} <i class='bx bx-chevron-down'></i>
                                    </strong>
                                    <div class="asset-tags">
                                        <span class="tag tag-tipo">${activo.tipo_activo || 'N/A'}</span>
                                        <span class="tag tag-estado ${claseEstado}">${activo.estado_activo || 'Activo'}</span>
                                        <span class="tag tag-critico">Impacto: ${activo.nivel_impacto}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="cia-metrics">
                                <div class="cia-row"><small>C</small> <div class="pills">${generarPills(activo.confidencialidad, 'c')}</div></div>
                                <div class="cia-row"><small>I</small> <div class="pills">${generarPills(activo.integridad, 'i')}</div></div>
                                <div class="cia-row"><small>D</small> <div class="pills">${generarPills(activo.disponibilidad, 'd')}</div></div>
                            </div>
                        </div>
                        <div class="asset-extra-info">
                            <p class="asset-description"><strong>Descripción:</strong> ${activo.descripcion || 'Sin descripción detallada.'}</p>
                            <div class="extra-grid">
                                <div class="extra-item"><span>Sistema Involucrado:</span> ${activo.sistema_involucrado || 'N/A'}</div>
                                <div class="extra-item"><span>Propietario:</span> ${activo.propietario_activo || 'N/A'}</div>
                            </div>
                            <div class="asset-actions">
                                <button class="btn-modificar"><i class='bx bx-edit-alt'></i> Modificar activo</button>
                            </div>
                        </div>
                    </div>
                `;
                contenedor.innerHTML += tarjetaHTML;
            });

            activarTarjetasExpandibles();
            activarFiltros();
            
        })
        .catch(error => {
            console.error("Error al conectar con SQL:", error);
            const contenedor = document.getElementById('contenedor-activos');
            if(contenedor) contenedor.innerHTML = '<p style="color:red; padding:20px;">Error al cargar los activos.</p>';
        });
}


// NUEVA FUNCIÓN: Trae las categorías oficiales de MAGERIT desde SQL
function cargarTiposDeActivo() {
    fetch('http://127.0.0.1:8000/api/tipos-activo/')
        .then(respuesta => respuesta.json())
        .then(tipos => {
            const selectTipo = document.getElementById('in-tipo');
            
            // Limpiamos el "Cargando..." y ponemos el texto inicial
            selectTipo.innerHTML = '<option value="" disabled selected>Selecciona un tipo de activo...</option>';

            // Recorremos la tabla Param_Tipos_Activo
            tipos.forEach(tipo => {
                // Combinamos el código y el nombre que tienes en SQL (Ej: "[D] Datos / Información")
                // Asegúrate de que 'id_tipo_activo', 'codigo' y 'nombre_tipo' sean los nombres exactos de tus columnas
                const opcionHTML = `<option value="${tipo.id_tipo_activo}">[${tipo.codigo}] ${tipo.nombre_tipo}</option>`;
                selectTipo.innerHTML += opcionHTML;
            });
        })
        .catch(error => {
            console.error("Error al cargar los tipos de activo:", error);
            document.getElementById('in-tipo').innerHTML = '<option value="" disabled>Error de conexión</option>';
        });
}


// --- A. LÓGICA DEL MODAL ---
const modal = document.getElementById('modalNuevoActivo');
const btnAbrir = document.getElementById('btnAbrirModal');
const btnCerrar = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelarModal');

btnAbrir.addEventListener('click', () => { modal.classList.remove('hidden'); });

const cerrarModal = () => { modal.classList.add('hidden'); };
btnCerrar.addEventListener('click', cerrarModal);
btnCancelar.addEventListener('click', cerrarModal);

modal.addEventListener('click', (evento) => {
    if (evento.target === modal) { cerrarModal(); }
});


// --- B. LÓGICA DE LAS TARJETAS EXPANDIBLES (Refactorizado) ---
function activarTarjetasExpandibles() {
    const botonesExpandir = document.querySelectorAll('.toggle-desc');
    botonesExpandir.forEach(boton => {
        boton.addEventListener('click', (e) => {
            const tarjetaActivo = e.target.closest('.asset-card');
            tarjetaActivo.classList.toggle('expanded');
        });
    });
}


// --- C y D. LÓGICA DEL CALCULO CIA (Igual) ---
const metricasCIA = [
    { name: 'conf', idTexto: 'txt-nivel-conf' },
    { name: 'int',  idTexto: 'txt-nivel-int' },
    { name: 'disp', idTexto: 'txt-nivel-disp' }
];

metricasCIA.forEach(metrica => {
    const radios = document.querySelectorAll(`input[name="${metrica.name}"]`);
    const txtNivel = document.getElementById(metrica.idTexto);
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            txtNivel.textContent = 'NIVEL ' + e.target.value;
        });
    });
});

const calcularCriticidad = () => {
    const valConf = parseInt(document.querySelector('input[name="conf"]:checked').value);
    const valInt = parseInt(document.querySelector('input[name="int"]:checked').value);
    const valDisp = parseInt(document.querySelector('input[name="disp"]:checked').value);

    const valorFinal = Math.max(valConf, valInt, valDisp);
    document.getElementById('valor-final-num').textContent = valorFinal;

    const badgeTexto = document.getElementById('valor-final-texto');
    badgeTexto.classList.remove('impacto-critico', 'impacto-alto', 'impacto-medio', 'impacto-bajo', 'impacto-marginal');

    if (valorFinal === 5) {
        badgeTexto.textContent = "Impacto Crítico";
        badgeTexto.classList.add('impacto-critico');
    } else if (valorFinal === 4) {
        badgeTexto.textContent = "Impacto Alto";
        badgeTexto.classList.add('impacto-alto');
    } else if (valorFinal === 3) {
        badgeTexto.textContent = "Impacto Medio";
        badgeTexto.classList.add('impacto-medio');
    } else if (valorFinal === 2) {
        badgeTexto.textContent = "Impacto Bajo";
        badgeTexto.classList.add('impacto-bajo');
    } else {
        badgeTexto.textContent = "Impacto Marginal";
        badgeTexto.classList.add('impacto-marginal');
    }
};

const todosLosRadios = document.querySelectorAll('.rating-options input[type="radio"]');
todosLosRadios.forEach(radio => radio.addEventListener('change', calcularCriticidad));
calcularCriticidad();


// --- E. LÓGICA DE BÚSQUEDA Y FILTRADO MULTIPLE (Refactorizado) ---
function activarFiltros() {
    const buscadorActivos = document.getElementById('buscadorActivos');
    const botonesFiltro = document.querySelectorAll('.filter-btn');
    const contadorActivos = document.getElementById('contadorActivos');
    let filtroActual = 'todos';

    const filtrarActivos = () => {
        const textoBusqueda = buscadorActivos.value.toLowerCase();
        let activosVisibles = 0;
        
        // Lo movemos AQUI ADENTRO para que siempre busque las tarjetas frescas de SQL
        const tarjetasActivosDinámicas = document.querySelectorAll('.asset-card'); 

        tarjetasActivosDinámicas.forEach(tarjeta => {
            const categoriaTarjeta = tarjeta.getAttribute('data-categoria');
            const textoTarjeta = tarjeta.innerText.toLowerCase();

            const coincideTexto = textoTarjeta.includes(textoBusqueda);
            const coincideCategoria = (filtroActual === 'todos') || (categoriaTarjeta === filtroActual);

            if (coincideTexto && coincideCategoria) {
                tarjeta.style.display = 'flex';
                activosVisibles++;
            } else {
                tarjeta.style.display = 'none';
            }
        });

        contadorActivos.textContent = `${activosVisibles} activo${activosVisibles !== 1 ? 's' : ''}`;
    };

    buscadorActivos.addEventListener('input', filtrarActivos);

    botonesFiltro.forEach(boton => {
        boton.addEventListener('click', (e) => {
            botonesFiltro.forEach(b => b.classList.remove('active'));
            const botonClickeado = e.currentTarget;
            botonClickeado.classList.add('active');

            filtroActual = botonClickeado.getAttribute('data-categoria');
            filtrarActivos();
        });
    });

    filtrarActivos(); 
}