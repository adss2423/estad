const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken'); 
const multer = require('multer');

// IMPORTAR LA CONEXIÓN A LA BASE DE DATOS
const conexion = require('./db');

// LLAVE QUE ENCRIPTA LOS TOKENS
const SECRET_KEY = 'utmedic_secreto_super_seguro';

// ==========================================
// MIDDLEWARE DE SEGURIDAD (JWT)
// ==========================================
const verificarToken = (req, res, next) => {
    // El frontend enviará el token al header 'Authorization'
    const token = req.headers['authorization'];
    
    if (!token) {
        return res.status(401).json({ error: "Acceso denegado. No se proporcionó un token de seguridad." });
    }

    // se verifica si el token es válido y si no ha expirado
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: "Token inválido o expirado. Inicia sesión nuevamente." });
        }
        
        // Si el token es bueno se extrae el ID del usuario y lo guardamos en la petición
        req.usuarioId = decoded.id;
        next(); // Le damos permiso de pasar a la ruta solicitada
    });
};

// CONFIGURACION DEL MULTER 
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../frontend/uploads/')) 
    },
    filename: function (req, file, cb) {
        // se lee el token cuando el usuario sube una foto
        let userId = 'desc';
        const token = req.headers['authorization'];
        if (token) {
            try {
                const decoded = jwt.verify(token, SECRET_KEY);
                userId = decoded.id;
            } catch(e) {}
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'perfil_' + userId + '_' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../frontend/html')));
app.use(express.static(path.join(__dirname, '../frontend')));

// ==========================================
// RUTAS DE LA API REST
// ==========================================

// API DEL LOGIN (JWT GENERADO )
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    const query = 'SELECT * FROM usuario WHERE usuario = ? AND password = ?';

    conexion.query(query, [usuario, password], (error, resultados) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ mensaje: "Error interno del servidor" });
        }

        if (resultados.length > 0) {
            const user = resultados[0];
            
            // GENERAMOS EL TOKEN CON LOS DATOS DEL USUARIO (Expira en 2 horas)
            const token = jwt.sign(
                { id: user.idUsuario, rol: user.rol }, 
                SECRET_KEY, 
                { expiresIn: '2h' }
            );

            res.status(200).json({ 
                mensaje: "Login exitoso",
                token: token, // Enviamos el token al frontend
                redireccion: "/menu_principal.html" 
            });
        } else {
            res.status(401).json({ 
                mensaje: "Usuario o contraseña incorrectos. Verifica tus datos." 
            });
        }
    });
});

// API DE LA SESIÓN ACTUAL (Protegida con Token)
app.get('/api/sesion-actual', verificarToken, (req, res) => {
    const query = 'SELECT * FROM usuario WHERE idUsuario = ?';
    // Usamos req.usuarioId que fue inyectado por el middleware verificarToken
    conexion.query(query, [req.usuarioId], (error, resultados) => {
        if (error || resultados.length === 0) {
            return res.status(500).json({ error: "Error de servidor" });
        }
        res.status(200).json(resultados[0]); 
    });
});

// CERRAR SESIÓN 
app.get('/api/logout', (req, res) => {
    // Como JWT no guarda estado en el servidor, solo redirigimos.
    // El frontend se encargará de borrar el token del LocalStorage.
    res.redirect('/index.html'); 
});

// ==========================================
// API DE REGISTRO
// ==========================================
app.post('/api/registro', (req, res) => {
    // 1. Recibimos la nueva variable "carrera"
    const { matricula, usuario, password, confirm_password, carrera } = req.body;
    const rol = 'paciente'; 

    if (password !== confirm_password) {
        return res.status(400).json({ mensaje: "Las contraseñas no coinciden.", tipo_mensaje: "danger" });
    }

    if (!carrera) {
        return res.status(400).json({ mensaje: "Por favor, selecciona tu carrera.", tipo_mensaje: "warning" });
    }

    const checkSql = "SELECT idUsuario FROM usuario WHERE usuario = ? OR matricula = ?";
    conexion.query(checkSql, [usuario, matricula], (err, resultados) => {
        if (err) return res.status(500).json({ mensaje: "Error interno de la base de datos.", tipo_mensaje: "danger" });
        
        if (resultados.length > 0) {
            return res.status(400).json({ mensaje: "El usuario o la matrícula ya están registrados.", tipo_mensaje: "warning" });
        }

        // 2. se creas al usuario en la BD
        const insertSql = "INSERT INTO usuario (matricula, usuario, password, rol) VALUES (?, ?, ?, ?)";
        conexion.query(insertSql, [matricula, usuario, password, rol], (err2, result) => {
            if (err2) return res.status(500).json({ mensaje: "Error al registrar la cuenta.", tipo_mensaje: "danger" });
            
            const nuevoIdUsuario = result.insertId;

            // 3. Creamos su perfil automáticamente con la carrera elegida
            const insertPerfilSql = "INSERT INTO perfil (idUsuario, carrera) VALUES (?, ?)";
            conexion.query(insertPerfilSql, [nuevoIdUsuario, carrera], (err3) => {
                if (err3) return res.status(500).json({ mensaje: "Cuenta creada, pero hubo un error al vincular la carrera.", tipo_mensaje: "warning" });
                
                res.status(201).json({ mensaje: "¡Cuenta creada exitosamente! Redirigiendo al login..." });
            });
        });
    });
});


// ==========================================
// API DE PERFIL DEL PACIENTE
// ==========================================
app.get('/api/perfil', verificarToken, (req, res) => {
    const sql = "SELECT u.matricula, u.usuario, u.rol, p.* FROM usuario u LEFT JOIN perfil p ON u.idUsuario = p.idUsuario WHERE u.idUsuario = ?";
    conexion.query(sql, [req.usuarioId], (err, resultados) => {
        if (err || resultados.length === 0) return res.status(500).json({ error: "Error al cargar" });
        if(resultados[0].rol !== 'paciente') return res.status(403).json({ error: "Solo pacientes" });
        
        res.json(resultados[0]); 
    });
});

app.post('/api/perfil', verificarToken, upload.single('foto'), (req, res) => {
    const idUsuario = req.usuarioId;

    const { matricula, nombre, apellido_paterno, apellido_materno, carrera, telefono, contactoEmergencia, correo, alergias, padecimientos, ruta_foto_actual } = req.body;
    let peso = req.body.peso ? req.body.peso : null;
    let estatura = req.body.estatura ? req.body.estatura : null;
    
    let ruta_foto = ruta_foto_actual;
    if (req.file) ruta_foto = 'uploads/' + req.file.filename;

    conexion.query("UPDATE usuario SET matricula = ? WHERE idUsuario = ?", [matricula, idUsuario], (errUser) => {
        if (errUser) return res.status(500).json({ mensaje: "Error al actualizar matrícula." });

        conexion.query("SELECT idPerfil FROM perfil WHERE idUsuario = ?", [idUsuario], (err, resultados) => {
            if (err) return res.status(500).json({ mensaje: "Error de BD." });

            let sql, params;
            if (resultados.length > 0) {
                sql = "UPDATE perfil SET carrera=?, nombre=?, apellido_paterno=?, apellido_materno=?, telefono=?, contactoEmergencia=?, correo=?, alergias=?, peso=?, estatura=?, padecimientos=?, foto=? WHERE idUsuario=?";
                params = [carrera, nombre, apellido_paterno, apellido_materno, telefono, contactoEmergencia, correo, alergias, peso, estatura, padecimientos, ruta_foto, idUsuario];
            } else {
                sql = "INSERT INTO perfil (idUsuario, carrera, nombre, apellido_paterno, apellido_materno, telefono, contactoEmergencia, correo, alergias, peso, estatura, padecimientos, foto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                params = [idUsuario, carrera, nombre, apellido_paterno, apellido_materno, telefono, contactoEmergencia, correo, alergias, peso, estatura, padecimientos, ruta_foto];
            }

            conexion.query(sql, params, (err2) => {
                if (err2) return res.status(500).json({ mensaje: "Error al guardar el perfil: " + err2.message });
                
                res.status(200).json({ 
                    mensaje: "Información guardada correctamente.",
                    nuevaFoto: ruta_foto
                });
            });
        });
    });
});


// ==========================================
// API PARA OBTENER slots DE HORARIOS DISPONIBLES
// ==========================================
app.post('/api/horarios_disponibles', (req, res) => {
    const { idPersonal, fecha } = req.body;
    
    if (!idPersonal || !fecha) {
        return res.status(400).json({ error: 'Faltan datos para calcular los horarios' });
    }

    conexion.query('SELECT turno FROM personal_salud WHERE idPersonal = ?', [idPersonal], (errTurno, resTurno) => {
        if (errTurno || resTurno.length === 0) return res.status(500).json({ error: 'Error al consultar turno' });

        const turnoDoctor = resTurno[0].turno || 'Matutino'; 
        let horariosBase = [];

        if (turnoDoctor === 'Matutino') {
            horariosBase = ['08:00', '09:00', '10:00', '12:00', '13:00'];
        } else if (turnoDoctor === 'Vespertino') {
            horariosBase = ['15:00', '16:00', '17:00', '19:00', '20:00']; 
        }

        const sqlCitas = 'SELECT hora FROM cita WHERE idPersonal = ? AND fecha = ? AND estado = "Programada"';
        
        conexion.query(sqlCitas, [idPersonal, fecha], (error, resultados) => {
            if (error) return res.status(500).json({ error: 'Error BD' });

            const horasOcupadas = resultados.map(cita => cita.hora.toString().substring(0, 5));
            const horariosDisponibles = horariosBase.filter(hora => !horasOcupadas.includes(hora));

            res.json({ disponibles: horariosDisponibles });
        });
    });
});


// ==========================================
// API PARA AGENDAR CITAS
// ==========================================
app.get('/api/agendar_cita/datos', verificarToken, (req, res) => {
    const idUsuario = req.usuarioId;

    conexion.query("SELECT usuario, rol FROM usuario WHERE idUsuario = ?", [idUsuario], (errU, resU) => {
        if (errU || resU.length === 0 || resU[0].rol !== 'paciente') {
            return res.status(403).json({ error: "Solo pacientes" });
        }

        conexion.query("SELECT idPerfil FROM perfil WHERE idUsuario = ?", [idUsuario], (errP, resPerfil) => {
            if (errP) return res.status(500).json({ error: "Error de BD" });
            if (resPerfil.length === 0) return res.status(400).json({ faltaPerfil: true });

            const sqlMedicos = `
                SELECT ps.idPersonal, ps.nombre, ps.profesion, ps.turno, ps.foto 
                FROM personal_salud ps
                JOIN usuario u ON ps.idUsuario = u.idUsuario
                WHERE ps.nombre IS NOT NULL 
                  AND ps.nombre != '' 
                  AND ps.estado = 'Activo' 
                  AND u.rol != 'ADMIN'
            `;
            conexion.query(sqlMedicos, (errM, medicos) => {
                conexion.query("SELECT idMotivo, descripcion FROM motivo", (errMot, motivos) => {
                    const fechaMinima = new Date().toISOString().split('T')[0];
                    res.status(200).json({
                        usuario: resU[0].usuario,
                        medicos: medicos || [],
                        motivos: motivos || [],
                        fechaMinima: fechaMinima
                    });
                });
            });
        });
    });
});

app.post('/api/agendar_cita', verificarToken, (req, res) => {
    const idUsuario = req.usuarioId;
    const { idPersonal, idMotivo, fecha, hora, observaciones } = req.body;
    const estado = 'Programada';

    const hoy = new Date().toISOString().split('T')[0];
    if (fecha < hoy) return res.status(400).json({ mensaje: "No puedes agendar citas en fechas pasadas." });

    conexion.query("SELECT idPerfil FROM perfil WHERE idUsuario = ?", [idUsuario], (err, resPerfil) => {
        if (err || resPerfil.length === 0) return res.status(500).json({ mensaje: "Error obteniendo perfil" });

        const idPerfil = resPerfil[0].idPerfil;

        const sqlCheck = "SELECT idCita FROM cita WHERE idPerfil = ? AND fecha = ? AND estado = 'Programada'";
        conexion.query(sqlCheck, [idPerfil, fecha], (errCheck, resCheck) => {
            if (errCheck) return res.status(500).json({ mensaje: "Error al validar la fecha." });

            if (resCheck.length > 0) {
                return res.status(400).json({ mensaje: "Ya tienes una cita agendada para esta fecha. Selecciona un día distinto." });
            }

            const sqlInsert = "INSERT INTO cita (idPerfil, idPersonal, idMotivo, fecha, hora, observaciones, estado) VALUES (?, ?, ?, ?, ?, ?, ?)";
            conexion.query(sqlInsert, [idPerfil, idPersonal, idMotivo, fecha, hora, observaciones, estado], (err2) => {
                if (err2) return res.status(500).json({ mensaje: "Error al agendar: " + err2.message });
                res.status(201).json({ mensaje: "Cita agendada exitosamente." });
            });
        });
    });
});

// ==========================================
// API DE PRÓXIMAS CITAS (DASHBOARD PACIENTE)
// ==========================================
app.get('/api/proximas_citas', verificarToken, (req, res) => {
    const idUsuario = req.usuarioId;

    conexion.query("SELECT idPerfil FROM perfil WHERE idUsuario = ?", [idUsuario], (err, resPerfil) => {
        if (err || resPerfil.length === 0) return res.status(200).json([]); 

        const idPerfil = resPerfil[0].idPerfil;

        const sql = `
            SELECT c.idCita, c.fecha, c.hora, c.observaciones, 
                   ps.nombre as nombre_medico, ps.profesion, ps.foto,
                   m.descripcion as motivo
            FROM cita c
            JOIN personal_salud ps ON c.idPersonal = ps.idPersonal
            JOIN motivo m ON c.idMotivo = m.idMotivo
            WHERE c.idPerfil = ? AND c.estado = 'Programada' AND c.fecha >= CURDATE()
            ORDER BY c.fecha ASC, c.hora ASC
            LIMIT 4
        `;

        conexion.query(sql, [idPerfil], (errCitas, citas) => {
            if (errCitas) return res.status(500).json({ error: "Error obteniendo citas" });

            const citasFormateadas = citas.map(cita => {
                const f = new Date(cita.fecha);
                const fechaFormateada = ("0" + f.getDate()).slice(-2) + "/" + ("0" + (f.getMonth() + 1)).slice(-2) + "/" + f.getFullYear();
                
                const partesHora = cita.hora.split(':');
                const h = parseInt(partesHora[0], 10);
                const ampm = h >= 12 ? 'PM' : 'AM';
                const hora12 = (h % 12 || 12);
                const horaFormateada = hora12 + ':' + partesHora[1] + ' ' + ampm;

                return { ...cita, fechaFormateada, horaFormateada };
            });

            res.status(200).json(citasFormateadas);
        });
    });
});

// ==========================================
// API DE HISTORIAL DE CITAS Y CANCELACIÓN
// ==========================================
app.get('/api/historial_citas', verificarToken, (req, res) => {
    const idUsuario = req.usuarioId;

    conexion.query("SELECT usuario, rol FROM usuario WHERE idUsuario = ?", [idUsuario], (errU, resU) => {
        if (errU || resU.length === 0 || resU[0].rol !== 'paciente') return res.status(403).json({ error: "Solo pacientes" });

        conexion.query("SELECT idPerfil FROM perfil WHERE idUsuario = ?", [idUsuario], (errP, resPerfil) => {
            if (errP) return res.status(500).json({ error: "Error conectando a BD" });
            if (resPerfil.length === 0) return res.status(400).json({ faltaPerfil: true });

            const idPerfil = resPerfil[0].idPerfil;

            const sqlCitas = `
                SELECT c.idCita, c.fecha, c.hora, c.estado, c.observaciones, 
                       ps.nombre as nombre_medico, ps.profesion, 
                       m.descripcion as motivo
                FROM cita c
                JOIN personal_salud ps ON c.idPersonal = ps.idPersonal
                JOIN motivo m ON c.idMotivo = m.idMotivo
                WHERE c.idPerfil = ?
                ORDER BY 
                    CASE WHEN c.estado = 'Programada' THEN 1 ELSE 2 END ASC,
                    c.fecha ASC, 
                    c.hora ASC
            `;

            conexion.query(sqlCitas, [idPerfil], (errCitas, citas) => {
                if (errCitas) return res.status(500).json({ error: "Error obteniendo citas" });

                const citasFormateadas = citas.map(cita => {
                    const f = new Date(cita.fecha);
                    const fechaFormateada = ("0" + f.getDate()).slice(-2) + "/" + ("0" + (f.getMonth() + 1)).slice(-2) + "/" + f.getFullYear();
                    
                    const partesHora = cita.hora.split(':');
                    const h = parseInt(partesHora[0], 10);
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const hora12 = (h % 12 || 12);
                    const horaFormateada = hora12 + ':' + partesHora[1] + ' ' + ampm;

                    return { ...cita, fechaFormateada, horaFormateada };
                });

                res.status(200).json({ usuario: resU[0].usuario, citas: citasFormateadas });
            });
        });
    });
});

// ==========================================
// API: CANCELAR CITA 
// ==========================================
app.put('/api/cancelar_cita/:id', verificarToken, (req, res) => {
    const idCita = req.params.id;
    // Ahora recibimos el motivo desde el frontend
    const { motivo_cancelacion } = req.body; 

    // Verificamos que el usuario nos mande un motivo (si es paciente)
    let sql;
    let params;

    if (motivo_cancelacion) {
        sql = "UPDATE cita SET estado = 'Cancelada', motivo_cancelacion = ? WHERE idCita = ?";
        params = [motivo_cancelacion, idCita];
    } else {
        sql = "UPDATE cita SET estado = 'Cancelada' WHERE idCita = ?";
        params = [idCita];
    }

    conexion.query(sql, params, (err, result) => {
        if (err) {
            console.error("Error al cancelar cita:", err);
            return res.status(500).json({ mensaje: "Error al cancelar la cita." });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Cita no encontrada." });
        }
        res.json({ mensaje: "Cita cancelada correctamente." });
    });
});

// ==========================================
// API PARA REAGENDAR CITA
// ==========================================
app.get('/api/reagendar_cita/datos/:idCita', verificarToken, (req, res) => {
    const idUsuario = req.usuarioId;
    const idCita = req.params.idCita;

    conexion.query("SELECT usuario FROM usuario WHERE idUsuario = ?", [idUsuario], (errU, resU) => {
        if (errU || resU.length === 0) return res.status(403).json({ error: "Error de usuario" });

        conexion.query("SELECT idPerfil FROM perfil WHERE idUsuario = ?", [idUsuario], (errP, resPerfil) => {
            if (errP || resPerfil.length === 0) return res.status(404).json({ error: "Perfil no encontrado" });
            const idPerfil = resPerfil[0].idPerfil;

            conexion.query("SELECT * FROM cita WHERE idCita = ? AND idPerfil = ? AND estado = 'Programada'", [idCita, idPerfil], (errC, resCita) => {
                if (errC || resCita.length === 0) return res.status(404).json({ error: "Cita no válida" });

                const sqlMedicos = "SELECT idPersonal, nombre, profesion FROM personal_salud WHERE nombre IS NOT NULL AND nombre != '' AND estado = 'Activo'";
                conexion.query(sqlMedicos, (errM, medicos) => {
                    const fechaMinima = new Date().toISOString().split('T')[0];
                    res.status(200).json({
                        usuario: resU[0].usuario,
                        cita: resCita[0],
                        medicos: medicos || [],
                        fechaMinima: fechaMinima
                    });
                });
            });
        });
    });
});

app.put('/api/reagendar_cita', verificarToken, (req, res) => {
    const { idCita, idPersonal, idMotivo, fecha, hora, observaciones } = req.body;

    if (!idCita || !idPersonal || !idMotivo || !fecha || !hora) {
        return res.status(400).json({ mensaje: "Campos obligatorios incompletos." });
    }

    const sqlUpdate = `
        UPDATE cita 
        SET idPersonal = ?, idMotivo = ?, fecha = ?, hora = ?, observaciones = ?
        WHERE idCita = ?
    `;

    conexion.query(sqlUpdate, [idPersonal, idMotivo, fecha, hora, observaciones, idCita], (err, result) => {
        if (err) return res.status(500).json({ mensaje: "Error al actualizar." });
        if (result.affectedRows === 0) return res.status(404).json({ mensaje: "Cita no encontrada." });

        res.status(200).json({ mensaje: "Cita actualizada correctamente." });
    });
});

// ==========================================
// API DE PERFIL MÉDICO / NUTRIÓLOGO / ADMIN
// ==========================================
app.get('/api/perfil_medico', verificarToken, (req, res) => {
    const idUsuario = req.usuarioId;

    conexion.query("SELECT usuario, rol FROM usuario WHERE idUsuario = ?", [idUsuario], (errU, resU) => {
        if (errU || resU.length === 0) return res.status(500).json({ error: "Error de servidor" });
        
        const rol = resU[0].rol;
        if (rol !== 'medico' && rol !== 'nutriologo' && rol !== 'psicologo' && rol !== 'ADMIN') {
            return res.status(403).json({ error: "Acceso denegado" });
        }

        conexion.query("SELECT * FROM personal_salud WHERE idUsuario = ?", [idUsuario], (err, resultados) => {
            if (err) return res.status(500).json({ error: "Error al cargar perfil" });

            let perfil = resultados.length > 0 ? resultados[0] : {};
            perfil.usuario = resU[0].usuario;
            perfil.rol = rol;

            res.status(200).json(perfil);
        });
    });
});

app.post('/api/perfil_medico', verificarToken, upload.single('foto'), (req, res) => {
    const idUsuario = req.usuarioId;

    conexion.query("SELECT rol FROM usuario WHERE idUsuario = ?", [idUsuario], (errU, resU) => {
        if (errU || resU.length === 0) return res.status(500).json({ mensaje: "Error de servidor" });
        
        const rol = resU[0].rol;
        if (rol !== 'medico' && rol !== 'nutriologo' && rol !== 'psicologo' && rol !== 'ADMIN') {
            return res.status(403).json({ mensaje: "Acceso denegado" });
        }

        const { nombre, apellido_paterno, apellido_materno, profesion, correo, telefono, estado, ruta_foto_actual } = req.body;

        let ruta_foto = ruta_foto_actual;
        if (req.file) ruta_foto = 'uploads/' + req.file.filename;

        conexion.query("SELECT idPersonal FROM personal_salud WHERE idUsuario = ?", [idUsuario], (err, resultados) => {
            if (err) return res.status(500).json({ mensaje: "Error de BD." });

            let sql, params;
            if (resultados.length > 0) {
                sql = "UPDATE personal_salud SET nombre=?, apellido_paterno=?, apellido_materno=?, profesion=?, correo=?, telefono=?, estado=?, foto=? WHERE idUsuario=?";
                params = [nombre, apellido_paterno, apellido_materno, profesion, correo, telefono, estado, ruta_foto, idUsuario];
            } else {
                sql = "INSERT INTO personal_salud (idUsuario, nombre, apellido_paterno, apellido_materno, profesion, correo, telefono, estado, foto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                params = [idUsuario, nombre, apellido_paterno, apellido_materno, profesion, correo, telefono, estado, ruta_foto];
            }

            conexion.query(sql, params, (err2) => {
                if (err2) return res.status(500).json({ mensaje: "Error al guardar: " + err2.message });
                
                res.status(200).json({ 
                    mensaje: "Perfil profesional actualizado exitosamente.",
                    nuevaFoto: ruta_foto 
                });
            });
        });
    });
});

// ==========================================
// API DE ATENCIÓN DE CITAS (MÉDICO)
// ==========================================
app.get('/api/atender_cita', verificarToken, (req, res) => {
    const idUsuario = req.usuarioId;

    conexion.query("SELECT usuario, rol FROM usuario WHERE idUsuario = ?", [idUsuario], (errU, resU) => {
        if (errU || resU.length === 0) return res.status(500).json({ error: "Error de servidor" });
        
        const rol = resU[0].rol;
        if (rol !== 'medico' && rol !== 'nutriologo' && rol !== 'psicologo' && rol !== 'ADMIN') {
            return res.status(403).json({ error: "Acceso denegado" });
        }

        const ejecutarQuery = (idPersonal) => {
           let sql = `
                SELECT c.idCita, c.fecha, c.hora, c.observaciones, 
                       p.nombre, p.apellido_paterno, p.apellido_materno, p.foto,
                       p.alergias, p.padecimientos, p.peso, p.estatura, p.telefono, p.contactoEmergencia, p.carrera,
                       u.matricula,
                       m.descripcion as motivo
                FROM cita c
                JOIN perfil p ON c.idPerfil = p.idPerfil
                JOIN usuario u ON p.idUsuario = u.idUsuario
                JOIN motivo m ON c.idMotivo = m.idMotivo
                WHERE c.estado = 'Programada'
            `;
            let params = [];

            if (idPersonal !== null) {
                sql += " AND c.idPersonal = ?";
                params.push(idPersonal);
            }

            sql += " ORDER BY c.fecha ASC, c.hora ASC";

            conexion.query(sql, params, (errC, pacientes) => {
                if (errC) return res.status(500).json({ error: "Error al cargar citas" });

                const pacientesFormateados = pacientes.map(p => {
                    const f = new Date(p.fecha);
                    const fechaFormateada = ("0" + f.getDate()).slice(-2) + "/" + ("0" + (f.getMonth() + 1)).slice(-2) + "/" + f.getFullYear();
                    const partesHora = p.hora.split(':');
                    const h = parseInt(partesHora[0], 10);
                    const horaFormateada = (h % 12 || 12) + ':' + partesHora[1] + (h >= 12 ? ' PM' : ' AM');

                    return { ...p, nombreCompleto: `${p.nombre} ${p.apellido_paterno}`, fechaFormateada, horaFormateada };
                });

                res.status(200).json({ usuario: resU[0].usuario, rol: rol, pacientes: pacientesFormateados });
            });
        };

        if (rol === 'ADMIN') {
            ejecutarQuery(null); 
        } else {
            conexion.query("SELECT idPersonal FROM personal_salud WHERE idUsuario = ?", [idUsuario], (errP, resPersonal) => {
                if (errP || resPersonal.length === 0) {
                    return res.status(200).json({ 
                        usuario: resU[0].usuario, rol: rol, errorPerfil: true, 
                        mensaje: "Tu usuario no está vinculado a un perfil de Personal de Salud." 
                    });
                }
                ejecutarQuery(resPersonal[0].idPersonal);
            });
        }
    });
});

app.put('/api/atender_cita', verificarToken, (req, res) => {
    const { idCita, diagnostico } = req.body;

    const sql = "UPDATE cita SET estado='Atendida', observaciones=? WHERE idCita=?";
    conexion.query(sql, [diagnostico, idCita], (err) => {
        if (err) return res.status(500).json({ mensaje: "Error al guardar el diagnóstico." });
        res.status(200).json({ mensaje: "Cita finalizada correctamente." });
    });
});

// ==========================================
// API: HISTORIAL DE CITAS (VISTA DEL MÉDICO)
// ==========================================
app.get('/api/medico/historial_citas', verificarToken, (req, res) => {
    
    const token = req.headers['authorization'];
    const jwt = require('jsonwebtoken');
    const datosToken = jwt.decode(token); 

    if (!datosToken) {
        return res.status(500).json({ mensaje: "No se pudo extraer la información del token." });
    }

    const idUsuario = datosToken.idUsuario || datosToken.id;
    const rol = datosToken.rol;

    if (rol === 'paciente') {
        return res.status(403).json({ mensaje: "Acceso denegado." });
    }

    // 1. Buscamos el idPersonal del médico usando su idUsuario
    const sqlPersonal = "SELECT idPersonal, nombre, profesion FROM personal_salud WHERE idUsuario = ?";
    conexion.query(sqlPersonal, [idUsuario], (err, resPersonal) => {
        if (err) return res.status(500).json({ mensaje: "Error al buscar datos del médico." });
        if (resPersonal.length === 0) return res.status(400).json({ mensaje: "Perfil médico no encontrado." });

        const idPersonal = resPersonal[0].idPersonal;

        // 2. Buscamos las citas
        const sqlCitas = `
            SELECT c.idCita, c.fecha, c.hora, c.estado, c.observaciones, c.motivo_cancelacion,
                   p.nombre, p.apellido_paterno, p.apellido_materno, u.matricula,
                   m.descripcion as motivo
            FROM cita c
            JOIN perfil p ON c.idPerfil = p.idPerfil
            JOIN usuario u ON p.idUsuario = u.idUsuario
            JOIN motivo m ON c.idMotivo = m.idMotivo
            WHERE c.idPersonal = ?
            ORDER BY c.fecha DESC, c.hora DESC
        `;

        conexion.query(sqlCitas, [idPersonal], (errCitas, citas) => {
            if (errCitas) {
                console.error("Error SQL en historial de citas:", errCitas);
                return res.status(500).json({ mensaje: "Error al cargar el historial." });
            }

            // Formatear fechas y nombres
            const citasFormateadas = citas.map(cita => {
                const d = new Date(cita.fecha);
                d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
                const fechaFormat = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                
                const partesHora = cita.hora.split(':');
                let h = parseInt(partesHora[0], 10);
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                const horaFormat = `${h}:${partesHora[1]} ${ampm}`;

                const nombreCompleto = `${cita.nombre || ''} ${cita.apellido_paterno || ''} ${cita.apellido_materno || ''}`.trim();

                return {
                    ...cita,
                    fechaFormateada: fechaFormat,
                    horaFormateada: horaFormat,
                    nombrePaciente: nombreCompleto || 'Paciente sin nombre',
                    diagnostico: cita.observaciones, 
                    motivo_cancelacion: cita.motivo_cancelacion // se pasa el motivo al frontend
                };
            });

            res.json({
                usuario: resPersonal[0].nombre,
                rol: rol,
                citas: citasFormateadas
            });
        });
    });
});


// ==========================================
// API DE REPORTES / CONCENTRADO
// ==========================================
app.get('/api/concentrado_citas', verificarToken, (req, res) => {
    const idUsuario = req.usuarioId;

    conexion.query("SELECT usuario, rol FROM usuario WHERE idUsuario = ?", [idUsuario], (errU, resU) => {
        if (errU || resU.length === 0) return res.status(500).json({ error: "Error de servidor" });
        
        const rol = resU[0].rol;
        if (rol !== 'medico' && rol !== 'nutriologo' && rol !== 'psicologo' && rol !== 'ADMIN') {
            return res.status(403).json({ error: "Acceso denegado" });
        }

        const generarReporte = (idPersonal) => {
            let sql = `
                SELECT 
                    YEAR(fecha) as anio,
                    MONTH(fecha) as mes,
                    COUNT(*) as total,
                    SUM(CASE WHEN estado = 'Atendida' THEN 1 ELSE 0 END) as atendidas,
                    SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) as canceladas,
                    SUM(CASE WHEN estado = 'Programada' THEN 1 ELSE 0 END) as pendientes
                FROM cita 
            `;
            let params = [];

            if (idPersonal !== null) {
                sql += " WHERE idPersonal = ?";
                params.push(idPersonal);
            }

            sql += " GROUP BY YEAR(fecha), MONTH(fecha) ORDER BY anio DESC, mes DESC";

            conexion.query(sql, params, (errR, reportes) => {
                if (errR) return res.status(500).json({ error: "Error generando el reporte." });

                const mesesNombres = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                
                const reportesFormateados = reportes.map(r => {
                    return { ...r, mesNombre: mesesNombres[r.mes] };
                });

                res.status(200).json({ usuario: resU[0].usuario, rol: rol, reportes: reportesFormateados });
            });
        };

        if (rol === 'ADMIN') {
            generarReporte(null); 
        } else {
            conexion.query("SELECT idPersonal FROM personal_salud WHERE idUsuario = ?", [idUsuario], (errP, resPersonal) => {
                if (errP || resPersonal.length === 0) return res.status(200).json({ usuario: resU[0].usuario, rol: rol, reportes: [] });
                generarReporte(resPersonal[0].idPersonal);
            });
        }
    });
});

// ==========================================
// API DE GESTIÓN DE PACIENTES (ADMIN)
// ==========================================
function verificarAdmin(req, res, next) {
    const idUsuario = req.usuarioId; // Obtenido gracias a verificarToken

    conexion.query("SELECT usuario, rol FROM usuario WHERE idUsuario = ?", [idUsuario], (err, resU) => {
        if (err || resU.length === 0 || resU[0].rol !== 'ADMIN') {
            return res.status(403).json({ error: "Acceso denegado. Solo administradores." });
        }
        req.usuarioAdmin = resU[0].usuario; 
        next();
    });
}

app.get('/api/gestion_usuarios', verificarToken, verificarAdmin, (req, res) => {
    const sql = `
        SELECT u.idUsuario, u.matricula, u.usuario, u.password, u.rol, 
               p.correo, p.carrera 
        FROM usuario u 
        LEFT JOIN perfil p ON u.idUsuario = p.idUsuario 
        WHERE u.rol = 'paciente' 
        ORDER BY u.idUsuario DESC
    `;
    conexion.query(sql, (err, usuarios) => {
        if (err) return res.status(500).json({ error: "Error de BD" });
        res.status(200).json({ usuarioAdmin: req.usuarioAdmin, usuarios: usuarios });
    });
});

app.post('/api/gestion_usuarios', verificarToken, verificarAdmin, (req, res) => {
    const { matricula, usuario, password, correo, carrera } = req.body;
    
    conexion.query("SELECT idUsuario FROM usuario WHERE matricula = ?", [matricula], (err, results) => {
        if (results.length > 0) return res.status(400).json({ mensaje: "La matrícula ya existe." });
        
        conexion.query("INSERT INTO usuario (matricula, usuario, password, rol) VALUES (?, ?, ?, 'paciente')", [matricula, usuario, password], (err2, result) => {
            if (err2) return res.status(500).json({ mensaje: "Error al crear: " + err2.message });
            
            const newId = result.insertId;
            conexion.query("INSERT INTO perfil (idUsuario, correo, carrera) VALUES (?, ?, ?)", [newId, correo || '', carrera || ''], (err3) => {
                if (err3) return res.status(500).json({ mensaje: "Error al guardar perfil." });
                res.status(201).json({ mensaje: "Paciente creado exitosamente." });
            });
        });
    });
});

app.put('/api/gestion_usuarios', verificarToken, verificarAdmin, (req, res) => {
    const { idUsuario, matricula, usuario, password, correo, carrera } = req.body;
    
    conexion.query("UPDATE usuario SET matricula=?, usuario=?, password=? WHERE idUsuario=?", [matricula, usuario, password, idUsuario], (err) => {
        if (err) return res.status(500).json({ mensaje: "Error al actualizar acceso." });
        
        conexion.query("SELECT idPerfil FROM perfil WHERE idUsuario = ?", [idUsuario], (errCheck, results) => {
            if (results.length > 0) {
                conexion.query("UPDATE perfil SET correo=?, carrera=? WHERE idUsuario=?", [correo || '', carrera || '', idUsuario], (errUpd) => {
                    if (errUpd) return res.status(500).json({ mensaje: "Error al actualizar correo/carrera." });
                    res.status(200).json({ mensaje: "Paciente actualizado correctamente." });
                });
            } else {
                conexion.query("INSERT INTO perfil (idUsuario, correo, carrera) VALUES (?, ?, ?)", [idUsuario, correo || '', carrera || ''], (errIns) => {
                    if (errIns) return res.status(500).json({ mensaje: "Error al insertar perfil." });
                    res.status(200).json({ mensaje: "Paciente actualizado correctamente." });
                });
            }
        });
    });
});

app.delete('/api/gestion_usuarios/:id', verificarToken, verificarAdmin, (req, res) => {
    const idEliminar = req.params.id;
    
    conexion.query("DELETE FROM cita WHERE idPerfil IN (SELECT idPerfil FROM perfil WHERE idUsuario = ?)", [idEliminar], () => {
        conexion.query("DELETE FROM perfil WHERE idUsuario = ?", [idEliminar], () => {
            conexion.query("DELETE FROM usuario WHERE idUsuario = ?", [idEliminar], (errFinal) => {
                if (errFinal) return res.status(500).json({ mensaje: "Error al eliminar: " + errFinal.message });
                res.status(200).json({ mensaje: "Paciente eliminado correctamente." });
            });
        });
    });
});

// ==========================================
// API DE GESTIÓN DE PERSONAL DE SALUD (ADMIN)
// ==========================================
app.get('/api/gestion_personal', verificarToken, verificarAdmin, (req, res) => {
    const sql = `
        SELECT u.idUsuario, u.matricula, u.usuario as login, u.password, u.rol, 
               p.idPersonal, p.nombre, p.profesion, p.correo, p.estado, p.turno 
        FROM usuario u 
        LEFT JOIN personal_salud p ON u.idUsuario = p.idUsuario 
        WHERE u.rol != 'paciente' 
        ORDER BY u.idUsuario DESC
    `;
    conexion.query(sql, (err, usuarios) => {
        if (err) return res.status(500).json({ error: "Error de BD" });
        res.status(200).json({ usuarioAdmin: req.usuarioAdmin, usuarios: usuarios });
    });
});

app.post('/api/gestion_personal', verificarToken, verificarAdmin, (req, res) => {
    const { matricula, usuario, password, rol, correo, estado, turno, nombre, profesion } = req.body;
    
    conexion.query("SELECT idUsuario FROM usuario WHERE matricula = ?", [matricula], (err, results) => {
        if (results.length > 0) return res.status(400).json({ mensaje: "La matrícula ya existe." });
        
        conexion.query("INSERT INTO usuario (matricula, usuario, password, rol) VALUES (?, ?, ?, ?)", [matricula, usuario, password, rol], (err2, result) => {
            if (err2) return res.status(500).json({ mensaje: "Error al crear usuario." });
            
            const newId = result.insertId;
            conexion.query("INSERT INTO personal_salud (idUsuario, nombre, profesion, correo, estado, turno) VALUES (?, ?, ?, ?, ?, ?)", 
            [newId, nombre || 'Sin nombre', profesion || 'General', correo || '', estado || 'Activo', turno || 'Matutino'], (err3) => {
                if (err3) return res.status(500).json({ mensaje: "Error al guardar el perfil en personal_salud." });
                res.status(201).json({ mensaje: "Personal registrado y vinculado exitosamente." });
            });
        });
    });
});

app.put('/api/gestion_personal', verificarToken, verificarAdmin, (req, res) => {
    const { idUsuario, matricula, usuario, password, rol, correo, estado, turno, nombre, profesion } = req.body;
    
    conexion.query("UPDATE usuario SET matricula=?, usuario=?, password=?, rol=? WHERE idUsuario=?", [matricula, usuario, password, rol, idUsuario], (err) => {
        if (err) return res.status(500).json({ mensaje: "Error al actualizar acceso." });
        
        conexion.query("SELECT idPersonal FROM personal_salud WHERE idUsuario = ?", [idUsuario], (errCheck, results) => {
            if (results.length > 0) {
                conexion.query("UPDATE personal_salud SET nombre=?, profesion=?, correo=?, estado=?, turno=? WHERE idUsuario=?", 
                [nombre, profesion, correo || '', estado || 'Activo', turno || 'Matutino', idUsuario], (errUpd) => {
                    if (errUpd) return res.status(500).json({ mensaje: "Error al actualizar personal_salud." });
                    res.status(200).json({ mensaje: "Personal actualizado correctamente." });
                });
            } else {
                conexion.query("INSERT INTO personal_salud (idUsuario, nombre, profesion, correo, estado, turno) VALUES (?, ?, ?, ?, ?, ?)", 
                [idUsuario, nombre, profesion, correo || '', estado || 'Activo', turno || 'Matutino'], (errIns) => {
                    if (errIns) return res.status(500).json({ mensaje: "Error al insertar en personal_salud." });
                    res.status(200).json({ mensaje: "Personal vinculado correctamente." });
                });
            }
        });
    });
});

app.delete('/api/gestion_personal/:id', verificarToken, verificarAdmin, (req, res) => {
    const idEliminar = req.params.id;
    
    if (idEliminar == req.usuarioId) {
        return res.status(400).json({ mensaje: "No puedes eliminar tu propia cuenta." });
    }

    conexion.query("DELETE FROM cita WHERE idPersonal IN (SELECT idPersonal FROM personal_salud WHERE idUsuario = ?)", [idEliminar], () => {
        conexion.query("DELETE FROM personal_salud WHERE idUsuario = ?", [idEliminar], () => {
            conexion.query("DELETE FROM usuario WHERE idUsuario = ?", [idEliminar], (errFinal) => {
                if (errFinal) return res.status(500).json({ mensaje: "Error al eliminar: " + errFinal.message });
                res.status(200).json({ mensaje: "Personal de salud eliminado correctamente." });
            });
        });
    });
});

// ==========================================
// API DE DASHBOARD Y SERVIDOR (ADMIN MAESTRO)
// ==========================================
app.get('/api/admin/stats', verificarToken, verificarAdmin, (req, res) => {
    const sqlKPIs = `SELECT rol, COUNT(*) as total FROM usuario GROUP BY rol`;
    const sqlCitas = `SELECT estado, COUNT(*) as total FROM cita GROUP BY estado`;

    conexion.query(sqlKPIs, (err1, resKPIs) => {
        if (err1) return res.status(500).json({ error: "Error obteniendo KPIs" });

        conexion.query(sqlCitas, (err2, resCitas) => {
            if (err2) return res.status(500).json({ error: "Error obteniendo gráficas" });

            const stats = {
                pacientes: resKPIs.find(r => r.rol === 'paciente')?.total || 0,
                medicos: resKPIs.find(r => r.rol === 'medico')?.total || 0,
                nutriologos: resKPIs.find(r => r.rol === 'nutriologo')?.total || 0,
                psicologos: resKPIs.find(r => r.rol === 'psicologo')?.total || 0,
                grafica_citas: resCitas
            };

            res.status(200).json({ usuarioAdmin: req.usuarioAdmin, stats: stats });
        });
    });
});

app.get('/api/admin/server', verificarToken, verificarAdmin, (req, res) => {
    try {
        conexion.query("SELECT VERSION() as version", (err, results) => {
            const memoriaMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const uptimeMinutos = Math.round(process.uptime() / 60);
            
            let dbVersion = 'Desconocida';
            if (!err && results && results.length > 0) {
                dbVersion = results[0].version;
            }

            res.status(200).json({
                usuarioAdmin: req.usuarioAdmin || 'Admin',
                servidor: {
                    node_version: process.version,
                    plataforma: process.platform,
                    memoria: `${memoriaMB} MB`,
                    tiempo_activo: `${uptimeMinutos} Minutos`
                },
                base_datos: {
                    estado: err ? 'Desconectada' : 'Conectada',
                    version: dbVersion
                }
            });
        });
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// EXPORTAR LA APP
module.exports = app;