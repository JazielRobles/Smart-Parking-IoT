document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:3000/api';

    const userGreeting = document.getElementById('user-greeting');
    const logoutButton = document.getElementById('logout-button');
    const vehiculosTbody = document.querySelector('#vehiculos-table tbody');
    const transaccionesTbody = document.querySelector('#transacciones-table tbody');
    const btnAddVehiculo = document.getElementById('btn-add-vehiculo');
    
    const modalContainer = document.getElementById('modal-container');
    const modalVehiculo = document.getElementById('modal-vehiculo');
    const modalVehiculoTitulo = document.getElementById('modal-vehiculo-titulo');
    const formVehiculo = document.getElementById('form-vehiculo');
    const formPerfil = document.getElementById('form-perfil');

    const formRecarga = document.getElementById('form-recarga');
    const tarjetaUidSpan = document.getElementById('tarjeta-uid');
    const tarjetaSaldoSpan = document.getElementById('tarjeta-saldo');
    const tarjetaEstadoSpan = document.getElementById('tarjeta-estado');

    let currentUser;

    async function loadTarjetaData() {
        try {
            // Asumimos que el GET a /usuarios/:id devuelve la info de la tarjeta
            const userData = await fetchData(`/usuarios/${currentUser.id_usuario}`);
            if (userData.tarjeta) {
                tarjetaUidSpan.textContent = userData.tarjeta.uid_tarjeta;
                tarjetaSaldoSpan.textContent = `$${parseFloat(userData.tarjeta.saldo).toFixed(2)}`;
                tarjetaEstadoSpan.textContent = userData.tarjeta.estado.charAt(0).toUpperCase() + userData.tarjeta.estado.slice(1);
                tarjetaEstadoSpan.className = `status-${userData.tarjeta.estado}`; // Para CSS opcional
            }
        } catch (error) {
            console.error("Error al cargar datos de tarjeta:", error);
            tarjetaUidSpan.textContent = 'Error al cargar';
        }
    }

    function checkSession() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            window.location.href = '/login.html';
            return;
        }
        if (user.rol === 'administrador') {
            window.location.href = '/index.html';
            return;
        }
        currentUser = user;
        userGreeting.textContent = `Hola, ${currentUser.nombre}!`;
    }

    async function fetchData(endpoint, options = {}) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ocurrió un error.');
        }
        return response.json();
    }
    
    function populatePerfilForm() {
        document.getElementById('perfil-nombre').value = currentUser.nombre;
        document.getElementById('perfil-apellido').value = currentUser.apellido_paterno;
    }

    async function loadVehiculos() {
        try {
            const vehiculos = await fetchData(`/usuarios/${currentUser.id_usuario}/vehiculos`);
            vehiculosTbody.innerHTML = '';
            if (vehiculos.length === 0) {
                 vehiculosTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No tienes vehículos registrados.</td></tr>';
            } else {
                vehiculos.forEach(v => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${v.placa}</td>
                        <td>${v.marca}</td>
                        <td>${v.modelo || 'N/A'}</td>
                        <td>${v.tipo_vehiculo}</td>
                        <td class="action-buttons">
                            <button class="btn-edit-vehiculo" data-placa="${v.placa}"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete-vehiculo" data-placa="${v.placa}"><i class="fas fa-trash"></i></button>
                        </td>
                    `;
                    vehiculosTbody.appendChild(tr);
                });
            }
        } catch (error) { console.error(error); }
    }

    async function loadTransacciones() {
        try {
            const transacciones = await fetchData(`/usuarios/${currentUser.id_usuario}/transacciones`);
            transaccionesTbody.innerHTML = '';
             if (transacciones.length === 0) {
                 transaccionesTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No tienes transacciones registradas.</td></tr>';
            } else {
                transacciones.forEach(t => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${t.numero_cajon || 'N/A'}</td>
                        <td>${new Date(t.hora_entrada).toLocaleString()}</td>
                        <td>${t.hora_salida ? new Date(t.hora_salida).toLocaleString() : 'En curso'}</td>
                        <td>${t.total ? `$${parseFloat(t.total).toFixed(2)}` : '---'}</td>
                    `;
                    transaccionesTbody.appendChild(tr);
                });
            }
        } catch (error) { console.error(error); }
    }
    
    function openModal(modal) {
        modalContainer.classList.add('active');
        modal.style.display = 'block';
    }
    
    function closeModal() {
        modalContainer.classList.remove('active');
        modalContainer.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }

    btnAddVehiculo.addEventListener('click', () => {
        formVehiculo.reset();
        modalVehiculoTitulo.textContent = 'Añadir Vehículo';
        document.getElementById('vehiculo-placa-original').value = '';
        document.getElementById('vehiculo-placa').disabled = false;
        openModal(modalVehiculo);
    });
    
    vehiculosTbody.addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit-vehiculo');
        const btnDelete = e.target.closest('.btn-delete-vehiculo');
        
        if (btnEdit) {
            const placa = btnEdit.dataset.placa;
            const vehiculo = (await fetchData(`/usuarios/${currentUser.id_usuario}/vehiculos`)).find(v => v.placa === placa);
            if (vehiculo) {
                formVehiculo.reset();
                modalVehiculoTitulo.textContent = 'Editar Vehículo';
                document.getElementById('vehiculo-placa-original').value = vehiculo.placa;
                document.getElementById('vehiculo-placa').value = vehiculo.placa;
                document.getElementById('vehiculo-placa').disabled = true; 
                document.getElementById('vehiculo-marca').value = vehiculo.marca;
                document.getElementById('vehiculo-modelo').value = vehiculo.modelo;
                document.getElementById('vehiculo-tipo').value = vehiculo.tipo_vehiculo;
                openModal(modalVehiculo);
            }
        }
        
        if (btnDelete) {
            const placa = btnDelete.dataset.placa;
            if (confirm(`¿Estás seguro de que deseas eliminar el vehículo con placa ${placa}?`)) {
                try {
                    await fetchData(`/vehiculos/${placa}`, { method: 'DELETE' });
                    loadVehiculos();
                } catch (error) {
                    alert('Error al eliminar el vehículo: ' + error.message);
                }
            }
        }
    });
    
    formVehiculo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const placaOriginal = document.getElementById('vehiculo-placa-original').value;
        const isEditing = !!placaOriginal;
        
        const body = {
            placa: document.getElementById('vehiculo-placa').value,
            marca: document.getElementById('vehiculo-marca').value,
            modelo: document.getElementById('vehiculo-modelo').value,
            color: document.getElementById('vehiculo-color').value,
            tipo_vehiculo: document.getElementById('vehiculo-tipo').value,
            id_usuario: currentUser.id_usuario
        };
        
        const endpoint = isEditing ? `/vehiculos/${placaOriginal}` : '/vehiculos';
        const method = isEditing ? 'PUT' : 'POST';
        
        if (isEditing) {
            delete body.id_usuario; 
            if (body.placa !== placaOriginal) body.nueva_placa = body.placa; 
            document.getElementById('vehiculo-placa').disabled = false;
        }

        try {
            await fetchData(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            closeModal();
            loadVehiculos();
        } catch (error) {
            alert('Error al guardar el vehículo: ' + error.message);
        }
    });
    
    formPerfil.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            nombre: document.getElementById('perfil-nombre').value,
            apellido_paterno: document.getElementById('perfil-apellido').value,
            telefono: document.getElementById('perfil-telefono').value,
            id_usuario_solicitante: currentUser.id_usuario,
            rol_solicitante: currentUser.rol,
        };
        const contrasena = document.getElementById('perfil-contrasena').value;
        if (contrasena) {
            body.contrasena = contrasena;
        }

        try {
            await fetchData(`/usuarios/${currentUser.id_usuario}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            alert('Perfil actualizado exitosamente.');
            currentUser.nombre = body.nombre;
            currentUser.apellido_paterno = body.apellido_paterno;
            localStorage.setItem('user', JSON.stringify(currentUser));
            userGreeting.textContent = `Hola, ${currentUser.nombre}!`;

        } catch (error) {
            alert('Error al actualizar el perfil: ' + error.message);
        }
    });

    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer || e.target.closest('.btn-close-modal')) {
            closeModal();
        }
    });

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    });

    formRecarga.addEventListener('submit', async (e) => {
        e.preventDefault();
        const monto = document.getElementById('recarga-monto').value;
        if (!monto || monto <= 0) {
            alert('Por favor, introduce un monto válido.');
            return;
        }
        
        try {
            await fetchData(`/usuarios/${currentUser.id_usuario}/tarjeta/recargar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monto: parseFloat(monto) })
            });
            alert('¡Recarga exitosa!');
            formRecarga.reset();
            loadTarjetaData(); // Actualizar la info en pantalla
        } catch (error) {
            alert('Error al recargar saldo: ' + error.message);
        }
    });


    checkSession();
    populatePerfilForm();
    loadVehiculos();
    loadTransacciones();
    loadTarjetaData();
});