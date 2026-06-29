/* ==========================================================================
     Lógica interactiva para la página de Gestión de Activos (Conexión SQL)
   ========================================================================== */

// Variables globales para guardar los catálogos en memoria y no hacer múltiples peticiones
let catalogoTipos = [];
let catalogoEstados = [];
let idActivoEditar = null;

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
                
                // 1. "Traducir" los IDs usando el catálogo
                const tipoObjeto = catalogoTipos.find(t => t.id_tipo_activo === activo.id_tipo_activo);
                const nombreTipoReal = tipoObjeto ? tipoObjeto.nombre_tipo : 'Desconocido';
                const codigoTipoReal = tipoObjeto ? tipoObjeto.codigo : '';
                const fechaFormateada = activo.fecha_registro 
                    ? new Date(activo.fecha_registro).toLocaleDateString('es-EC', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })
                    : 'N/A';
                const fechaModFormateada = activo.fecha_modificacion 
                    ? new Date(activo.fecha_modificacion).toLocaleDateString('es-EC', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })
                    : 'Sin modificaciones';
                // 2. Asignar iconos de forma dinámica
                let icono = 'bx-server'; 
                if(codigoTipoReal === 'SW') icono = 'bx-code-alt';
                else if(codigoTipoReal === 'D') icono = 'bx-file';
                else if(codigoTipoReal === 'S') icono = 'bx-cloud';
                else if(codigoTipoReal === 'P') icono = 'bx-user';
                
                let claseEstado = 'estado-operativo'; 
                let nombreEstadoReal = 'Operativo';
                if(activo.id_estado_activo === 2) {
                    claseEstado = 'estado-mantenimiento'; // Asegúrate de tener esta clase en tu CSS si la usas
                    nombreEstadoReal = 'En Mantenimiento';
                } else if(activo.id_estado_activo === 3) {
                    claseEstado = 'estado-inactivo';
                    nombreEstadoReal = 'Inactivo / Retirado';
                }
                
                // ==========================================
                // 3. AQUÍ VA EL CAMBIO 2 (REEMPLAZA TU TARJETA VIEJA POR ESTA NUEVA)
                // ==========================================
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
                                        <span class="tag tag-critico">Impacto: ${activo.nivel_impacto || activo.valor_final_max}</span>
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
                                <div class="extra-item"><span>Área de Trabajo:</span> ${activo.area_trabajo || 'N/A'}</div>
                                <div class="extra-item"><span>Cargo Administrativo:</span> ${activo.cargo_administrative || 'N/A'}</div>
                                <div class="extra-item"><span>Función de Seguridad:</span> ${activo.funcion_activo || 'N/A'}</div>
                                <div class="extra-item"><span>Sensibilidad ISO:</span> Nivel ${activo.sensibilidad || 'N/A'}</div>
                                <div class="extra-item"><span>Fecha de Registro:</span> ${fechaFormateada}</div> 
                                <div class="extra-item"><span>Última Modificación:</span> ${fechaModFormateada}</div>
                            </div> <div class="asset-actions">
                                <button class="btn-modificar" onclick="prepararEditar(${activo.id_activo})"><i class='bx bx-edit-alt'></i> Modificar activo</button>
                            </div>
                        </div> </div>
                `;
                // ==========================================
                
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

btnAbrir.addEventListener('click', () => { 
    idActivoEditar = null; // Nos aseguramos que esté en modo crear
    document.querySelector('#modalNuevoActivo h2').textContent = "Registrar Nuevo Activo";
    document.getElementById('btnGuardarActivo').textContent = "Guardar Activo";
    document.getElementById('formNuevoActivo').reset();
    calcularCriticidad();
    modal.classList.remove('hidden'); 
});

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
const btnGuardarActivo = document.getElementById('btnGuardarActivo');

if(btnGuardarActivo) {
    btnGuardarActivo.addEventListener('click', async (e) => {
        e.preventDefault(); // Evitamos que la página se recargue

        // 1. Recolectamos los datos generales tradicionales
        const nombre = document.getElementById('in-nombre').value;
        const descripcion = document.getElementById('in-desc').value;
        const sistema = document.getElementById('in-sistema').value;
        const idTipoActivo = document.getElementById('in-tipo').value;
        const idUbicacion = document.getElementById('in-ubicacion').value;
        const idEstado = document.getElementById('in-estado').value;

        // 2. NUEVOS INPUTS: Capturamos los campos agregados para la norma ISO
        const areaTrabajo = document.getElementById('area_trabajo').value;
        const cargoAdmin = document.getElementById('cargo_admin').value;
        const sensibilidad = document.getElementById('sensibilidad_activo').value;
        const funcionActivo = document.getElementById('funcion_activo').value;
        
        // 3. Recolectamos los valores de la matriz CIA
        const conf = document.querySelector('input[name="conf"]:checked').value;
        const int = document.querySelector('input[name="int"]:checked').value;
        const disp = document.querySelector('input[name="disp"]:checked').value;
        const valorFinal = document.getElementById('valor-final-num').textContent;

        // Validaciones básicas de campos críticos
        if (!nombre || !sistema || !idTipoActivo) {
            alert('Por favor, llena los campos obligatorios del activo (Nombre, Sistema y Tipo).');
            return;
        }

        // 4. Armamos el objeto JSON exacto mapeado a tu models.py limpio
        const nuevoActivo = {
            nombre_activo: nombre,
            descripcion: descripcion,
            sistema_involucrado: sistema,
            id_tipo_activo: parseInt(idTipoActivo),
            id_tipo_ubicacion: parseInt(idUbicacion), 
            id_estado_activo: parseInt(idEstado), 
            
            // REGLA DE INTEGRIDAD: Espera un ID de usuario de auth_user (entero)
            // Mandamos temporalmente el ID 1 hasta que integremos tu Login real
            id_propietario: 1, 
            
            // Campos nuevos de texto y números
            area_trabajo: areaTrabajo || null,
            cargo_administrative: cargoAdmin || null,
            sensibilidad: sensibilidad ? parseInt(sensibilidad) : null,
            funcion_activo: funcionActivo || null,
            
            confidencialidad: parseInt(conf),
            integridad: parseInt(int),
            disponibilidad: parseInt(disp),
            
            // Descomensamos estos campos porque tu nueva tabla los acepta como enteros (INT)
            valor_final_max: parseInt(valorFinal),
            nivel_impacto: parseInt(valorFinal) 
        };

        let urlFinal = 'http://127.0.0.1:8000/api/activos/';
        let metodoHttp = 'POST';

        if (idActivoEditar !== null) {
            urlFinal = `http://127.0.0.1:8000/api/activos/${idActivoEditar}/`;
            metodoHttp = 'PUT';
        }

        try {
            // 5. Enviamos la petición a la API
            const respuesta = await fetch(urlFinal, {
                method: metodoHttp,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(nuevoActivo)
            });

            if (respuesta.ok) {
                alert(idActivoEditar !== null ? '¡Activo actualizado correctamente!' : '¡Activo guardado exitosamente!');
                
                cerrarModal(); 
                document.getElementById('formNuevoActivo').reset(); 
                
                // REGLA DE LIMPIEZA: Devolvemos el modal a su estado original "Crear"
                idActivoEditar = null;
                document.querySelector('#modalNuevoActivo h2').textContent = "Registrar Nuevo Activo";
                document.getElementById('btnGuardarActivo').textContent = "Guardar Activo";
                
                calcularCriticidad(); 
                cargarActivosDesdeSQL(); // Refresca las tarjetas
            } else {
                const errorData = await respuesta.json();
                console.error('Error del servidor:', errorData);
                alert('Hubo un error al procesar la solicitud.');
            }
        } catch (error) {
            console.error('Error de red:', error);
            alert('No se pudo conectar con el servidor.');
        }
    });
}

// --- G. LÓGICA PARA CARGAR DATOS EN MODO EDICIÓN ---
async function prepararEditar(id) {
    try {
        const respuesta = await fetch(`http://127.0.0.1:8000/api/activos/${id}/`);
        if (!respuesta.ok) throw new Error("No se pudo obtener el activo");
        
        const activo = await respuesta.json();
        
        // Guardamos el ID del activo que estamos editando globalmente
        idActivoEditar = id;

        // Cambiamos los textos del modal dinámicamente
        document.querySelector('#modalNuevoActivo h2').textContent = "Modificar Activo";
        document.getElementById('btnGuardarActivo').textContent = "Actualizar Cambios";

        // Llenamos los inputs normales
        document.getElementById('in-nombre').value = activo.nombre_activo;
        document.getElementById('in-desc').value = activo.descripcion || '';
        document.getElementById('in-sistema').value = activo.sistema_involucrado;
        document.getElementById('in-tipo').value = activo.id_tipo_activo;
        document.getElementById('in-ubicacion').value = activo.id_tipo_ubicacion;
        document.getElementById('in-estado').value = activo.id_estado_activo;
        document.getElementById('area_trabajo').value = activo.area_trabajo || '';
        document.getElementById('cargo_admin').value = activo.cargo_administrative || '';
        document.getElementById('sensibilidad_activo').value = activo.sensibilidad || '';
        document.getElementById('funcion_activo').value = activo.funcion_activo || '';

        // Marcamos los botones de radio correctos de la matriz CIA
        document.querySelector(`input[name="conf"][value="${activo.confidencialidad}"]`).checked = true;
        document.querySelector(`input[name="int"][value="${activo.integridad}"]`).checked = true;
        document.querySelector(`input[name="disp"][value="${activo.disponibilidad}"]`).checked = true;

        // Forzamos el recálculo visual de las etiquetas de impacto en el modal
        calcularCriticidad();

        // Abrimos el modal quitando la clase hidden
        document.getElementById('modalNuevoActivo').classList.remove('hidden');

    } catch (error) {
        console.error("Error al preparar la edición:", error);
        alert("No se pudieron cargar los datos del activo para editar.");
    }
}