const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const port = 3000;
const GOOGLE_CLIENT_ID = '199977832849-8r4m1jq6v38s2a23gpnt0008062139g7.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'admin12',
    database: 'estacionamiento',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

async function checkDbConnection() {
    try {
        const connection = await db.getConnection();
        console.log('✅ Conectado exitosamente a la base de datos MySQL.');
        connection.release();
    } catch (err) {
        console.error('❌ FATAL: Error al conectar a la base de datos:', err);
        process.exit(1);
    }
}
checkDbConnection();

app.post('/api/login', async (req, res) => {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
    try {
        const query = "SELECT id_usuario, nombre, apellido_paterno, rol FROM Usuarios WHERE correo = ? AND contrasena = ?";
        const [rows] = await db.query(query, [correo, contrasena]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(401).json({ error: 'Credenciales inválidas.' });
    } catch (err) { res.status(500).json({ error: 'Error interno del servidor.' }); }
});

app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const { name, email, given_name, family_name } = ticket.getPayload();

        const [existingUser] = await db.query('SELECT id_usuario, nombre, apellido_paterno, rol FROM Usuarios WHERE correo = ?', [email]);

        if (existingUser.length > 0) {
            return res.json(existingUser[0]);
        } else {
            const randomPassword = require('crypto').randomBytes(16).toString('hex');
            const newUserQuery = 'INSERT INTO Usuarios (nombre, apellido_paterno, correo, contrasena, rol) VALUES (?, ?, ?, ?, ?)';
            const [result] = await db.query(newUserQuery, [given_name, family_name || '', email, randomPassword, 'cliente']);
            const [newUser] = await db.query('SELECT id_usuario, nombre, apellido_paterno, rol FROM Usuarios WHERE id_usuario = ?', [result.insertId]);
            return res.status(201).json(newUser[0]);
        }
    } catch (error) {
        console.error("Error en autenticación con Google:", error);
        res.status(401).json({ error: 'Autenticación con Google fallida.' });
    }
});

app.get('/api/usuarios', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id_usuario, nombre, apellido_paterno, apellido_materno, correo, rol, activo FROM Usuarios");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Error al consultar usuarios.' }); }
});

app.get('/api/usuarios/:id', async (req, res) => {
    try {
        const query = `
            SELECT u.*, t.uid_tarjeta, t.saldo, t.estado
            FROM Usuarios u
            LEFT JOIN Tarjetas t ON u.id_tarjeta = t.id_tarjeta
            WHERE u.id_usuario = ?
        `;
        const [rows] = await db.query(query, [req.params.id]);

        if (rows.length > 0) {
            const userData = rows[0];
            const response = {
                ...userData,
                tarjeta: userData.uid_tarjeta ? {
                    uid_tarjeta: userData.uid_tarjeta,
                    saldo: userData.saldo,
                    estado: userData.estado
                } : null
            };
            res.json(response);
        } else {
            res.status(404).json({ error: 'Usuario no encontrado.' });
        }
    } catch (err) {
        console.error("Error al obtener el usuario:", err);
        res.status(500).json({ error: 'Error al obtener el usuario.' });
    }
});

app.get('/api/usuarios/:id/vehiculos', async (req, res) => {
    try {
        const query = `SELECT placa, marca, modelo, tipo_vehiculo FROM Vehiculos WHERE id_usuario = ?`;
        const [rows] = await db.query(query, [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Error al consultar los vehículos del usuario.' }); }
});

app.get('/api/usuarios/:id/transacciones', async (req, res) => {
    try {
        const query = `
            SELECT t.hora_entrada, t.hora_salida, t.total, c.numero_cajon
            FROM Transacciones t
            JOIN Vehiculos v ON t.id_vehiculo = v.id_vehiculo
            LEFT JOIN Cajones c ON t.id_cajon = c.id_cajon
            WHERE v.id_usuario = ?
            ORDER BY t.hora_entrada DESC
            LIMIT 50;
        `;
        const [rows] = await db.query(query, [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Error al consultar las transacciones del usuario.' }); }
});

app.post('/api/usuarios', async (req, res) => {
    const { nombre, apellido_paterno, apellido_materno, correo, contrasena, rol } = req.body;
    try {
        const query = 'INSERT INTO Usuarios (nombre, apellido_paterno, apellido_materno, correo, contrasena, rol) VALUES (?, ?, ?, ?, ?, ?)';
        const [result] = await db.query(query, [nombre, apellido_paterno, apellido_materno || null, correo, contrasena, rol]);
        res.status(201).json({ message: 'Usuario creado', id_usuario: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
        res.status(500).json({ error: 'Error al crear el usuario: ' + err.message });
    }
});

app.put('/api/usuarios/:id', async (req, res) => {
    const { id_usuario_solicitante, rol_solicitante } = req.body;
    const id_a_modificar = req.params.id;

    if (rol_solicitante !== 'administrador' && id_usuario_solicitante != id_a_modificar) {
        return res.status(403).json({ error: 'No tienes permiso para modificar este usuario.' });
    }
    
    const { nombre, apellido_paterno, apellido_materno, correo, contrasena, rol, activo, telefono } = req.body;
    const fields = [];
    const params = [];
    if (nombre) { fields.push('nombre = ?'); params.push(nombre); }
    if (apellido_paterno) { fields.push('apellido_paterno = ?'); params.push(apellido_paterno); }
    if (telefono) { fields.push('telefono = ?'); params.push(telefono); }
    if (contrasena) { fields.push('contrasena = ?'); params.push(contrasena); }
    
    if (rol_solicitante === 'administrador') {
        if (correo) { fields.push('correo = ?'); params.push(correo); }
        if (rol) { fields.push('rol = ?'); params.push(rol); }
        if (activo !== undefined) { fields.push('activo = ?'); params.push(activo); }
    }
    
    if (fields.length === 0) return res.status(400).json({ error: 'No se proporcionaron datos para actualizar.' });
    
    const query = `UPDATE Usuarios SET ${fields.join(', ')} WHERE id_usuario = ?`;
    params.push(id_a_modificar);
    try {
        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        res.json({ message: 'Usuario actualizado exitosamente.' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El correo ya está en uso.' });
        res.status(500).json({ error: 'Error al actualizar el usuario: ' + err.message });
    }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM Usuarios WHERE id_usuario = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        res.json({ message: 'Usuario eliminado exitosamente.' });
    } catch (err) { res.status(500).json({ error: 'Error al eliminar el usuario: ' + err.message }); }
});

app.get('/api/vehiculos', async (req, res) => {
    try {
        const query = `SELECT v.*, u.nombre, u.apellido_paterno FROM Vehiculos v JOIN Usuarios u ON v.id_usuario = u.id_usuario ORDER BY v.id_vehiculo;`;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Error al consultar vehículos.' }); }
});

app.get('/api/vehiculos/:placa', async (req, res) => {
    try {
        const query = `SELECT v.*, u.nombre, u.apellido_paterno, u.correo FROM Vehiculos v JOIN Usuarios u ON v.id_usuario = u.id_usuario WHERE v.placa = ?;`;
        const [rows] = await db.query(query, [req.params.placa]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ error: 'Vehículo no encontrado.' });
    } catch (err) { res.status(500).json({ error: 'Error al obtener detalles del vehículo.' }); }
});

app.get('/api/cajones', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM Cajones ORDER BY numero_cajon");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Error al consultar los cajones.' }); }
});

app.get('/api/cajones/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM Cajones WHERE id_cajon = ?", [req.params.id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ error: 'Cajón no encontrado.' });
    } catch (err) { res.status(500).json({ error: 'Error al obtener el cajón.' }); }
});

app.post('/api/cajones', async (req, res) => {
    const { numero_cajon, nivel, tipo_cajon, tarifa_hora } = req.body;
    try {
        const query = 'INSERT INTO Cajones (numero_cajon, nivel, tipo_cajon, tarifa_hora) VALUES (?, ?, ?, ?)';
        const [result] = await db.query(query, [numero_cajon, nivel, tipo_cajon, tarifa_hora]);
        res.status(201).json({ message: 'Cajón creado', id_cajon: result.insertId });
    } catch (err) { res.status(500).json({ error: 'Error al crear el cajón: ' + err.message }); }
});

app.put('/api/cajones/:id', async (req, res) => {
    const { numero_cajon, nivel, tipo_cajon, tarifa_hora } = req.body;
    try {
        const query = 'UPDATE Cajones SET numero_cajon = ?, nivel = ?, tipo_cajon = ?, tarifa_hora = ? WHERE id_cajon = ?';
        await db.query(query, [numero_cajon, nivel, tipo_cajon, tarifa_hora, req.params.id]);
        res.json({ message: 'Cajón actualizado exitosamente.' });
    } catch (err) { res.status(500).json({ error: 'Error al actualizar el cajón: ' + err.message }); }
});

app.delete('/api/cajones/:id', async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM Cajones WHERE id_cajon = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Cajón no encontrado.' });
        res.json({ message: 'Cajón eliminado exitosamente.' });
    } catch (err) { res.status(500).json({ error: 'Error al eliminar el cajón: ' + err.message }); }
});

app.get('/api/transacciones', async (req, res) => {
    try {
        const query = `SELECT t.*, v.placa, c.numero_cajon FROM Transacciones t LEFT JOIN Vehiculos v ON t.id_vehiculo = v.id_vehiculo LEFT JOIN Cajones c ON t.id_cajon = c.id_cajon ORDER BY t.hora_entrada DESC LIMIT 100;`;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Error al consultar transacciones: ' + err.message }); }
});

app.get('/api/transacciones/hoy', async (req, res) => {
    try {
        const query = `
            SELECT t.*, v.placa, c.numero_cajon 
            FROM Transacciones t 
            LEFT JOIN Vehiculos v ON t.id_vehiculo = v.id_vehiculo 
            LEFT JOIN Cajones c ON t.id_cajon = c.id_cajon 
            WHERE DATE(t.hora_entrada) = CURDATE()
            ORDER BY t.hora_entrada DESC;
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error("Error al consultar transacciones de hoy:", err);
        res.status(500).json({ error: 'Error al consultar transacciones de hoy: ' + err.message });
    }
});

app.post('/api/transacciones/entrada', async (req, res) => {
    const { id_cajon, id_vehiculo } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [cajonResult] = await connection.query('UPDATE Cajones SET disponible = FALSE WHERE id_cajon = ? AND disponible = TRUE', [id_cajon]);
        if (cajonResult.affectedRows === 0) throw new Error('El cajón no está disponible o no existe.');
        const [transaccionResult] = await connection.query('INSERT INTO Transacciones (id_vehiculo, id_cajon) VALUES (?, ?)', [id_vehiculo, id_cajon]);
        await connection.commit();
        res.status(201).json({ message: 'Entrada registrada exitosamente', id_transaccion: transaccionResult.insertId });
    } catch (err) {
        await connection.rollback();
        res.status(400).json({ error: 'No se pudo registrar la entrada: ' + err.message });
    } finally {
        connection.release();
    }
});

app.post('/api/transacciones/salida', async (req, res) => {
    const { id_transaccion } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const query = `SELECT T.id_cajon, T.hora_entrada, C.tarifa_hora FROM Transacciones T JOIN Cajones C ON T.id_cajon = C.id_cajon WHERE T.id_transaccion = ? AND T.hora_salida IS NULL`;
        const [transacciones] = await connection.query(query, [id_transaccion]);
        if (transacciones.length === 0) throw new Error('Transacción no encontrada o ya fue cerrada.');
        
        const transaccion = transacciones[0];
        const horaSalida = new Date();
        const horaEntrada = new Date(transaccion.hora_entrada);
        const tiempoEstacionadoMin = Math.round((horaSalida - horaEntrada) / 60000);
        const total = (tiempoEstacionadoMin / 60) * transaccion.tarifa_hora;

        const updateQuery = `UPDATE Transacciones SET hora_salida = ?, tiempo_estacionado_min = ?, total = ?, estado_pago = 'pagado' WHERE id_transaccion = ?`;
        await connection.query(updateQuery, [horaSalida, tiempoEstacionadoMin, total.toFixed(2), id_transaccion]);
        await connection.query('UPDATE Cajones SET disponible = TRUE WHERE id_cajon = ?', [transaccion.id_cajon]);
        await connection.commit();
        res.json({ message: 'Salida registrada.', total_a_pagar: total.toFixed(2) });
    } catch (err) {
        await connection.rollback();
        res.status(400).json({ error: 'No se pudo registrar la salida: ' + err.message });
    } finally {
        connection.release();
    }
});

app.patch('/api/cajones/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { disponible } = req.body;

    if (disponible === undefined) {
        return res.status(400).json({ error: "El campo 'disponible' es requerido." });
    }

    try {
        const query = 'UPDATE Cajones SET disponible = ? WHERE id_cajon = ?';
        const [result] = await db.query(query, [disponible, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cajón no encontrado.' });
        }

        res.json({ message: `Cajón ${id} actualizado a ${disponible ? 'disponible' : 'ocupado'}.` });

    } catch (err) {
        console.error('Error al actualizar estado del cajón:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/api/reportes', async (req, res) => {
    const { tipo, formato, fecha_inicio, fecha_fin } = req.query;

    if (!tipo || !formato || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({ error: 'Faltan parámetros para generar el reporte.' });
    }

    try {
        let sqlQuery = '';
        let queryParams = [fecha_inicio, `${fecha_fin} 23:59:59`];
        let headers = [];
        let data = [];

        switch (tipo) {
            case 'transacciones':
                headers = ['ID', 'Placa', 'Cajon', 'Entrada', 'Salida', 'Total Pagado', 'Estado'];
                sqlQuery = `
                    SELECT t.id_transaccion, v.placa, c.numero_cajon, t.hora_entrada, t.hora_salida, t.total, t.estado_pago
                    FROM Transacciones t
                    LEFT JOIN Vehiculos v ON t.id_vehiculo = v.id_vehiculo
                    LEFT JOIN Cajones c ON t.id_cajon = c.id_cajon
                    WHERE t.hora_entrada BETWEEN ? AND ?
                    ORDER BY t.hora_entrada DESC;
                `;
                break;
            case 'ocupacion':
                headers = ['Cajon', 'Tipo', 'Veces Ocupado', 'Ingresos Generados'];
                 sqlQuery = `
                    SELECT c.numero_cajon, c.tipo_cajon, COUNT(t.id_transaccion) as veces_ocupado, SUM(IFNULL(t.total, 0)) as ingresos_generados
                    FROM Cajones c
                    JOIN Transacciones t ON c.id_cajon = t.id_cajon
                    WHERE t.hora_entrada BETWEEN ? AND ? AND t.estado_pago = 'pagado'
                    GROUP BY c.id_cajon, c.numero_cajon, c.tipo_cajon
                    ORDER BY ingresos_generados DESC;
                `;
                break;
            case 'usuarios':
                 headers = ['ID', 'Nombre Completo', 'Correo', 'Rol', 'Fecha de Registro'];
                 sqlQuery = `
                    SELECT id_usuario, CONCAT(nombre, ' ', apellido_paterno), correo, rol, fecha_registro
                    FROM Usuarios
                    WHERE fecha_registro BETWEEN ? AND ?
                    ORDER BY fecha_registro DESC;
                 `;
                break;
            default:
                return res.status(400).json({ error: 'Tipo de reporte no válido.' });
        }

        const [rows] = await db.query(sqlQuery, queryParams);
        data = rows.map(row => Object.values(row));
        const fileName = `reporte_${tipo}_${new Date().toISOString().slice(0, 10)}.`;

        if (formato === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}csv`);
            
            const csvHeader = headers.join(',') + '\n';
            const csvBody = data.map(row => row.join(',')).join('\n');
            res.send(csvHeader + csvBody);

        } else if (formato === 'pdf') {
            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}pdf`);

            doc.pipe(res);

            doc.fontSize(18).text(`Reporte de ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`, { align: 'center' });
            doc.fontSize(12).text(`Periodo: ${fecha_inicio} al ${fecha_fin}`, { align: 'center' });
            doc.moveDown(2);

            generateTable(doc, headers, data);

            doc.end();
        } else {
            return res.status(400).json({ error: 'Formato no válido.' });
        }

    } catch (err) {
        console.error('Error generando reporte:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.post('/api/vehiculos', async (req, res) => {
    const { placa, marca, modelo, color, tipo_vehiculo, id_usuario } = req.body;
    if (!placa || !marca || !tipo_vehiculo || !id_usuario) {
        return res.status(400).json({ error: 'Placa, marca, tipo e id_usuario son requeridos.' });
    }
    try {
        const query = 'INSERT INTO Vehiculos (placa, marca, modelo, color, tipo_vehiculo, id_usuario) VALUES (?, ?, ?, ?, ?, ?)';
        await db.query(query, [placa, marca, modelo, color, tipo_vehiculo, id_usuario]);
        res.status(201).json({ message: 'Vehículo registrado exitosamente.' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'La placa ya está registrada.' });
        res.status(500).json({ error: 'Error al registrar el vehículo: ' + err.message });
    }
});

app.put('/api/vehiculos/:placa', async (req, res) => {
    const { marca, modelo, color, tipo_vehiculo, nueva_placa } = req.body;
    const placaOriginal = req.params.placa;
    
    try {
        const query = 'UPDATE Vehiculos SET placa = ?, marca = ?, modelo = ?, color = ?, tipo_vehiculo = ? WHERE placa = ?';
        const [result] = await db.query(query, [nueva_placa || placaOriginal, marca, modelo, color, tipo_vehiculo, placaOriginal]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Vehículo no encontrado.' });
        res.json({ message: 'Vehículo actualizado exitosamente.' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'La nueva placa ya está en uso.' });
        res.status(500).json({ error: 'Error al actualizar el vehículo: ' + err.message });
    }
});

app.delete('/api/vehiculos/:placa', async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM Vehiculos WHERE placa = ?', [req.params.placa]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Vehículo no encontrado.' });
        res.json({ message: 'Vehículo eliminado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el vehículo: ' + err.message });
    }
});

function generateTable(doc, headers, data) {
    const tableTop = doc.y;
    const itemHeight = 20;
    const colWidths = headers.map(() => (doc.page.width - 60) / headers.length);

    doc.fontSize(10).font('Helvetica-Bold');
    headers.forEach((header, i) => {
        doc.text(header, 30 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop, { width: colWidths[i], align: 'center' });
    });
    doc.y += itemHeight;
    doc.font('Helvetica');

    data.forEach((row, rowIndex) => {
        const rowTop = tableTop + (rowIndex + 1) * itemHeight;
        row.forEach((cell, i) => {
            doc.text(String(cell || 'N/A'), 30 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), rowTop + 4, { width: colWidths[i], align: 'left', indent: 5 });
        });
        if (rowIndex < data.length) {
             doc.moveTo(30, rowTop + itemHeight).lineTo(doc.page.width - 30, rowTop + itemHeight).stroke();
        }
    });
}

app.post('/api/rfid/entrada', async (req, res) => {
    const { uid_tarjeta, tipo_cajon_preferido } = req.body;
    if (!uid_tarjeta) return res.status(400).json({ error: 'UID de tarjeta es requerido.' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [usuarios] = await connection.query(
            `SELECT u.id_usuario, v.id_vehiculo, v.tipo_vehiculo, t.saldo, t.id_tarjeta
             FROM tarjetas t
             JOIN usuarios u ON t.id_tarjeta = u.id_tarjeta
             JOIN vehiculos v ON u.id_usuario = v.id_usuario
             WHERE t.uid_tarjeta = ? AND t.estado = 'activa' AND v.permiso_acceso = 1
             LIMIT 1;`,
            [uid_tarjeta]
        );

        if (usuarios.length === 0) {
            throw new Error('Tarjeta no válida, inactiva o sin vehículo asociado.');
        }
        const { id_usuario, id_vehiculo, tipo_vehiculo, saldo, id_tarjeta } = usuarios[0];
        
        const [transaccionActiva] = await connection.query(
            `SELECT id_transaccion FROM transacciones 
             WHERE id_vehiculo IN (SELECT id_vehiculo FROM vehiculos WHERE id_usuario = ?) 
             AND estado_pago = 'pendiente'`, [id_usuario]
        );

        if (transaccionActiva.length > 0) {
            throw new Error('El usuario ya tiene un vehículo dentro.');
        }

        const [cajones] = await connection.query(
            `SELECT id_cajon FROM cajones 
             WHERE disponible = TRUE AND tipo_cajon = ? 
             ORDER BY numero_cajon ASC LIMIT 1;`,
            [tipo_vehiculo]
        );
        
        let id_cajon;
        if (cajones.length > 0) {
            id_cajon = cajones[0].id_cajon;
        } else {
            const [cajonesEstandar] = await connection.query(
                `SELECT id_cajon FROM cajones WHERE disponible = TRUE AND tipo_cajon = 'automovil' 
                 ORDER BY numero_cajon ASC LIMIT 1;`
            );
            if (cajonesEstandar.length === 0) throw new Error('No hay cajones disponibles.');
            id_cajon = cajonesEstandar[0].id_cajon;
        }

        await connection.query('UPDATE cajones SET disponible = FALSE WHERE id_cajon = ?', [id_cajon]);
        const [transaccionResult] = await connection.query(
            'INSERT INTO transacciones (id_vehiculo, id_cajon, id_tarjeta_pago) VALUES (?, ?, ?)',
            [id_vehiculo, id_cajon, id_tarjeta]
        );
        
        await connection.commit();
        res.status(201).json({ message: 'Acceso autorizado. Entrada registrada.' });

    } catch (err) {
        await connection.rollback();
        res.status(400).json({ error: 'Acceso denegado: ' + err.message });
    } finally {
        connection.release();
    }
});

app.post('/api/rfid/salida', async (req, res) => {
    const { uid_tarjeta } = req.body;
    if (!uid_tarjeta) return res.status(400).json({ error: 'UID de tarjeta es requerido.' });
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const query = `
            SELECT t.id_transaccion, t.id_cajon, t.hora_entrada, c.tarifa_hora, tj.saldo, tj.id_tarjeta
            FROM transacciones t
            JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
            JOIN usuarios u ON v.id_usuario = u.id_usuario
            JOIN tarjetas tj ON u.id_tarjeta = tj.id_tarjeta
            JOIN cajones c ON t.id_cajon = c.id_cajon
            WHERE tj.uid_tarjeta = ? AND t.estado_pago = 'pendiente'`;
        
        const [transacciones] = await connection.query(query, [uid_tarjeta]);
        if (transacciones.length === 0) throw new Error('No se encontró una entrada activa para esta tarjeta.');
        
        const transaccion = transacciones[0];
        const horaSalida = new Date();
        const horaEntrada = new Date(transaccion.hora_entrada);
        const tiempoEstacionadoMin = Math.max(1, Math.ceil((horaSalida - horaEntrada) / 60000));
        const total = (tiempoEstacionadoMin / 60) * transaccion.tarifa_hora;

        if (transaccion.saldo < total) {
             await connection.query(
                `UPDATE transacciones SET hora_salida = ?, tiempo_estacionado_min = ?, total = ?, estado_pago = 'saldo_insuficiente' WHERE id_transaccion = ?`,
                [horaSalida, tiempoEstacionadoMin, total.toFixed(2), transaccion.id_transaccion]
            );
            await connection.query('UPDATE cajones SET disponible = TRUE WHERE id_cajon = ?', [transaccion.id_cajon]);
            await connection.commit();
            return res.status(402).json({ 
                error: 'Saldo insuficiente.', 
                total_a_pagar: total.toFixed(2), 
                saldo_actual: transaccion.saldo.toFixed(2) 
            });
        }
        
        const nuevoSaldo = transaccion.saldo - total;
        await connection.query('UPDATE tarjetas SET saldo = ? WHERE id_tarjeta = ?', [nuevoSaldo.toFixed(2), transaccion.id_tarjeta]);

        await connection.query(
            `UPDATE transacciones SET hora_salida = ?, tiempo_estacionado_min = ?, total = ?, estado_pago = 'pagado' WHERE id_transaccion = ?`,
            [horaSalida, tiempoEstacionadoMin, total.toFixed(2), transaccion.id_transaccion]
        );
        await connection.query('UPDATE cajones SET disponible = TRUE WHERE id_cajon = ?', [transaccion.id_cajon]);
        
        await connection.commit();
        res.json({ 
            message: 'Salida registrada y pagada.', 
            costo_total: total.toFixed(2),
            saldo_restante: nuevoSaldo.toFixed(2)
        });

    } catch (err) {
        await connection.rollback();
        res.status(400).json({ error: 'Error al registrar salida: ' + err.message });
    } finally {
        connection.release();
    }
});

app.post('/api/usuarios/:id/tarjeta/recargar', async (req, res) => {
    const { id } = req.params;
    const { monto } = req.body;

    if (!monto || monto <= 0) {
        return res.status(400).json({ error: 'El monto de recarga debe ser un número positivo.' });
    }

    try {
        const [usuario] = await db.query('SELECT id_tarjeta FROM usuarios WHERE id_usuario = ?', [id]);
        if (usuario.length === 0 || !usuario[0].id_tarjeta) {
            return res.status(404).json({ error: 'El usuario no tiene una tarjeta asociada.' });
        }
        
        const id_tarjeta = usuario[0].id_tarjeta;
        await db.query('UPDATE tarjetas SET saldo = saldo + ? WHERE id_tarjeta = ?', [monto, id_tarjeta]);

        res.json({ message: 'Recarga exitosa.' });

    } catch (err) {
        console.error('Error al recargar saldo:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});