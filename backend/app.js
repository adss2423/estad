require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise'); 
const path = require('path');
const cron = require('node-cron');
const session = require('express-session');
const { obtenerYGuardarFacebook, obtenerYGuardarInstagram, obtenerYGuardarX, obtenerYGuardarYouTube } = require('./recolector'); // Importamos las funciones de recolección desde recolector.js

const app = express();
const puerto = 3000;

// Le decimos a Express que entienda datos de formularios e inicie las sesiones
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        // 1000 ms * 60 seg * 60 min * 2 horas  
        maxAge: 1000 * 60 * 60 * 2
    }
}));

// Middleware de seguridad
app.use((req, res, next) => {
    // Estas son las únicas rutas a las que se puede entrar sin contraseña
    const rutasLibres = ['/login.html', '/api/login'];
    const rutasAssetsPublicos = req.path.startsWith('/img/') || req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/fonts/') || req.path === '/favicon.ico';
    
    // Si la ruta es libre, es un asset público, o si el usuario ya está logeado, dejamos pasar
    if (rutasLibres.includes(req.path) || rutasAssetsPublicos || req.session.logeado) {
        next(); // Le abrimos la puerta
    } else {
        res.redirect('/login.html'); // Lo mandamos directo a que ponga su contraseña
    }
});

// Ruta para procesar el intento de inicio de sesión
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    
    // credenciales del .env 
    const usuarioCorrecto = process.env.ADMIN_USER;
    const passwordCorrecta = process.env.ADMIN_PASS;
    
    if (usuario === usuarioCorrecto && password === passwordCorrecta) {
        req.session.logeado = true;
        res.json({ exito: true });
    } else {
        res.status(401).json({ exito: false, mensaje: "Credenciales incorrectas" });
    }
});

// Ruta para cerrar sesión de forma segura
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ exito: false, mensaje: "Error al cerrar sesión" });
        }
        res.clearCookie('connect.sid'); // Borramos el rastro del navegador
        res.json({ exito: true });
    });
});

app.use(express.static(path.join(__dirname, 'public')));

// La conexión a la base de datos se mantiene intacta aquí
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      
    password: '',      
    database: 'estadbd', 
});

// ==========================================
// SALVAVIDAS DE ARRANQUE
// ==========================================
async function revisarDatosAtrasados() {
    try {
        console.log("--- Verificando estado de los datos al arrancar el servidor...");
        
        // Buscamos la fecha más reciente registrada en TODA la tabla
        const [filas] = await pool.query('SELECT MAX(fecha_registro) as ultima_fecha FROM estadisticas_diarias');
        const ultimaFechaStr = filas[0].ultima_fecha;

        let necesitaActualizar = false;

        // A: La tabla está completamente vacía
        if (!ultimaFechaStr) {
            console.log("--- Base de datos vacía. Ejecutando primera recolección de emergencia...");
            necesitaActualizar = true;
        } 
        // B: Hay datos, verificamos qué tan viejos son
        else {
            const ultimaFecha = new Date(ultimaFechaStr);
            const ahora = new Date();
            
            // Calculamos la diferencia en horas reales
            const diferenciaHoras = (ahora - ultimaFecha) / (1000 * 60 * 60);
            
            if (diferenciaHoras >= 48) {
                console.log(`--- Alerta: Han pasado ${Math.round(diferenciaHoras)} horas desde el último registro.`);
                console.log("Iniciando recolección de emergencia para recuperar el tiempo perdido...");
                necesitaActualizar = true;
            } else {
                console.log(`--- Datos correctos. Último registro hace solo ${Math.round(diferenciaHoras)} horas. El cron esperará su turno normal.`);
            }
        }

        // Si alguna de las alertas se activó, ejecuta las funciones ahora mismo
        if (necesitaActualizar) {
            obtenerYGuardarFacebook();
            obtenerYGuardarInstagram();
            obtenerYGuardarX();
            obtenerYGuardarYouTube();
        }

    } catch (error) {
        console.error("Error al ejecutar el salvavidas:", error);
    }
}

async function testDatos() {
    obtenerYGuardarYouTube();
}

// Ejecuta el salvavidas inmediatamente al prender Node
revisarDatosAtrasados();

// Cada dos dias a la medianoche, ejecuta la función de recolección
cron.schedule('0 0 */2 * *', () => {
    console.log("--- Ejecutando recolección automática de 48 horas...");
    obtenerYGuardarFacebook();
    obtenerYGuardarInstagram();
    obtenerYGuardarX();
    obtenerYGuardarYouTube();
});

app.listen(puerto, () => {
    console.log(`Servidor corriendo en:${puerto}`);
});

// Facebook (API propia)
app.get('/api/estadisticas/facebook', async (req, res) => {
    try {
        // Pide a MySQL los últimos 7 registros de Facebook
        const [filas] = await pool.query(`
            SELECT valor, DATE_FORMAT(fecha_registro, '%d/%m') as fecha 
            FROM estadisticas_diarias 
            WHERE plataforma = 'facebook' AND metrica = 'seguidores'
            ORDER BY fecha_registro DESC LIMIT 7
        `); // 
        
        // Consulta el estado actual en la tabla scrapers
        const [scraperData] = await pool.query(`
            SELECT estado 
            FROM scrapers 
            WHERE plataforma = 'facebook'
            LIMIT 1
        `);

        // Extrae el valor de forma segura (por si la tabla está vacía)
        const estadoActual = scraperData.length > 0 ? scraperData[0].estado : 'Desconocido';

        // Trae la última fecha registrada para el cálculo de horas
        const [ultimaFila] = await pool.query(`
            SELECT MAX(fecha_registro) as ultima_fecha
            FROM estadisticas_diarias
            WHERE plataforma = 'facebook' AND metrica = 'seguidores'
        `);
        const ultimaFecha = ultimaFila[0] ? ultimaFila[0].ultima_fecha : null;
        
        // Envía todo estructurado al frontend
        res.json({
            estadisticas: filas,
            estado_scraper: estadoActual,
            ultima_fecha: ultimaFecha
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al obtener datos" });
    }
});

// Instagram (API propia)
app.get('/api/estadisticas/instagram', async (req, res) => {
    try {
        // Pide los datos de la gráfica
        const [filas] = await pool.query(`
            SELECT valor, DATE_FORMAT(fecha_registro, '%d/%m') as fecha 
            FROM estadisticas_diarias 
            WHERE plataforma = 'instagram' AND metrica = 'seguidores' 
            ORDER BY fecha_registro DESC LIMIT 7
        `);
        
        // Consulta el estado actual
        const [scraperData] = await pool.query(`
            SELECT estado 
            FROM scrapers 
            WHERE plataforma = 'instagram'
            LIMIT 1
        `);

        const estadoActual = scraperData.length > 0 ? scraperData[0].estado : 'Desconocido';
        
        const [ultimaFila] = await pool.query(`
            SELECT MAX(fecha_registro) as ultima_fecha
            FROM estadisticas_diarias
            WHERE plataforma = 'instagram' AND metrica = 'seguidores'
        `);
        const ultimaFecha = ultimaFila[0] ? ultimaFila[0].ultima_fecha : null;
        
        // Envía todo estructurado
        res.json({
            estadisticas: filas,
            estado_scraper: estadoActual,
            ultima_fecha: ultimaFecha
        });
    } catch (error) {
        res.status(500).json({ error: "Error en base de datos" });
    }
});

// X (API propia)
app.get('/api/estadisticas/x', async (req, res) => {
    try {
        // Pide los datos de la gráfica
        const [filas] = await pool.query(`
            SELECT valor, DATE_FORMAT(fecha_registro, '%d/%m') as fecha 
            FROM estadisticas_diarias 
            WHERE plataforma = 'x' AND metrica = 'seguidores' 
            ORDER BY fecha_registro DESC LIMIT 7
        `);
        
        // Consulta el estado actual
        const [scraperData] = await pool.query(`
            SELECT estado 
            FROM scrapers 
            WHERE plataforma = 'x'
            LIMIT 1
        `);

        const estadoActual = scraperData.length > 0 ? scraperData[0].estado : 'Desconocido';
        
        const [ultimaFila] = await pool.query(`
            SELECT MAX(fecha_registro) as ultima_fecha
            FROM estadisticas_diarias
            WHERE plataforma = 'x' AND metrica = 'seguidores'
        `);
        const ultimaFecha = ultimaFila[0] ? ultimaFila[0].ultima_fecha : null;
        
        // Envía todo estructurado
        res.json({
            estadisticas: filas,
            estado_scraper: estadoActual,
            ultima_fecha: ultimaFecha
        });
    } catch (error) {
        res.status(500).json({ error: "Error en base de datos" });
    }
});

// YouTube (API propia)
app.get('/api/estadisticas/youtube', async (req, res) => {
    try {
        // Pide los datos de la gráfica suscriptores
        const [filas] = await pool.query(`
            SELECT valor, DATE_FORMAT(fecha_registro, '%d/%m') as fecha 
            FROM estadisticas_diarias 
            WHERE plataforma = 'youtube' AND metrica = 'seguidores' 
            ORDER BY fecha_registro DESC LIMIT 7
        `);

        const [filasVistas] = await pool.query(`
            SELECT valor, DATE_FORMAT(fecha_registro, '%d/%m') as fecha 
            FROM estadisticas_diarias
            WHERE plataforma = 'youtube' AND metrica = 'vistas'
            ORDER BY fecha_registro DESC LIMIT 7
        `);

        // Consulta el estado actual
        const [scraperData] = await pool.query(`
            SELECT estado 
            FROM scrapers 
            WHERE plataforma = 'youtube'
            LIMIT 1
        `);

        const estadoActual = scraperData.length > 0 ? scraperData[0].estado : 'Desconocido';
        
        const [ultimaFila] = await pool.query(`
            SELECT MAX(fecha_registro) as ultima_fecha
            FROM estadisticas_diarias
            WHERE plataforma = 'youtube' AND metrica = 'seguidores'
        `);
        const ultimaFecha = ultimaFila[0] ? ultimaFila[0].ultima_fecha : null;
        
        // Envía todo estructurado
        res.json({
            estadisticas: filas,
            vistas: filasVistas,
            estado_scraper: estadoActual,
            ultima_fecha: ultimaFecha
        });
    } catch (error) {
        res.status(500).json({ error: "Error en base de datos" });
    }
});

module.exports = { revisarDatosAtrasados };