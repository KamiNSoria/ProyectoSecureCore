/* ==========================================================================
   LOGIN.JS - Autenticación contra la API de Django (DRF + SQL Server)
   ========================================================================= */

const API_BASE = 'http://127.0.0.1:8000/api';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-login');
    const alertBox = document.getElementById('login-alert');
    const btn = document.getElementById('btn-login');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-spinner');
    const toggleBtn = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');

    // Si ya hay una sesión guardada, saltar directo al dashboard
    if (localStorage.getItem('securecore_token')) {
        window.location.href = '../index.html';
        return;
    }

    toggleBtn.addEventListener('click', () => {
        const mostrando = passwordInput.type === 'password';
        passwordInput.type = mostrando ? 'text' : 'password';
        toggleBtn.innerHTML = mostrando ? "<i class='bx bx-show'></i>" : "<i class='bx bx-hide'></i>";
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        ocultarAlerta();

        const username = document.getElementById('username').value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            mostrarAlerta('Ingresa tu usuario y contraseña.');
            return;
        }

        setCargando(true);

        try {
            const res = await fetch(`${API_BASE}/auth/login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                mostrarAlerta(data.error || 'No se pudo iniciar sesión. Intenta de nuevo.');
                return;
            }

            // Guardar la sesión en el navegador
            localStorage.setItem('securecore_token', data.token);
            localStorage.setItem('securecore_user', JSON.stringify({
                id: data.user_id,
                username: data.username,
                email: data.email
            }));

            window.location.href = '../index.html';

        } catch (err) {
            console.error('Error de conexión:', err);
            mostrarAlerta('No se pudo conectar con el servidor. Verifica que el backend (runserver) esté activo.');
        } finally {
            setCargando(false);
        }
    });

    function mostrarAlerta(mensaje) {
        alertBox.textContent = mensaje;
        alertBox.hidden = false;
    }

    function ocultarAlerta() {
        alertBox.hidden = true;
        alertBox.textContent = '';
    }

    function setCargando(activo) {
        btn.disabled = activo;
        spinner.hidden = !activo;
        btnText.textContent = activo ? 'Ingresando...' : 'Ingresar';
    }
});