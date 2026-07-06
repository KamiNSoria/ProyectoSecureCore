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

    // Menú desplegable con la opción de cerrar sesión
    perfil.classList.add('user-profile-clickable');
    const menu = document.createElement('div');
    menu.className = 'user-profile-menu';
    menu.innerHTML = `<button type="button" class="user-profile-logout"><i class='bx bx-log-out'></i> Cerrar sesión</button>`;
    perfil.appendChild(menu);

    perfil.addEventListener('click', () => {
        perfil.classList.toggle('abierto');
    });

    document.addEventListener('click', (e) => {
        if (!perfil.contains(e.target)) perfil.classList.remove('abierto');
    });

    menu.querySelector('.user-profile-logout').addEventListener('click', (e) => {
        e.stopPropagation();
        localStorage.removeItem('securecore_token');
        localStorage.removeItem('securecore_user');
        const rutaLogin = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
        window.location.href = rutaLogin;
    });
});
