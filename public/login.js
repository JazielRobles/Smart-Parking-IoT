document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:3000/api';
    const loginForm = document.getElementById('login-form');

    if (localStorage.getItem('user')) {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user.rol === 'administrador') {
            window.location.href = '/index.html';
        } else {
            window.location.href = '/usuario.html';
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const correo = document.getElementById('correo').value;
        const contrasena = document.getElementById('contrasena').value;

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, contrasena })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Credenciales inválidas');
            }

            const user = await response.json();
            handleLoginSuccess(user);

        } catch (error) {
            alert(`Error al iniciar sesión: ${error.message}`);
        }
    });
});

function handleLoginSuccess(user) {
    localStorage.setItem('user', JSON.stringify(user));
    if (user.rol === 'administrador') {
        window.location.href = '/index.html';
    } else {
        window.location.href = '/usuario.html';
    }
}

async function handleGoogleSignIn(response) {
    const API_BASE_URL = 'http://localhost:3000/api';
    try {
        const res = await fetch(`${API_BASE_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential })
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Falló la autenticación con Google');
        }
        const user = await res.json();
        handleLoginSuccess(user);
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}