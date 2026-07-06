/* ==========================================================================
   REGISTRO.JS - Creación de cuenta contra la API de Django (DRF + SQL Server)
   ========================================================================= */

const API_BASE = 'http://127.0.0.1:8000/api';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-registro');
    const alertBox = document.getElementById('registro-alert');
    const btn = document.getElementById('btn-registro');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-spinner');

    const firstNameInput = document.getElementById('first_name');
    const lastNameInput = document.getElementById('last_name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const passwordConfirmInput = document.getElementById('password_confirm');
    const hints = document.querySelectorAll('#password-hints li');

    // Si ya hay una sesión guardada, saltar directo al dashboard
    if (localStorage.getItem('securecore_token')) {
        window.location.href = '../index.html';
        return;
    }

    // --- Mostrar/ocultar contraseña (ambos campos) ---
    function activarToggle(botonId, inputEl) {
        const boton = document.getElementById(botonId);
        boton.addEventListener('click', () => {
            const mostrando = inputEl.type === 'password';
            inputEl.type = mostrando ? 'text' : 'password';
            boton.innerHTML = mostrando ? "<i class='bx bx-show'></i>" : "<i class='bx bx-hide'></i>";
        });
    }
    activarToggle('toggle-password', passwordInput);
    activarToggle('toggle-password-confirm', passwordConfirmInput);

    // --- Checklist de requisitos de contraseña en vivo ---
    function evaluarContrasena(password) {
        return {
            longitud: password.length >= 8,
            mayuscula: /[A-Z]/.test(password),
            minuscula: /[a-z]/.test(password),
            numero: /\d/.test(password),
            especial: /[^A-Za-z0-9]/.test(password)
        };
    }

    function actualizarChecklist() {
        const resultado = evaluarContrasena(passwordInput.value);
        hints.forEach(li => {
            const regla = li.getAttribute('data-regla');
            const cumplido = !!resultado[regla];
            li.classList.toggle('cumplido', cumplido);
            const icono = li.querySelector('i');
            icono.className = cumplido ? 'bx bx-check-circle' : 'bx bx-circle';
        });
        return resultado;
    }

    passwordInput.addEventListener('input', actualizarChecklist);

    // --- Envío del formulario ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        ocultarAlerta();

        const first_name = firstNameInput.value.trim();
        const last_name = lastNameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const password_confirm = passwordConfirmInput.value;

        if (!first_name || first_name.length < 2) {
            mostrarAlerta('Ingresa un nombre válido (mínimo 2 caracteres).');
            return;
        }
        if (!last_name || last_name.length < 2) {
            mostrarAlerta('Ingresa un apellido válido (mínimo 2 caracteres).');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            mostrarAlerta('Ingresa un correo electrónico válido.');
            return;
        }

        const requisitos = actualizarChecklist();
        if (!Object.values(requisitos).every(Boolean)) {
            mostrarAlerta('La contraseña no cumple con todos los requisitos de seguridad.');
            return;
        }
        if (password !== password_confirm) {
            mostrarAlerta('Las contraseñas no coinciden.');
            return;
        }

        setCargando(true);

        try {
            const res = await fetch(`${API_BASE}/auth/registro/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first_name, last_name, email, password, password_confirm })
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                mostrarAlerta(data.error || 'No se pudo crear la cuenta. Revisa los datos.');
                return;
            }

            sessionStorage.setItem('securecore_correo_registrado', email);
            window.location.href = 'login.html?registrado=1';

        } catch (err) {
            console.error('Error de conexión:', err);
            mostrarAlerta('No se pudo conectar con el servidor. Verifica que el backend (runserver) esté activo.');
        } finally {
            setCargando(false);
        }
    });

    function mostrarAlerta(mensaje) {
        alertBox.textContent = mensaje;
        alertBox.classList.remove('exito');
        alertBox.hidden = false;
    }

    function ocultarAlerta() {
        alertBox.hidden = true;
        alertBox.textContent = '';
    }

    function setCargando(activo) {
        btn.disabled = activo;
        spinner.hidden = !activo;
        btnText.textContent = activo ? 'Creando cuenta...' : 'Crear cuenta';
    }
});
