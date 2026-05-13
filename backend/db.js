const mysql = require('mysql');

// CONEXIÓN DBBBBBBBBBBBBBBBBBBBBB
const conexion = mysql.createConnection({
    host: 'localhost',
    user: 'root',       
    password: '',       
    database: 'estadbd' 
});

conexion.connect((error) => {
    if (error) {
        console.error('Error al conectar a MySQL:', error);
        return;
    }
    console.log('Conectado a la base de datos MySQL (desde db.js)');
});

module.exports = conexion;