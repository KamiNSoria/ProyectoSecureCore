/* ==========================================================================
     Lógica interactiva para la página de Gestión de Activos (Conexión SQL)
   ========================================================================== */

// Esperamos a que la página cargue para ir a buscar los datos
document.addEventListener('DOMContentLoaded', () => {
    cargarActivosDesdeSQL();
    cargarTiposDeActivo(); 
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
                                        
                                        <span class="tag tag-critico">Impacto: ${activo.valor_final_max}</span>
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


// --- LÓGICA DEL FORMULARIO Y CONEXIÓN SQL (CREAR, EDITAR, ELIMINAR) ---

const modalTitulo = document.getElementById('modal-titulo');
const idActivoOculto = document.getElementById('in-id-activo');
const btnEliminarActivo = document.getElementById('btnEliminarActivo');

// 1. Al presionar "+ Registrar Nuevo Activo" (Modo Creación)
document.getElementById('btnAbrirModal').addEventListener('click', () => {
    modalTitulo.textContent = 'Registrar Nuevo Activo';
    idActivoOculto.value = ''; // Limpiamos el ID oculto
    btnEliminarActivo.classList.add('hidden'); // Ocultamos el botón eliminar
    document.getElementById('formNuevoActivo').reset(); // Limpiamos campos
    calcularCriticidad(); // Reseteamos el cálculo CIA
    document.getElementById('modalNuevoActivo').classList.remove('hidden');
});

// 2. Al presionar "Modificar activo" en alguna tarjeta (Modo Edición)
document.getElementById('contenedor-activos').addEventListener('click', (e) => {
    // Verificamos si se hizo clic en el botón de modificar
    const btnModificar = e.target.closest('.btn-modificar');
    
    if (btnModificar) {
        // Obtenemos el ID de la tarjeta donde se hizo clic
        const tarjeta = btnModificar.closest('.asset-card');
        const idActivo = tarjeta.id.replace('activo-', '');
        
        // Cambiamos la interfaz del modal
        modalTitulo.textContent = 'Modificar Activo';
        idActivoOculto.value = idActivo;
        btnEliminarActivo.classList.remove('hidden'); // Mostramos el botón eliminar
        
        // Le pedimos a SQL los datos exactos de este activo
        fetch(`http://127.0.0.1:8000/api/activos/${idActivo}/`)
            .then(res => res.json())
            .then(activo => {
                // Rellenamos el formulario con los datos de la base
                document.getElementById('in-nombre').value = activo.nombre_activo;
                document.getElementById('in-desc').value = activo.descripcion;
                document.getElementById('in-sistema').value = activo.sistema_involucrado;
                document.getElementById('in-propietario').value = activo.propietario_activo;
                document.getElementById('in-tipo').value = activo.id_tipo_activo || "";
                document.getElementById('in-ubicacion').value = activo.id_tipo_ubicacion || "";
                document.getElementById('in-estado').value = activo.id_estado_activo || "";
                
                // Rellenamos los radios del CIA (Asegúrate que tu API devuelva estos campos)
                if(activo.confidencialidad) document.querySelector(`input[name="conf"][value="${activo.confidencialidad}"]`).checked = true;
                if(activo.integridad) document.querySelector(`input[name="int"][value="${activo.integridad}"]`).checked = true;
                if(activo.disponibilidad) document.querySelector(`input[name="disp"][value="${activo.disponibilidad}"]`).checked = true;
                
                calcularCriticidad(); // Actualizamos el número gigante y colores
                document.getElementById('modalNuevoActivo').classList.remove('hidden');
            });
    }
});

// 3. Guardar en SQL (Detecta si es CREATE o UPDATE)
document.getElementById('btnGuardarActivo').addEventListener('click', () => {
    const idActual = idActivoOculto.value;


    const datosActivo = {
        nombre_activo: document.getElementById('in-nombre').value,
        descripcion: document.getElementById('in-desc').value,
        sistema_involucrado: document.getElementById('in-sistema').value,
        propietario_activo: document.getElementById('in-propietario').value,
        id_tipo_activo: parseInt(document.getElementById('in-tipo').value),
        id_tipo_ubicacion: parseInt(document.getElementById('in-ubicacion').value),
        id_estado_activo: parseInt(document.getElementById('in-estado').value),
        confidencialidad: parseInt(document.querySelector('input[name="conf"]:checked').value),
        integridad: parseInt(document.querySelector('input[name="int"]:checked').value),
        disponibilidad: parseInt(document.querySelector('input[name="disp"]:checked').value),
        
        // ¡LA SOLUCIÓN DEFINITIVA: ENVIAMOS AMBOS CAMPOS PARA QUE DJANGO NO SE QUEJE!
        nivel_impacto: parseInt(document.getElementById('valor-final-num').textContent),
        valor_final_max: parseInt(document.getElementById('valor-final-num').textContent)
    };


    // Si hay un ID, hacemos PUT (Actualizar). Si no, hacemos POST (Crear)
    const url = idActual ? `http://127.0.0.1:8000/api/activos/${idActual}/` : 'http://127.0.0.1:8000/api/activos/';
    const metodo = idActual ? 'PUT' : 'POST';

    fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActivo)
    })
    .then(respuesta => {
        if (respuesta.ok) {
            // Si todo sale bien
            cerrarModal();
            cargarActivosDesdeSQL(); 
            alert('¡Activo guardado exitosamente!');
        } else {
            // ¡AQUÍ ESTÁ LA MAGIA PARA VER EL ERROR REAL!
            return respuesta.json().then(errores => {
                console.error("🛑 EL BACKEND RECHAZÓ LOS DATOS POR ESTO:", errores);
                alert('El servidor rechazó los datos. Revisa la consola (F12) para ver el motivo exacto.');
            });
        }
    })
    .catch(error => {
        console.error("Error de conexión:", error);
    });
}); 

// 4. Eliminar de SQL
btnEliminarActivo.addEventListener('click', () => {
    const idActual = idActivoOculto.value;
    if (idActual) {
        const confirmar = confirm("¿Estás seguro de que deseas eliminar este activo definitivamente?");
        if (confirmar) {
            fetch(`http://127.0.0.1:8000/api/activos/${idActual}/`, {
                method: 'DELETE'
            })
            .then(respuesta => {
                if (respuesta.ok) {
                    cerrarModal();
                    cargarActivosDesdeSQL(); // Recarga las tarjetas
                }
            });
        }
    }
});