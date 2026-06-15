/* ==========================================================================
     Lógica interactiva para la página de Gestión de Activos
   ========================================================================== */

// --- A. LÓGICA DEL MODAL ---
const modal = document.getElementById('modalNuevoActivo');
const btnAbrir = document.getElementById('btnAbrirModal');
const btnCerrar = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelarModal');

// Abrir modal
btnAbrir.addEventListener('click', () => { 
    modal.classList.remove('hidden'); 
});

// Cerrar modal
const cerrarModal = () => { 
    modal.classList.add('hidden'); 
};

btnCerrar.addEventListener('click', cerrarModal);
btnCancelar.addEventListener('click', cerrarModal);

// Cerrar al hacer clic afuera
modal.addEventListener('click', (evento) => {
    if (evento.target === modal) { cerrarModal(); }
});

// --- B. LÓGICA DE LAS TARJETAS EXPANDIBLES ---
const botonesExpandir = document.querySelectorAll('.toggle-desc');

botonesExpandir.forEach(boton => {
    boton.addEventListener('click', (e) => {
        const tarjetaActivo = e.target.closest('.asset-card');
        tarjetaActivo.classList.toggle('expanded');
    });
});

// --- C. LÓGICA PARA ACTUALIZAR EL TEXTO "NIVEL X" (Refactorizado DRY) ---

// Aqui se agrupa las configuraciones que cambian en un arreglo para no repetir el codigo
const metricasCIA = [
    { name: 'conf', idTexto: 'txt-nivel-conf' },
    { name: 'int',  idTexto: 'txt-nivel-int' },
    { name: 'disp', idTexto: 'txt-nivel-disp' }
];

// Iteramos sobre cada configuración una sola vez
metricasCIA.forEach(metrica => {
    const radios = document.querySelectorAll(`input[name="${metrica.name}"]`);
    const txtNivel = document.getElementById(metrica.idTexto);
    
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            txtNivel.textContent = 'NIVEL ' + e.target.value;
        });
    });
});

// --- D. LÓGICA DE CÁLCULO AUTOMÁTICO (MAX) ---

// Función que calcula y pinta el resultado
const calcularCriticidad = () => {
    // 1. Obtener los valores actuales seleccionados y convertirlos a número (parseInt)
    const valConf = parseInt(document.querySelector('input[name="conf"]:checked').value);
    const valInt = parseInt(document.querySelector('input[name="int"]:checked').value);
    const valDisp = parseInt(document.querySelector('input[name="disp"]:checked').value);

    // 2. Calcular el valor máximo (Igual que MAX(C,I,D) en Excel)
    const valorFinal = Math.max(valConf, valInt, valDisp);

    // 3. Actualizar el número grande en el HTML
    document.getElementById('valor-final-num').textContent = valorFinal;

    // 4. Aplicar la condición lógica para el texto y los colores
    const badgeTexto = document.getElementById('valor-final-texto');
    
    // Primero limpiamos todos los colores viejos posibles
    badgeTexto.classList.remove('impacto-critico', 'impacto-alto', 'impacto-medio', 'impacto-bajo', 'impacto-marginal');

    // Evaluamos cada uno de los 5 niveles exactamente
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
        // Nivel 1
        badgeTexto.textContent = "Impacto Marginal";
        badgeTexto.classList.add('impacto-marginal');
    }
};

// Le decimos a TODOS los botoncitos que, si los clickean, ejecuten el cálculo
const todosLosRadios = document.querySelectorAll('.rating-options input[type="radio"]');
todosLosRadios.forEach(radio => {
    radio.addEventListener('change', calcularCriticidad);
});

// Ejecutamos la función una vez al cargar la página para que pinte el 3 (que viene por defecto)
calcularCriticidad();

// --- E. LÓGICA DE BÚSQUEDA Y FILTRADO MULTIPLE ---

// Seleccionamos los elementos clave del HTML
const buscadorActivos = document.getElementById('buscadorActivos');
const botonesFiltro = document.querySelectorAll('.filter-btn');
const tarjetasActivos = document.querySelectorAll('.asset-card');
const contadorActivos = document.getElementById('contadorActivos');

// Empezamos con el filtro "todos" por defecto
let filtroActual = 'todos';

const filtrarActivos = () => {
    // Tomamos el texto que el usuario escribió y lo pasamos a minúsculas
    const textoBusqueda = buscadorActivos.value.toLowerCase();
    let activosVisibles = 0;

    tarjetasActivos.forEach(tarjeta => {
        // Obtenemos la categoría de la tarjeta (hardware, software, etc.)
        const categoriaTarjeta = tarjeta.getAttribute('data-categoria');
        
        // Obtenemos toooodo el texto dentro de la tarjeta para buscar coincidencias
        const textoTarjeta = tarjeta.innerText.toLowerCase();

        // Verificamos si cumple ambas condiciones
        const coincideTexto = textoTarjeta.includes(textoBusqueda);
        const coincideCategoria = (filtroActual === 'todos') || (categoriaTarjeta === filtroActual);

        if (coincideTexto && coincideCategoria) {
            tarjeta.style.display = 'flex'; // Mostramos la tarjeta
            activosVisibles++;
        } else {
            tarjeta.style.display = 'none'; // Ocultamos la tarjeta
        }
    });

    // Actualizamos el número de activos encontrados (maneja singular y plural)
    contadorActivos.textContent = `${activosVisibles} activo${activosVisibles !== 1 ? 's' : ''}`;
};

// 1. Escuchar cuando el usuario escribe en el buscador
buscadorActivos.addEventListener('input', filtrarActivos);

// 2. Escuchar cuando el usuario hace clic en los botones de filtro
botonesFiltro.forEach(boton => {
    boton.addEventListener('click', (e) => {
        // Le quitamos el fondo oscuro (active) a todos los botones
        botonesFiltro.forEach(b => b.classList.remove('active'));
        
        // Se lo ponemos solo al botón que acabamos de clickear
        const botonClickeado = e.currentTarget;
        botonClickeado.classList.add('active');

        // Actualizamos nuestra variable de filtro y corremos la función
        filtroActual = botonClickeado.getAttribute('data-categoria');
        filtrarActivos();
    });
});

// Ejecutamos la función una vez al inicio para que el contador arranque correcto
filtrarActivos();