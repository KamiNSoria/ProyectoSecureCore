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
});

// --- FUNCIÓN MEJORADA: Cargar Tipos de Activos ---
async function cargarTiposDeActivo() {
    try {
        const respuesta = await fetch('http://127.0.0.1:8000/api/tipos-activo/');
        const tipos = await respuesta.json();
        
        catalogoTipos = tipos; // Guardamos en la variable global
        
        const selectTipo = document.getElementById('in-tipo');
        if(selectTipo) {
            selectTipo.innerHTML = '<option value="" disabled selected>Selecciona un tipo de activo...</option>';
            tipos.forEach(tipo => {
                const opcionHTML = `<option value="${tipo.id_tipo_activo}">[${tipo.codigo}] ${tipo.nombre_tipo}</option>`;
                selectTipo.innerHTML += opcionHTML;
            });
        }
    } catch (error) {
        console.error("Error al cargar los tipos de activo:", error);
        const selectTipo = document.getElementById('in-tipo');
        if(selectTipo) selectTipo.innerHTML = '<option value="" disabled>Error de conexión</option>';
    }
}

// --- FUNCIÓN MEJORADA: Cargar y Pintar Activos ---
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
                                        <span class="tag tag-tipo">${nombreTipoReal}</span>
                                        <span class="tag tag-estado ${claseEstado}">${nombreEstadoReal}</span>
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

// Función auxiliar para dibujar las "píldoras" de la matriz CIA dinámicamente
function generarPills(valor, tipo) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= valor) {
            html += `<span class="pill pill-${tipo}"></span>`;
        } else {
            html += `<span class="pill empty"></span>`;
        }
    }
    return html;
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

// --- F. LÓGICA PARA GUARDAR UN NUEVO ACTIVO (POST a la API) ---
const btnGuardarActivo = document.getElementById('btnGuardarActivo'); // ¡Cambiado para que coincida con el HTML!

if(btnGuardarActivo) {
    btnGuardarActivo.addEventListener('click', async (e) => {
        e.preventDefault(); // Evitamos que la página se recargue

        // 1. Recolectamos los datos del formulario (Asegúrate de que los IDs coincidan con tu HTML)
        const nombre = document.getElementById('in-nombre').value;
        const descripcion = document.getElementById('in-desc').value;
        const sistema = document.getElementById('in-sistema').value;
        const propietario = document.getElementById('in-propietario').value;
        const idTipoActivo = document.getElementById('in-tipo').value;
        
        // 2. Recolectamos los valores de la matriz CIA
        const conf = document.querySelector('input[name="conf"]:checked').value;
        const int = document.querySelector('input[name="int"]:checked').value;
        const disp = document.querySelector('input[name="disp"]:checked').value;
        
        // 3. Obtenemos los campos calculados (Valor Final y Nivel de Impacto)
        const valorFinal = document.getElementById('valor-final-num').textContent;
        // Limpiamos el texto del badge (ej. "Impacto Crítico" -> "Alto")
        let nivelImpacto = document.getElementById('valor-final-texto').textContent.replace('Impacto ', '');
        if (nivelImpacto === 'Crítico') nivelImpacto = 'Alto'; // Ajuste simple para que encaje en el VARCHAR(5) de tu BD
        if (nivelImpacto === 'Marginal') nivelImpacto = 'Bajo';

        // Validaciones básicas
        if (!nombre || !sistema || !idTipoActivo || !propietario) {
            alert('Por favor, llena todos los campos obligatorios del activo.');
            return;
        }

        // 4. Armamos el objeto JSON tal como lo espera tu API y tu modelo de Django
        const nuevoActivo = {
            nombre_activo: nombre,
            descripcion: descripcion,
            sistema_involucrado: sistema,
            propietario_activo: propietario,
            id_tipo_activo: parseInt(idTipoActivo),
            id_tipo_ubicacion: 1, // TODO: En el futuro, sacar de un select en el modal
            id_estado_activo: 1,  // TODO: En el futuro, sacar de un select en el modal
            confidencialidad: parseInt(conf),
            integridad: parseInt(int),
            disponibilidad: parseInt(disp),
            //valor_final_max: parseInt(valorFinal),
            //nivel_impacto: nivelImpacto
        };

        try {
            // 5. Enviamos la petición POST a la API
            const respuesta = await fetch('http://127.0.0.1:8000/api/activos/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(nuevoActivo)
            });

            if (respuesta.ok) {
                alert('¡Activo guardado exitosamente en SQL Server!');
                cerrarModal(); // Cerramos la ventana
                document.querySelector('form').reset(); // Limpiamos el formulario (asumiendo que los inputs están en un <form>)
                cargarActivosDesdeSQL(); // Recargamos la lista para ver el nuevo activo
            } else {
                const errorData = await respuesta.json();
                console.error('Error del servidor:', errorData);
                alert('Hubo un error al guardar. Revisa la consola.');
            }
        } catch (error) {
            console.error('Error de red:', error);
            alert('No se pudo conectar con el servidor.');
        }
    });
}