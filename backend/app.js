const express = require('express');
const mysql = require('mysql2/promise'); 

const app = express();
const puerto = 3000;

// Tu conexión a la base de datos se mantiene intacta aquí
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      
    password: '',      
    database: 'estadbd', 
});

// 1. ESTA ES LA LÍNEA CLAVE: Le dice que busque tu index.html
app.use(express.static('backend/public'));

// 2. BORRAMOS el bloque de app.get('/') que enviaba el texto

app.listen(puerto, () => {
    console.log(`Servidor corriendo en http://localhost:${puerto}`);
});

// Facebook (API propia)
app.get('/api/estadisticas/facebook', async (req, res) => {
    try {
        // Pedimos a MySQL los últimos 7 registros de Facebook, ordenados por fecha
        const [filas] = await pool.query(`
            SELECT valor, DATE_FORMAT(fecha_registro, '%d/%m') as fecha 
            FROM estadisticas_diarias 
            WHERE plataforma = 'facebook' AND metrica = 'seguidores'
            ORDER BY fecha_registro DESC LIMIT 7
        `);
        
        // Enviamos esos datos al frontend en formato JSON
        res.json(filas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al obtener datos" });
    }
});

// YouTube (API propia)
app.get('/api/estadisticas/youtube', async (req, res) => {
    try {
        // Pedimos a MySQL los últimos 7 registros de Facebook, ordenados por fecha
        const [filas] = await pool.query(`
            SELECT valor, DATE_FORMAT(fecha_registro, '%d/%m') as fecha 
            FROM estadisticas_diarias 
            WHERE plataforma = 'youtube' AND metrica = 'seguidores'
            ORDER BY fecha_registro DESC LIMIT 7
        `);
        
        // Enviamos esos datos al frontend en formato JSON
        res.json(filas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al obtener datos" });
    }
});