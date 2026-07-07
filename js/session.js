/* ==========================================================================
   SESSION.JS - Menú de usuario (cerrar sesión), compartido en todas las páginas
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    const perfil = document.querySelector('.user-profile');
    if (!perfil) return;

    // Si hay una sesión guardada por login.js, mostramos el usuario real
    try {
        const sesion = JSON.parse(localStorage.getItem('securecore_user') || 'null');
        if (sesion && sesion.username) {
            const nombre = perfil.querySelector('.user-info strong');
            const avatar = perfil.querySelector('.avatar');
            if (nombre) nombre.textContent = sesion.username;
            if (avatar) avatar.textContent = sesion.username.slice(0, 2).toUpperCase();
        }
    } catch (e) {
        console.error('No se pudo leer la sesión guardada:', e);
    }

    // Menú desplegable con el interruptor de tema y la opción de cerrar sesión
    perfil.classList.add('user-profile-clickable');
    const esOscuro = document.documentElement.classList.contains('dark-mode');
    const menu = document.createElement('div');
    menu.className = 'user-profile-menu';
    menu.innerHTML = `
        <label class="theme-toggle-row" onclick="event.stopPropagation();">
            <span class="theme-toggle-label"><i class='bx ${esOscuro ? 'bx-moon' : 'bx-sun'}' id="theme-toggle-icon"></i> Modo oscuro</span>
            <span class="theme-switch">
                <input type="checkbox" id="theme-switch-input" ${esOscuro ? 'checked' : ''}>
                <span class="theme-switch-slider"></span>
            </span>
        </label>
        <button type="button" class="user-profile-logout"><i class='bx bx-log-out'></i> Cerrar sesión</button>
    `;
    perfil.appendChild(menu);

    perfil.addEventListener('click', () => {
        perfil.classList.toggle('abierto');
    });

    document.addEventListener('click', (e) => {
        if (!perfil.contains(e.target)) perfil.classList.remove('abierto');
    });

    menu.querySelector('#theme-switch-input').addEventListener('change', (e) => {
        const activarOscuro = e.target.checked;
        document.documentElement.classList.toggle('dark-mode', activarOscuro);
        localStorage.setItem('securecore_theme', activarOscuro ? 'dark' : 'light');
        const icono = document.getElementById('theme-toggle-icon');
        if (icono) icono.className = `bx ${activarOscuro ? 'bx-moon' : 'bx-sun'}`;
    });

    menu.querySelector('.user-profile-logout').addEventListener('click', (e) => {
        e.stopPropagation();
        localStorage.removeItem('securecore_token');
        localStorage.removeItem('securecore_user');
        const rutaLogin = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
        window.location.href = rutaLogin;
    });
});
