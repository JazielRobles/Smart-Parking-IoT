document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:3000/api';

    const navButtons = document.querySelectorAll('.nav-button');
    const contentSections = document.querySelectorAll('.content-section');
    const modalContainer = document.getElementById('modal-container');
    const preloader = document.getElementById('preloader');
    const appView = document.getElementById('app-view');
    const logoutButton = document.getElementById('logout-button');
    const userGreeting = document.getElementById('user-greeting');

    const summaryOcupacion = document.getElementById('summary-ocupacion');
    const summaryOcupacionBar = document.getElementById('summary-ocupacion-bar');
    const summaryIngresos = document.getElementById('summary-ingresos');
    const summaryEstanciaPromedio = document.getElementById('summary-estancia-promedio');
    const summaryEntradasHoy = document.getElementById('summary-entradas-hoy');
    const gridEstacionamiento = document.getElementById('grid-estacionamiento');
    const notificationsList = document.getElementById('notifications-list');

    const transaccionesTbody = document.querySelector('#transacciones-table tbody');
    const usuariosTbody = document.querySelector('#usuarios-table tbody');
    const vehiculosTbody = document.querySelector('#vehiculos-table tbody');
    const cajonesTbody = document.querySelector('#cajones-table tbody');
    
    let activeSection = 'dashboard';
    let ingresosChart, ocupacionTipoChart;

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = `${button.dataset.target}-section`;
            activeSection = button.dataset.target;
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            contentSections.forEach(section => section.classList.toggle('active', section.id === targetId));
            loadDataForSection(activeSection);
        });
    });

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    });

    function loadDataForSection(sectionName) {
        switch(sectionName) {
            case 'dashboard': loadDashboardData(); break;
            case 'transacciones': loadTransacciones(); break;
            case 'usuarios': loadUsuarios(); break;
            case 'vehiculos': loadVehiculos(); break;
            case 'cajones': loadCajonesManagement(); break;
        }
    }

    async function loadDashboardData() {
        notificationsList.innerHTML = '';

        fetchData('/cajones').then(cajones => {
            const totalCajones = cajones.length;
            const ocupados = cajones.filter(c => !c.disponible).length;
            
            summaryOcupacion.textContent = `${ocupados} / ${totalCajones}`;
            summaryOcupacionBar.style.width = totalCajones > 0 ? `${(ocupados / totalCajones) * 100}%` : '0%';
            
            renderCajonesGrid(cajones);
            renderOcupacionTipoChart(cajones);

            const ocupacionRatio = totalCajones > 0 ? ocupados / totalCajones : 0;
            if (ocupacionRatio > 0.9) {
                notificationsList.innerHTML += `<li><i class="fas fa-exclamation-triangle" style="color: #ffc107;"></i> Alerta: Estacionamiento casi lleno (${(ocupacionRatio*100).toFixed(0)}%).</li>`;
            }
        }).catch(error => console.error("Error cargando cajones:", error));

        fetchData('/transacciones/hoy').then(transaccionesHoy => {
            const ingresosDia = transaccionesHoy.reduce((acc, t) => acc + (parseFloat(t.total) || 0), 0);
            const entradasHoy = transaccionesHoy.length;
            
            summaryIngresos.textContent = `$${ingresosDia.toFixed(2)}`;
            summaryEntradasHoy.textContent = entradasHoy;

            const transaccionesCompletadas = transaccionesHoy.filter(t => t.hora_salida);
            const totalMinutos = transaccionesCompletadas.reduce((acc, t) => acc + (t.tiempo_estacionado_min || 0), 0);
            const promedioMinutos = transaccionesCompletadas.length > 0 ? totalMinutos / transaccionesCompletadas.length : 0;
            const h = Math.floor(promedioMinutos / 60);
            const m = Math.round(promedioMinutos % 60);
            summaryEstanciaPromedio.textContent = `${h}h ${m}m`;
            
            renderIngresosChart(transaccionesHoy);

            const transaccionesLargas = transaccionesHoy.filter(t => !t.hora_salida && (new Date() - new Date(t.hora_entrada)) > 6 * 60 * 60 * 1000);
            transaccionesLargas.forEach(t => {
                notificationsList.innerHTML += `<li><i class="fas fa-clock" style="color: #dc3545;"></i> Atención: Vehículo ${t.placa || 'N/A'} ha excedido 6 horas.</li>`;
            });
            
            if (notificationsList.innerHTML === '') {
                notificationsList.innerHTML = `<li><i class="fas fa-check-circle" style="color: #198754;"></i> Todo en orden.</li>`;
            }
        }).catch(error => console.error("Error cargando transacciones:", error));
    }

    function renderCajonesGrid(cajones) {
        gridEstacionamiento.innerHTML = '';
        cajones.sort((a, b) => a.numero_cajon.localeCompare(b.numero_cajon)).forEach(cajon => {
            const cajonDiv = document.createElement('div');
            cajonDiv.className = `cajon ${cajon.disponible ? 'disponible' : 'ocupado'}`;
            cajonDiv.innerHTML = `${cajon.numero_cajon} <span class="cajon-type">${cajon.tipo_cajon.substring(0,4)}.</span>`;
            gridEstacionamiento.appendChild(cajonDiv);
        });
    }

    function renderIngresosChart(transacciones) {
        const ctx = document.getElementById('ingresos-chart').getContext('2d');
        const hourlyData = Array(24).fill(0);
        transacciones.forEach(t => { if (t.total && t.hora_salida) hourlyData[new Date(t.hora_salida).getHours()] += parseFloat(t.total); });
        if (ingresosChart) ingresosChart.destroy();
        ingresosChart = new Chart(ctx, { type: 'line', data: { labels: Array.from({ length: 24 }, (_, i) => `${i}:00`), datasets: [{ label: 'Ingresos por Hora', data: hourlyData, backgroundColor: 'rgba(54, 123, 245, 0.2)', borderColor: 'rgba(54, 123, 245, 1)', borderWidth: 2, tension: 0.4, fill: true }] }, options: { responsive: true, maintainAspectRatio: false } });
    }

    function renderOcupacionTipoChart(cajones) {
        const ctx = document.getElementById('ocupacion-tipo-chart').getContext('2d');
        const tipos = {};
        cajones.filter(c => !c.disponible).forEach(c => { tipos[c.tipo_cajon] = (tipos[c.tipo_cajon] || 0) + 1; });
        if (ocupacionTipoChart) ocupacionTipoChart.destroy();
        ocupacionTipoChart = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(tipos), datasets: [{ label: 'Ocupación Actual por Tipo', data: Object.values(tipos), backgroundColor: ['#367BF5', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14'], borderColor: '#fff', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '50%' } });
    }

    function renderTable(tbody, data, rowGenerator) {
        if (!tbody) return;
        tbody.innerHTML = ''; 

        if (!data || data.length === 0) {
            const colCount = tbody.closest('table').querySelector('thead tr').childElementCount;
            const tr = tbody.insertRow();
            const td = tr.insertCell();
            td.colSpan = colCount;
            td.textContent = 'No hay datos disponibles.';
            td.style.textAlign = 'center';
            td.style.padding = '2rem';
        } else {
            data.forEach(item => {
                const tr = rowGenerator(item);
                tbody.appendChild(tr);
            });
        }
    }

    async function loadTransacciones() {
        const transacciones = await fetchData('/transacciones');
        renderTable(transaccionesTbody, transacciones, t => {
            const tr = document.createElement('tr');
            tr.insertCell().textContent = t.id_transaccion;
            tr.insertCell().textContent = t.placa || 'N/A';
            tr.insertCell().textContent = t.numero_cajon || 'N/A';
            tr.insertCell().textContent = new Date(t.hora_entrada).toLocaleString();
            tr.insertCell().textContent = t.hora_salida ? new Date(t.hora_salida).toLocaleString() : '---';
            tr.insertCell().textContent = t.total ? `$${parseFloat(t.total).toFixed(2)}` : '---';
            tr.insertCell().textContent = t.estado_pago;
            const actionsCell = tr.insertCell();
            actionsCell.className = 'action-buttons';
            if (t.estado_pago === 'pendiente') {
                actionsCell.innerHTML = `<button class="btn-salida" data-id="${t.id_transaccion}">Registrar Salida</button>`;
            } else {
                actionsCell.innerHTML = `<button disabled>Finalizada</button>`;
            }
            return tr;
        });
    }

    async function loadUsuarios() {
        const usuarios = await fetchData('/usuarios');
        renderTable(usuariosTbody, usuarios, u => {
            const tr = document.createElement('tr');
            tr.insertCell().textContent = u.id_usuario;
            tr.insertCell().textContent = `${u.nombre} ${u.apellido_paterno}`;
            tr.insertCell().textContent = u.correo;
            tr.insertCell().textContent = u.rol;
            tr.insertCell().textContent = u.activo ? 'Sí' : 'No';
            const actionsCell = tr.insertCell();
            actionsCell.className = 'action-buttons';
            actionsCell.innerHTML = `
                <button class="btn-edit-usuario" data-id="${u.id_usuario}" aria-label="Editar usuario"><i class="fas fa-edit"></i></button>
                <button class="btn-delete-usuario" data-id="${u.id_usuario}" aria-label="Eliminar usuario"><i class="fas fa-trash"></i></button>
            `;
            return tr;
        });
    }

    async function loadVehiculos() {
        const vehiculos = await fetchData('/vehiculos');
        renderTable(vehiculosTbody, vehiculos, v => {
            const tr = document.createElement('tr');
            tr.insertCell().textContent = v.placa;
            tr.insertCell().textContent = v.marca;
            tr.insertCell().textContent = v.modelo || 'N/A';
            tr.insertCell().textContent = v.tipo_vehiculo;
            tr.insertCell().textContent = `${v.nombre} ${v.apellido_paterno}`;
            const actionsCell = tr.insertCell();
            actionsCell.className = 'action-buttons';
            actionsCell.innerHTML = `<button class="btn-detalles-vehiculo" data-placa="${v.placa}" aria-label="Ver detalles del vehículo"><i class="fas fa-info-circle"></i></button>`;
            return tr;
        });
    }

    async function loadCajonesManagement() {
        const cajones = await fetchData('/cajones');
        renderTable(cajonesTbody, cajones, c => {
            const tr = document.createElement('tr');
            tr.insertCell().textContent = c.id_cajon;
            tr.insertCell().textContent = c.numero_cajon;
            tr.insertCell().textContent = c.nivel;
            tr.insertCell().textContent = c.tipo_cajon;
            tr.insertCell().textContent = `$${parseFloat(c.tarifa_hora).toFixed(2)}`;
            tr.insertCell().textContent = c.disponible ? 'Sí' : 'No';
            const actionsCell = tr.insertCell();
            actionsCell.className = 'action-buttons';
            actionsCell.innerHTML = `
                <button class="btn-edit-cajon" data-id="${c.id_cajon}" aria-label="Editar cajón"><i class="fas fa-edit"></i></button>
                <button class="btn-delete-cajon" data-id="${c.id_cajon}" aria-label="Eliminar cajón"><i class="fas fa-trash"></i></button>
            `;
            return tr;
        });
    }

    const modalUsuario = document.getElementById('modal-usuario');
    const formUsuario = document.getElementById('form-usuario');
    const modalUsuarioTitulo = document.getElementById('modal-usuario-titulo');
    const btnAddUsuario = document.getElementById('btn-add-usuario');

    btnAddUsuario.addEventListener('click', () => {
        formUsuario.reset();
        document.getElementById('id_usuario_edit').value = '';
        modalUsuarioTitulo.textContent = 'Añadir Nuevo Usuario';
        modalContainer.classList.add('active');
        modalUsuario.style.display = 'block';
    });

    usuariosTbody.addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit-usuario');
        const btnDelete = e.target.closest('.btn-delete-usuario');
        if (btnEdit) {
            const id = btnEdit.dataset.id;
            const u = await fetchData(`/usuarios/${id}`);
            document.getElementById('id_usuario_edit').value = u.id_usuario;
            document.getElementById('usuario-nombre').value = u.nombre;
            document.getElementById('usuario-apellido-paterno').value = u.apellido_paterno;
            document.getElementById('usuario-correo').value = u.correo;
            document.getElementById('usuario-rol').value = u.rol;
            modalUsuarioTitulo.textContent = 'Editar Usuario';
            modalContainer.classList.add('active');
            modalUsuario.style.display = 'block';
        }
        if (btnDelete) {
            const id = btnDelete.dataset.id;
            if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
                await fetchData(`/usuarios/${id}`, { method: 'DELETE' });
                loadUsuarios();
            }
        }
    });

    formUsuario.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = formUsuario.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const loggedInUser = JSON.parse(localStorage.getItem('user'));
        if (!loggedInUser) {
            alert('Error de autenticación. Por favor, inicie sesión de nuevo.');
            submitButton.disabled = false;
            submitButton.innerHTML = 'Guardar Cambios';
            return;
        }

        const id = document.getElementById('id_usuario_edit').value;
        const body = {
            nombre: document.getElementById('usuario-nombre').value,
            apellido_paterno: document.getElementById('usuario-apellido-paterno').value,
            correo: document.getElementById('usuario-correo').value,
            rol: document.getElementById('usuario-rol').value,
            id_usuario_solicitante: loggedInUser.id_usuario,
            rol_solicitante: loggedInUser.rol
        };
        
        const contrasena = document.getElementById('usuario-contrasena').value;
        if (contrasena) body.contrasena = contrasena;

        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `/usuarios/${id}` : '/usuarios';
        
        try {
            await fetchData(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            modalContainer.classList.remove('active');
            modalUsuario.style.display = 'none';
            loadUsuarios();
        } catch (error) {
            alert('Error al guardar el usuario: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Guardar Cambios';
        }
    });

    const modalCajon = document.getElementById('modal-cajon');
    const formCajon = document.getElementById('form-cajon');
    const modalCajonTitulo = document.getElementById('modal-cajon-titulo');
    const btnAddCajon = document.getElementById('btn-add-cajon');

    btnAddCajon.addEventListener('click', () => {
        formCajon.reset();
        document.getElementById('id_cajon_edit').value = '';
        modalCajonTitulo.textContent = 'Añadir Nuevo Cajón';
        modalContainer.classList.add('active');
        modalCajon.style.display = 'block';
    });

    cajonesTbody.addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit-cajon');
        const btnDelete = e.target.closest('.btn-delete-cajon');
        if (btnEdit) {
            const id = btnEdit.dataset.id;
            const c = await fetchData(`/cajones/${id}`);
            document.getElementById('id_cajon_edit').value = c.id_cajon;
            document.getElementById('cajon-numero').value = c.numero_cajon;
            document.getElementById('cajon-nivel').value = c.nivel;
            document.getElementById('cajon-tipo').value = c.tipo_cajon;
            document.getElementById('cajon-tarifa').value = c.tarifa_hora;
            modalCajonTitulo.textContent = 'Editar Cajón';
            modalContainer.classList.add('active');
            modalCajon.style.display = 'block';
        }
        if (btnDelete) {
            const id = btnDelete.dataset.id;
            if (confirm('¿Estás seguro de que deseas eliminar este cajón?')) {
                await fetchData(`/cajones/${id}`, { method: 'DELETE' });
                loadCajonesManagement();
            }
        }
    });
    
    formCajon.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = formCajon.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const id = document.getElementById('id_cajon_edit').value;
        const body = {
            numero_cajon: document.getElementById('cajon-numero').value,
            nivel: document.getElementById('cajon-nivel').value,
            tipo_cajon: document.getElementById('cajon-tipo').value,
            tarifa_hora: document.getElementById('cajon-tarifa').value,
        };
        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `/cajones/${id}` : '/cajones';
        
        try {
            await fetchData(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            modalContainer.classList.remove('active');
            modalCajon.style.display = 'none';
            loadCajonesManagement();
        } catch (error) {
            alert('Error al guardar el cajón: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Guardar Cambios';
        }
    });

    const modalEntrada = document.getElementById('modal-entrada-manual');
    const formEntrada = document.getElementById('form-entrada-manual');
    const btnRegistrarEntrada = document.getElementById('btn-registrar-entrada');

    btnRegistrarEntrada.addEventListener('click', async () => {
        const [vehiculos, cajones] = await Promise.all([fetchData('/vehiculos'), fetchData('/cajones')]);
        const selectVehiculo = document.getElementById('entrada-vehiculo');
        selectVehiculo.innerHTML = '<option value="">-- Seleccione una placa --</option>';
        vehiculos.forEach(v => { selectVehiculo.innerHTML += `<option value="${v.id_vehiculo}">${v.placa} (${v.marca})</option>`; });
        const selectCajon = document.getElementById('entrada-cajon');
        selectCajon.innerHTML = '<option value="">-- Seleccione un cajón --</option>';
        cajones.filter(c => c.disponible).forEach(c => { selectCajon.innerHTML += `<option value="${c.id_cajon}">${c.numero_cajon} (${c.tipo_cajon})</option>`; });
        
        modalContainer.classList.add('active');
        modalEntrada.style.display = 'block';
    });
    
    formEntrada.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = formEntrada.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

        const body = {
            id_vehiculo: document.getElementById('entrada-vehiculo').value,
            id_cajon: document.getElementById('entrada-cajon').value,
        };
        try {
            await fetchData('/transacciones/entrada', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            modalContainer.classList.remove('active');
            modalEntrada.style.display = 'none';
            loadTransacciones();
            if (activeSection === 'dashboard') loadDashboardData();
        } catch (error) {
            alert('Error al registrar la entrada: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Registrar Entrada';
        }
    });

    transaccionesTbody.addEventListener('click', async (e) => {
        const btnSalida = e.target.closest('.btn-salida');
        if (btnSalida) {
            const id = btnSalida.dataset.id;
            if (confirm('¿Registrar la salida para esta transacción?')) {
                const res = await fetchData('/transacciones/salida', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_transaccion: id }) });
                alert(`Salida registrada. Total a pagar: $${res.total_a_pagar}`);
                loadTransacciones();
                if (activeSection === 'dashboard') loadDashboardData();
            }
        }
    });

    const modalDetallesVehiculo = document.getElementById('modal-detalles-vehiculo');
    if (vehiculosTbody) {
        vehiculosTbody.addEventListener('click', async (e) => {
            const button = e.target.closest('.btn-detalles-vehiculo');
            if (!button) return;
            const placa = button.dataset.placa;
            try {
                const data = await fetchData(`/vehiculos/${placa}`);
                document.getElementById('detalle-placa').textContent = data.placa;
                document.getElementById('detalle-marca').textContent = data.marca;
                document.getElementById('detalle-modelo').textContent = data.modelo || 'N/A';
                document.getElementById('detalle-color').textContent = data.color || 'N/A';
                document.getElementById('detalle-tipo').textContent = data.tipo_vehiculo;
                document.getElementById('detalle-propietario-nombre').textContent = `${data.nombre} ${data.apellido_paterno}`;
                document.getElementById('detalle-propietario-correo').textContent = data.correo;
                document.getElementById('detalle-propietario-telefono').textContent = data.telefono || 'No registrado';
                modalContainer.classList.add('active');
                modalDetallesVehiculo.style.display = 'block';
            } catch (error) { alert('No se pudieron cargar los detalles del vehículo.'); }
        });
    }

    const formReportes = document.getElementById('form-reportes');
    if (formReportes) {
        formReportes.addEventListener('submit', (e) => {
            e.preventDefault();
            const tipo = document.getElementById('reporte-tipo').value;
            const inicio = document.getElementById('reporte-fecha-inicio').value;
            const fin = document.getElementById('reporte-fecha-fin').value;
            const formato = document.getElementById('reporte-formato').value;
            const generarBtn = formReportes.querySelector('button[type="submit"]');
            if (!inicio || !fin) { alert('Por favor, selecciona un rango de fechas válido.'); return; }
            const query = `?tipo=${tipo}&formato=${formato}&fecha_inicio=${inicio}&fecha_fin=${fin}`;
            const reportUrl = `${API_BASE_URL}/reportes${query}`;
            generarBtn.disabled = true;
            generarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
            fetch(reportUrl)
                .then(res => {
                    if (res.ok) return res.blob();
                    throw new Error('No se pudo generar el reporte.');
                })
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `reporte_${tipo}_${inicio}_a_${fin}.${formato}`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                })
                .catch(error => { alert(error.message); })
                .finally(() => {
                    generarBtn.disabled = false;
                    generarBtn.innerHTML = '<i class="fas fa-download"></i> Generar Reporte';
                });
        });
    }

    document.getElementById('search-transacciones').addEventListener('input', e => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('#transacciones-table tbody tr').forEach(row => {
            row.style.display = row.cells[1].textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
        });
    });

    document.getElementById('search-usuarios').addEventListener('input', e => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('#usuarios-table tbody tr').forEach(row => {
            const match = row.cells[1].textContent.toLowerCase().includes(searchTerm) || row.cells[2].textContent.toLowerCase().includes(searchTerm);
            row.style.display = match ? '' : 'none';
        });
    });

    document.getElementById('search-vehiculos').addEventListener('input', e => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('#vehiculos-table tbody tr').forEach(row => {
            row.style.display = row.cells[0].textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
        });
    });

    modalContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-container') || e.target.closest('.btn-close-modal')) {
            modalContainer.classList.remove('active');
            modalContainer.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
        }
    });

    async function fetchData(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Error del servidor' }));
                throw new Error(errorData.error || `Error ${response.status}`);
            }
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return response.json();
            }
            return { success: true, total_a_pagar: (await response.clone().json()).total_a_pagar }; 
        } catch (error) {
            console.error(`Error en API a ${endpoint}:`, error);
            throw error;
        }
    }

    async function init() {
        const user = JSON.parse(localStorage.getItem('user'));
            if (!user) {
                window.location.href = '/login.html';
                return;
            }
            if (user.rol !== 'administrador') {
                window.location.href = '/usuario.html';
                return;
            }

        userGreeting.textContent = `Hola, ${user.nombre}!`;

        console.log("Panel de Administrador inicializado.");
        loadDataForSection(activeSection);
        preloader.style.opacity = '0';
        setTimeout(() => {
            appView.style.visibility = 'visible';
            appView.style.animation = 'fadeIn 0.5s ease-out';
            preloader.remove();
        }, 500);
        setInterval(() => {
            if(activeSection === 'dashboard') {
                loadDashboardData();
            }
        }, 15000);
    }

    init();
});