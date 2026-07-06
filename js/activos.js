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

// --- FUNCIÓN MEJORADA: Cargar y Pintar Activos ---
function cargarActivosDesdeSQL() {
    fetch('http://127.0.0.1:8000/api/activos/')
        .then(respuesta => {
            if(!respuesta.ok) throw new Error("Fallo en la red");
            return respuesta.json();
        })
        .then(datos_sql => {
            activosGlobal = datos_sql; // <-- AGREGA ESTA LÍNEA
            const contenedor = document.getElementById('contenedor-activos');
            if(!contenedor) return;
            
            contenedor.innerHTML = ''; 

            datos_sql.forEach(activo => {
                try { // Envolvemos cada tarjeta en un try-catch por si una sola falla, las demás sigan cargando
                    
                    // 1. "Traducir" los IDs usando el catálogo
                    const tipoObjeto = catalogoTipos.find(t => t.id_tipo_activo === activo.id_tipo_activo);
                    const nombreTipoReal = tipoObjeto ? tipoObjeto.nombre_tipo : 'Desconocido';
                    const codigoTipoReal = tipoObjeto ? tipoObjeto.codigo : 'OTRO';
                    const etiquetaTipoReal = tipoObjeto ? `[${codigoTipoReal}] ${nombreTipoReal}` : 'Desconocido';
                    const claseColorTipo = obtenerClaseColorTipo(codigoTipoReal);

                    // PROTECCIÓN DE FECHAS: Solo formatear si realmente existe un valor válido
                    let fechaFormateada = 'N/A';
                    if(activo.fecha_registro) {
                        fechaFormateada = new Date(activo.fecha_registro).toLocaleDateString('es-EC', {
                            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        });
                    }

                    let fechaModFormateada = 'Sin modificaciones';
                    if(activo.fecha_modificacion) {
                        fechaModFormateada = new Date(activo.fecha_modificacion).toLocaleDateString('es-EC', {
                            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        });
                    }

                    // 2. Asignar iconos de forma dinámica
                    let icono = 'bx-server'; 
                    if(codigoTipoReal === 'SW') icono = 'bx-code-alt';
                    else if(codigoTipoReal === 'D') icono = 'bx-file';
                    else if(codigoTipoReal === 'S') icono = 'bx-cloud';
                    else if(codigoTipoReal === 'P') icono = 'bx-user';
                    
                    let claseEstado = 'estado-operativo'; 
                    let nombreEstadoReal = 'Operativo';
                    if(activo.id_estado_activo === 2) {
                        claseEstado = 'estado-mantenimiento'; 
                        nombreEstadoReal = 'En Mantenimiento';
                    } else if(activo.id_estado_activo === 3) {
                        claseEstado = 'estado-inactivo';
                        nombreEstadoReal = 'Inactivo / Retirado';
                    }
                    
                    const nivelImpactoReal = activo.nivel_impacto || activo.valor_final_max || 0;

                    // 3. Renderizar la tarjeta
                    const tarjetaHTML = `
                        <div class="asset-card" id="activo-${activo.id_activo}" data-categoria="${codigoTipoReal.toLowerCase()}" data-impacto="${nivelImpactoReal}" data-estado="${activo.id_estado_activo || ''}">
                            <div class="asset-card-main">
                                <div class="asset-info-wrapper">
                                    <div class="asset-icon"><i class='bx ${icono}'></i></div>
                                    <div class="asset-details">
                                        <strong class="toggle-desc" title="Haz clic para ver detalles" style="cursor:pointer;">
                                            <span class="asset-id">#ACT-${activo.id_activo}</span> ${activo.nombre_activo || 'Sin Nombre'} <i class='bx bx-chevron-down'></i>
                                        </strong>
                                        <div class="asset-tags">
                                            <span class="tag tag-tipo ${claseColorTipo}">${etiquetaTipoReal}</span>
                                            <span class="tag tag-estado ${claseEstado}">${nombreEstadoReal}</span>
                                            <span class="tag ${obtenerClaseImpacto(activo.nivel_impacto || activo.valor_final_max)}">Impacto: ${activo.nivel_impacto || activo.valor_final_max || '0'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="cia-metrics">
                                    <div class="cia-row"><small>C</small> <div class="pills">${generarPills(activo.confidencialidad || 0, 'c')}</div></div>
                                    <div class="cia-row"><small>I</small> <div class="pills">${generarPills(activo.integridad || 0, 'i')}</div></div>
                                    <div class="cia-row"><small>D</small> <div class="pills">${generarPills(activo.disponibilidad || 0, 'd')}</div></div>
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
                                </div>
                                <div class="asset-actions">
                                    <button class="btn-modificar" onclick="prepararEditar(${activo.id_activo})"><i class='bx bx-edit-alt'></i> Modificar activo</button>
                                </div>
                            </div> 
                        </div>
                    `;
                    
                    contenedor.innerHTML += tarjetaHTML;

                } catch (errTarjeta) {
                    // Si falla una tarjeta en específico, lo avisamos pero no rompemos el resto
                    console.error("Fallo al pintar el activo ID:", activo.id_activo, errTarjeta);
                }
            });

            activarTarjetasExpandibles();
            actualizarConteosFiltros(datos_sql);
            activarFiltros();
            actualizarResumenCriticidad(datos_sql); // <-- AGREGA ESTA LÍNEA
            
        })
        .catch(error => {
            console.error("Error definitivo al conectar con SQL:", error);
            const contenedor = document.getElementById('contenedor-activos');
            if(contenedor) contenedor.innerHTML = '<p style="color:red; padding:20px;">Error al cargar los activos.</p>';
        });
}

// Devuelve la misma clase de color que se usa en el modal al calcular el impacto (calcularCriticidad)
function obtenerClaseImpacto(valor) {
    const nivel = parseInt(valor) || 0;
    if (nivel === 5) return 'impacto-critico';
    if (nivel === 4) return 'impacto-alto';
    if (nivel === 3) return 'impacto-medio';
    if (nivel === 2) return 'impacto-bajo';
    return 'impacto-marginal';
}

// Asigna la misma agrupación de color que usan los botones de filtro ([D][K][Media]=azul, [SW][S]=verde, [HW][COM][AUX]=rojo, [P][L]=amarillo)
function obtenerClaseColorTipo(codigo) {
    const codigoNormalizado = (codigo || '').toLowerCase();
    if (['d', 'k', 'media'].includes(codigoNormalizado)) return 'f-info';
    if (['sw', 's'].includes(codigoNormalizado)) return 'f-soft';
    if (['hw', 'com', 'aux'].includes(codigoNormalizado)) return 'f-hard';
    if (['p', 'l'].includes(codigoNormalizado)) return 'f-pers';
    return '';
}

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


// NUEVA FUNCIÓN: Trae las categorías oficiales de MAGERIT desde SQL
function cargarTiposDeActivo() {
    fetch('http://127.0.0.1:8000/api/tipos-activo/')
        .then(respuesta => respuesta.json())
        .then(tipos => {
            // Guardamos el catálogo en memoria para poder "traducir" los IDs en las tarjetas
            catalogoTipos = tipos;

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
    document.getElementById('btnEliminarActivo').classList.add('hidden');
    calcularCriticidad();
    modal.classList.remove('hidden');
});

// Acceso directo desde el Panel: activos.html?accion=nuevo abre este modal automáticamente
if (new URLSearchParams(window.location.search).get('accion') === 'nuevo') {
    btnAbrir.click();
}

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


// --- E. LÓGICA DE BÚSQUEDA Y FILTRADO MULTIPLE (Refactorizado con filtros radio en columna lateral) ---
function activarFiltros() {
    const buscadorActivos = document.getElementById('buscadorActivos');
    const radiosTipo = document.querySelectorAll('input[name="filtro-tipo"]');
    const radiosImpacto = document.querySelectorAll('input[name="filtro-impacto"]');
    const radiosEstado = document.querySelectorAll('input[name="filtro-estado"]');
    const contadorActivos = document.getElementById('contadorActivos');
    const contenedorChips = document.getElementById('filtrosAplicados');
    const botonVerTodos = document.querySelector('.filtro-ver-todos');

    let filtroTipo = 'todos';
    let filtroImpacto = 'todos';
    let filtroEstado = 'todos';

    // Pinta las "chips" de filtros aplicados arriba de la lista, cada una con su botón de quitar (x)
    const renderChips = () => {
        const chips = [];
        if (filtroTipo !== 'todos') {
            const label = document.querySelector(`input[name="filtro-tipo"][value="${filtroTipo}"] + .filtro-radio-label`);
            chips.push({ grupo: 'tipo', texto: label ? label.textContent.trim() : filtroTipo });
        }
        if (filtroImpacto !== 'todos') {
            const label = document.querySelector(`input[name="filtro-impacto"][value="${filtroImpacto}"] + .filtro-radio-label`);
            chips.push({ grupo: 'impacto', texto: label ? label.textContent.trim() : filtroImpacto });
        }
        if (filtroEstado !== 'todos') {
            const label = document.querySelector(`input[name="filtro-estado"][value="${filtroEstado}"] + .filtro-radio-label`);
            chips.push({ grupo: 'estado', texto: label ? label.textContent.trim() : filtroEstado });
        }

        if (chips.length === 0) {
            contenedorChips.style.display = 'none';
            contenedorChips.innerHTML = '';
            return;
        }

        contenedorChips.style.display = 'flex';
        contenedorChips.innerHTML = '<span class="filtros-aplicados-titulo">Filtros aplicados:</span>' +
            chips.map(chip => `
                <span class="filtro-chip" data-grupo="${chip.grupo}">
                    ${chip.texto}
                    <button type="button" title="Quitar filtro"><i class='bx bx-x'></i></button>
                </span>
            `).join('');

        contenedorChips.querySelectorAll('.filtro-chip button').forEach(botonQuitar => {
            botonQuitar.addEventListener('click', () => {
                const grupo = botonQuitar.closest('.filtro-chip').getAttribute('data-grupo');
                if (grupo === 'tipo') { filtroTipo = 'todos'; document.querySelector('input[name="filtro-tipo"][value="todos"]').checked = true; }
                if (grupo === 'impacto') { filtroImpacto = 'todos'; document.querySelector('input[name="filtro-impacto"][value="todos"]').checked = true; }
                if (grupo === 'estado') { filtroEstado = 'todos'; document.querySelector('input[name="filtro-estado"][value="todos"]').checked = true; }
                filtrarActivos();
            });
        });
    };

    const filtrarActivos = () => {
        const textoBusqueda = buscadorActivos.value.toLowerCase();
        let activosVisibles = 0;

        // Lo movemos AQUI ADENTRO para que siempre busque las tarjetas frescas de SQL
        const tarjetasActivosDinámicas = document.querySelectorAll('.asset-card');

        tarjetasActivosDinámicas.forEach(tarjeta => {
            const categoriaTarjeta = tarjeta.getAttribute('data-categoria');
            const impactoTarjeta = tarjeta.getAttribute('data-impacto');
            const estadoTarjeta = tarjeta.getAttribute('data-estado');
            const textoTarjeta = tarjeta.innerText.toLowerCase();

            const coincideTexto = textoTarjeta.includes(textoBusqueda);
            const coincideTipo = (filtroTipo === 'todos') || (categoriaTarjeta === filtroTipo);
            const coincideImpacto = (filtroImpacto === 'todos') || (impactoTarjeta === filtroImpacto);
            const coincideEstado = (filtroEstado === 'todos') || (estadoTarjeta === filtroEstado);

            if (coincideTexto && coincideTipo && coincideImpacto && coincideEstado) {
                tarjeta.style.display = 'flex';
                activosVisibles++;
            } else {
                tarjeta.style.display = 'none';
            }
        });

        contadorActivos.textContent = `${activosVisibles} activo${activosVisibles !== 1 ? 's' : ''}`;
        renderChips();
    };

    buscadorActivos.addEventListener('input', filtrarActivos);

    radiosTipo.forEach(radio => {
        radio.addEventListener('change', (e) => {
            filtroTipo = e.currentTarget.value;
            filtrarActivos();
        });
    });

    radiosImpacto.forEach(radio => {
        radio.addEventListener('change', (e) => {
            filtroImpacto = e.currentTarget.value;
            filtrarActivos();
        });
    });

    radiosEstado.forEach(radio => {
        radio.addEventListener('change', (e) => {
            filtroEstado = e.currentTarget.value;
            filtrarActivos();
        });
    });

    // El botón "Ver todos" despliega el resto de las categorías de tipo de activo
    if (botonVerTodos) {
        botonVerTodos.addEventListener('click', () => {
            const extra = document.querySelector('.filtro-extra');
            const expandido = extra.classList.toggle('oculto') === false;
            botonVerTodos.textContent = expandido ? 'Ver menos' : 'Ver todos';
        });
    }

    filtrarActivos();
}

// --- ACTUALIZAR LOS CONTADORES "(N)" DE CADA OPCIÓN DE FILTRO EN LA COLUMNA LATERAL ---
function actualizarConteosFiltros(datos) {
    const conteoTipo = {};
    const conteoImpacto = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const conteoEstado = { 1: 0, 2: 0, 3: 0 };

    datos.forEach(activo => {
        const tipoObjeto = catalogoTipos.find(t => t.id_tipo_activo === activo.id_tipo_activo);
        const codigo = tipoObjeto ? tipoObjeto.codigo.toLowerCase() : 'otro';
        conteoTipo[codigo] = (conteoTipo[codigo] || 0) + 1;

        const nivel = activo.nivel_impacto || activo.valor_final_max || 0;
        if (conteoImpacto[nivel] !== undefined) conteoImpacto[nivel]++;

        if (conteoEstado[activo.id_estado_activo] !== undefined) conteoEstado[activo.id_estado_activo]++;
    });

    Object.keys(conteoTipo).forEach(codigo => {
        const span = document.getElementById(`count-tipo-${codigo}`);
        if (span) span.textContent = `(${conteoTipo[codigo]})`;
    });

    Object.keys(conteoImpacto).forEach(nivel => {
        const span = document.getElementById(`count-impacto-${nivel}`);
        if (span) span.textContent = `(${conteoImpacto[nivel]})`;
    });

    Object.keys(conteoEstado).forEach(estado => {
        const span = document.getElementById(`count-estado-${estado}`);
        if (span) span.textContent = `(${conteoEstado[estado]})`;
    });
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
        const btnEliminar = document.getElementById('btnEliminarActivo');
        btnEliminar.classList.remove('hidden');
        btnEliminar.onclick = () => eliminarActivo(id);
        document.getElementById('modalNuevoActivo').classList.remove('hidden'); 

        // Abrimos el modal quitando la clase hidden
        document.getElementById('modalNuevoActivo').classList.remove('hidden');

    } catch (error) {
        console.error("Error al preparar la edición:", error);
        alert("No se pudieron cargar los datos del activo para editar.");
    }
}

/* ==========================================================================
   NUEVO: Guardar activos en memoria + Resumen dinámico + Eliminar + Reporte
   ========================================================================== */

let activosGlobal = []; // Guardamos la última carga para el resumen y el reporte

// --- H. RESUMEN DE CRITICIDAD DINÁMICO ---
function actualizarResumenCriticidad(datos) {
    const niveles = {
        5: { label: 'Nivel Crítico (Nivel 5)', clase: 'fill-red', count: 0 },
        4: { label: 'Nivel Alto (Nivel 4)', clase: 'fill-orange', count: 0 },
        3: { label: 'Nivel Medio (Nivel 3)', clase: 'fill-yellow', count: 0 },
        2: { label: 'Nivel Bajo (Nivel 2)', clase: 'fill-green', count: 0 },
        1: { label: 'Nivel Marginal (Nivel 1)', clase: 'fill-gray', count: 0 }
    };

    datos.forEach(activo => {
        const nivel = activo.nivel_impacto || activo.valor_final_max || 0;
        if (niveles[nivel]) niveles[nivel].count++;
    });

    const numCriticos = document.getElementById('numCriticos');
    if (numCriticos) numCriticos.textContent = niveles[5].count;

    const contenedor = document.getElementById('riskBreakdownContainer');
    if (!contenedor) return;

    if (datos.length === 0) {
        contenedor.innerHTML = '<p style="color:#9ca3af; font-size:13px;">Aún no hay activos registrados.</p>';
        return;
    }

    const maxCount = Math.max(...Object.values(niveles).map(n => n.count), 1);
    let html = '';

    Object.keys(niveles).sort((a, b) => b - a).forEach(key => {
        const nivel = niveles[key];
        if (nivel.count === 0) return; // Solo mostramos niveles que realmente existen
        const porcentaje = Math.round((nivel.count / maxCount) * 100);
        html += `
            <div class="progress-item">
                <div class="progress-labels"><span>${nivel.label}</span><span>${nivel.count}</span></div>
                <div class="progress-track"><div class="progress-fill ${nivel.clase}" style="width: ${porcentaje}%;"></div></div>
            </div>
        `;
    });

    contenedor.innerHTML = html;
}

// --- I. ELIMINAR ACTIVO ---
async function eliminarActivo(id) {
    const confirmar = confirm('¿Estás seguro de eliminar este activo? Esta acción no se puede deshacer y también eliminará los riesgos asociados a él.');
    if (!confirmar) return;

    try {
        const respuesta = await fetch(`http://127.0.0.1:8000/api/activos/${id}/`, {
            method: 'DELETE'
        });

        if (respuesta.ok) {
            alert('Activo eliminado correctamente.');
            document.getElementById('modalNuevoActivo').classList.add('hidden');
            document.getElementById('formNuevoActivo').reset();
            idActivoEditar = null;
            cargarActivosDesdeSQL();
        } else {
            alert('No se pudo eliminar el activo (puede tener riesgos asociados que lo bloqueen).');
        }
    } catch (error) {
        console.error('Error al eliminar el activo:', error);
        alert('Error de conexión al intentar eliminar el activo.');
    }
}

// --- J. GENERAR REPORTE COMPLETO (Vista + Descarga Excel) ---
function generarReporte() {
    if (!activosGlobal || activosGlobal.length === 0) {
        alert('No hay activos registrados para generar el reporte.');
        return;
    }

    const niveles = { 5: 'Crítico', 4: 'Alto', 3: 'Medio', 2: 'Bajo', 1: 'Marginal' };
    const fecha = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' });

    let filas = '';
    activosGlobal.forEach(activo => {
        const nivel = activo.nivel_impacto || activo.valor_final_max || 0;
        const tipoObjeto = catalogoTipos.find(t => t.id_tipo_activo === activo.id_tipo_activo);
        const nombreTipo = tipoObjeto ? `[${tipoObjeto.codigo}] ${tipoObjeto.nombre_tipo}` : 'N/A';

        let fechaReg = 'N/A';
        if (activo.fecha_registro) {
            fechaReg = new Date(activo.fecha_registro).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        filas += `
            <tr>
                <td>#ACT-${activo.id_activo}</td>
                <td>${activo.nombre_activo}</td>
                <td>${nombreTipo}</td>
                <td>${activo.descripcion || 'N/A'}</td>
                <td>${activo.sistema_involucrado || 'N/A'}</td>
                <td>${activo.area_trabajo || 'N/A'}</td>
                <td>${activo.cargo_administrative || 'N/A'}</td>
                <td>${activo.funcion_activo || 'N/A'}</td>
                <td>${activo.sensibilidad || 'N/A'}</td>
                <td>${activo.confidencialidad}</td>
                <td>${activo.integridad}</td>
                <td>${activo.disponibilidad}</td>
                <td><strong>${nivel} - ${niveles[nivel] || 'N/A'}</strong></td>
                <td>${fechaReg}</td>
            </tr>
        `;
    });

    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <html>
        <head>
            <title>Reporte de Criticidad de Activos - SecureCore</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #1f2937; }
                h1 { color: #4f46e5; margin-bottom: 4px; }
                p.fecha { color: #6b7280; margin-top: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 12px; }
                th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
                th { background: #f3f4f6; }
                .botones { margin-top: 20px; display: flex; gap: 12px; }
                button { padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; }
                .btn-print { background: #e5e7eb; color: #1f2937; }
                .btn-excel { background: #16a34a; color: white; }
                @media print { .botones { display: none; } }
            </style>
        </head>
        <body>
            <h1>Reporte de Gestión de Activos</h1>
            <p class="fecha">Generado el ${fecha} — SecureCore Plataforma de Riesgo</p>
            <p>Total de activos registrados: <strong>${activosGlobal.length}</strong></p>
            <table>
                <thead>
                    <tr>
                        <th>ID</th><th>Nombre</th><th>Tipo</th><th>Descripción</th><th>Sistema</th>
                        <th>Área</th><th>Cargo Admin.</th><th>Función</th><th>Sensibilidad</th>
                        <th>C</th><th>I</th><th>D</th><th>Nivel Impacto</th><th>Fecha Registro</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
            <div class="botones">
                <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
            </div>
        </body>
        </html>
    `);
    ventana.document.close();

    // Descarga automática del Excel también
    descargarExcelActivos();
}

// --- K. DESCARGAR REPORTE COMO EXCEL (.xlsx) ---
function descargarExcelActivos() {
    if (typeof XLSX === 'undefined') {
        alert('No se pudo cargar la librería de Excel. Verifica tu conexión a internet.');
        return;
    }

    const niveles = { 5: 'Crítico', 4: 'Alto', 3: 'Medio', 2: 'Bajo', 1: 'Marginal' };

    const datosExcel = activosGlobal.map(activo => {
        const nivel = activo.nivel_impacto || activo.valor_final_max || 0;
        const tipoObjeto = catalogoTipos.find(t => t.id_tipo_activo === activo.id_tipo_activo);
        const nombreTipo = tipoObjeto ? `[${tipoObjeto.codigo}] ${tipoObjeto.nombre_tipo}` : 'N/A';

        let fechaReg = 'N/A';
        if (activo.fecha_registro) {
            fechaReg = new Date(activo.fecha_registro).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        return {
            'ID': `#ACT-${activo.id_activo}`,
            'Nombre': activo.nombre_activo,
            'Tipo': nombreTipo,
            'Descripción': activo.descripcion || 'N/A',
            'Sistema Involucrado': activo.sistema_involucrado || 'N/A',
            'Área de Trabajo': activo.area_trabajo || 'N/A',
            'Cargo Administrativo': activo.cargo_administrative || 'N/A',
            'Función': activo.funcion_activo || 'N/A',
            'Sensibilidad ISO': activo.sensibilidad || 'N/A',
            'Confidencialidad': activo.confidencialidad,
            'Integridad': activo.integridad,
            'Disponibilidad': activo.disponibilidad,
            'Nivel de Impacto': `${nivel} - ${niveles[nivel] || 'N/A'}`,
            'Fecha de Registro': fechaReg
        };
    });

    const hoja = XLSX.utils.json_to_sheet(datosExcel);
    hoja['!cols'] = [
        { wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 40 }, { wch: 25 },
        { wch: 18 }, { wch: 22 }, { wch: 15 }, { wch: 14 }, { wch: 14 },
        { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 20 }
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Activos');

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `Reporte_Activos_SecureCore_${fechaArchivo}.xlsx`);
}

const linkReporte = document.getElementById('btnVerReporte');
if (linkReporte) {
    linkReporte.addEventListener('click', (e) => {
        e.preventDefault();
        generarReporte();
    });
}