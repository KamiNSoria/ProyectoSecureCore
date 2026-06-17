/* ==========================================================================
     Lógica interactiva para la página de Gestión de Activos (Conexión SQL)
   ========================================================================== */

// Esperamos a que la página cargue para ir a buscar los datos
document.addEventListener('DOMContentLoaded', () => {
    cargarActivosDesdeSQL();
    cargarTiposDeActivo(); // <-- Agrega esta línea
});

// --- NUEVO: FUNCIÓN PARA TRAER DATOS DEL BACKEND ---
function cargarActivosDesdeSQL() {
    fetch('http://127.0.0.1:8000/api/activos/')
        .then(respuesta => respuesta.json())
        .then(datos_sql => {
            const contenedor = document.getElementById('contenedor-activos');
            contenedor.innerHTML = ''; // Limpiamos las tarjetas quemadas

            // Dibujamos las tarjetas de SQL
            datos_sql.forEach(activo => {
                
                // Asignamos iconos y colores según la categoría para mantener tu diseño
                let icono = 'bx-server';
                let claseEstado = 'estado-operativo';
                
                if(activo.tipo_activo === 'Software') icono = 'bx-code-alt';
                else if(activo.tipo_activo === 'Informacion') icono = 'bx-file';
                
                const tarjetaHTML = `
                    <div class="asset-card" id="activo-${activo.id_activo}" data-categoria="${activo.tipo_activo ? activo.tipo_activo.toLowerCase() : 'hardware'}">
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
                                <div class="cia-row"><small>C</small> <div class="pills"><span class="pill pill-c"></span><span class="pill pill-c"></span><span class="pill pill-c"></span><span class="pill empty"></span><span class="pill empty"></span></div></div>
                                <div class="cia-row"><small>I</small> <div class="pills"><span class="pill pill-i"></span><span class="pill pill-i"></span><span class="pill pill-i"></span><span class="pill empty"></span><span class="pill empty"></span></div></div>
                                <div class="cia-row"><small>D</small> <div class="pills"><span class="pill pill-d"></span><span class="pill pill-d"></span><span class="pill pill-d"></span><span class="pill empty"></span><span class="pill empty"></span></div></div>
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

            // UNA VEZ CREADAS LAS TARJETAS, ENCENDEMOS TUS FUNCIONES
            activarTarjetasExpandibles();
            activarFiltros();
            
        })
        .catch(error => {
            console.error("Error al conectar con SQL:", error);
            document.getElementById('contenedor-activos').innerHTML = '<p style="color:red; padding:20px;">No se pudo conectar a la base de datos SQL Server.</p>';
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