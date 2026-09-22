require('dotenv').config();
const axios = require('axios');
const mysql = require('mysql2/promise');

// Conexión a tu BD
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'estadbd'
});

async function obtenerYGuardarFacebook() {
    console.log("Iniciando extracción de Facebook (Intento 1: API Principal)...");

    // Configuración de tu API Principal (La que usas actualmente)
    const optionsPrincipal = {
        method: 'GET',
        url: 'https://facebook-scraper3.p.rapidapi.com/page/details',
        params: { 
            url: 'https://www.facebook.com/CBTELEVISION'
        },
        headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'facebook-scraper3.p.rapidapi.com',
            'Content-Type': 'application/json'
        }
    };

    try {
        // --- INTENTO 1 ---
        const response = await axios.request(optionsPrincipal);
        // Ajusta esta ruta de 'seguidores' a la que usa tu API Principal
        const seguidores = response.data[0].followers_count; 

        await guardarDatos(seguidores);

    } catch (errorPrincipal) {
        console.warn("--- Falló la API Principal de Facebook. Activando API de respaldo...");

        // Configuración de API Secundaria
        const optionsRespaldo = {
            method: 'GET',
            url: 'https://facebook-pages-scraper2.p.rapidapi.com/get_facebook_pages_details',
            params: { 
                link: 'https://www.facebook.com/CBTELEVISION',
                show_verified_badge: 'false',
                proxy_country: 'us'
             }, // Asegúrate de usar los parámetros que pide esta otra API
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'facebook-pages-scraper2.p.rapidapi.com',
                'Content-Type': 'application/json'
            }
        };

        try {
            // --- INTENTO 2 (Si el Intento 1 falló) ---
            const responseRespaldo = await axios.request(optionsRespaldo);
            const seguidoresRespaldo = responseRespaldo.data[0].followers_count; 

            await guardarDatos(seguidoresRespaldo);
            console.log("--- ¡Guardado por la API de respaldo!");

        } catch (errorRespaldo) {
            // --- Ambas fallaron ---
            console.error("--- Error Crítico: Ambas APIs de Facebook fallaron.");
            
            // Guarda el 0 en la tabla de scrapers porque ya no hay más opciones
            try {
                await pool.query('UPDATE scrapers SET estado = 0 WHERE plataforma = ?', ['facebook']);
            } catch (dbError) {
                console.error("--- Error al actualizar estado en BD:", dbError);
            }
        }
    }

    // Función separada para no repetir el código de guardar en MySQL dos veces
    async function guardarDatos(totalSeguidores) {
        await pool.query(
            'INSERT INTO estadisticas_diarias (plataforma, metrica, valor) VALUES (?, ?, ?)',
            ['facebook', 'seguidores', totalSeguidores]
        );
        await pool.query(
            'UPDATE scrapers SET estado = 1 WHERE plataforma = ?', 
            ['facebook']
        );
        console.log("--- ¡Éxito! Datos de Facebook guardados en la base de datos.");
    }
}
// Función para Instagram
async function obtenerYGuardarInstagram() {
    console.log("--- Iniciando extracción de Instagram...");

    const options = {
        method: 'GET',
        url: 'https://instagram-scraper-20251.p.rapidapi.com/userinfo/', // Verifica el endpoint exacto en RapidAPI
        params: {
            username_or_id: 'cbtelevision'
        },
        headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'instagram-scraper-20251.p.rapidapi.com',
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await axios.request(options);
        // Ajusta esta línea según la estructura del JSON de esta API específica
        const seguidores = response.data.data.follower_count;

        await pool.query(
            'INSERT INTO estadisticas_diarias (plataforma, metrica, valor) VALUES (?, ?, ?)',
            ['instagram', 'seguidores', seguidores]
        );
        
        // Actualiza el estado del scraper a éxito (1)
        await pool.query(
            'UPDATE scrapers SET estado = 1 WHERE plataforma = ?', 
            ['instagram']
        );
        console.log("--- ¡Éxito! Datos de Instagram guardados y estado actualizado.");
    } catch (error) {
        console.error("--- Error en Instagram:", error.message);
        
        // Actualiza el estado del scraper a fallo (0)
        try {
            await pool.query(
                'UPDATE scrapers SET estado = 0 WHERE plataforma = ?', 
                ['instagram']
            );
            console.log("--- Estado del scraper de Instagram actualizado a Fallando (0).");
        } catch (dbError) {
            console.error("--- Error al actualizar la tabla de scrapers:", dbError);
        }
    }
}

// Función para X
async function obtenerYGuardarX() {
    console.log("--- Iniciando extracción de X...");

    const options = {
        method: 'GET',
        url: 'https://twitter-aio.p.rapidapi.com/user/by/username/cb_television', // Verifica el endpoint exacto en RapidAPI
        params: { username: 'cbtelevision' }, // Ajusta el nombre de usuario según sea necesario
        headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'twitter-aio.p.rapidapi.com',
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await axios.request(options);
        // Ajusta esta línea según la estructura del JSON de esta API específica
        const seguidores = response.data.data.user.result.legacy.followers_count;

        await pool.query(
            'INSERT INTO estadisticas_diarias (plataforma, metrica, valor) VALUES (?, ?, ?)',
            ['x', 'seguidores', seguidores]
        );
        
        // Actualiza el estado del scraper a éxito (1)
        await pool.query(
            'UPDATE scrapers SET estado = 1 WHERE plataforma = ?', 
            ['x']
        );
        console.log("--- ¡Éxito! Datos de X guardados y estado actualizado.");
    } catch (error) {
        console.error("--- Error en X:", error.message);
        
        // Actualiza el estado del scraper a fallo (0)
        try {
            await pool.query(
                'UPDATE scrapers SET estado = 0 WHERE plataforma = ?', 
                ['x']
            );
            console.log("--- Estado del scraper de X actualizado a Fallando (0).");
        } catch (dbError) {
            console.error("--- Error al actualizar la tabla de scrapers:", dbError);
        }
    }
}

// Función para YouTube
async function obtenerYGuardarYouTube() {
    console.log("--- Iniciando extracción de YouTube...");

    const options = {
        method: 'GET',
        url: 'https://youtube138.p.rapidapi.com/channel/details/', // Verifica el endpoint exacto en RapidAPI
        params: { 
            id: 'https://www.youtube.com/channel/UCWhgLCgBy0GR1nMgVEpfSmQ',
            hl: 'en',
            gl: 'US'
        }, // Ajusta el nombre de usuario según sea necesario
        headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'youtube138.p.rapidapi.com',
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await axios.request(options);
        // Ajusta esta línea según la estructura del JSON de esta API específica
        const seguidores = response.data.stats.subscribers;
        const vistas = response.data.stats.views;

        await pool.query(
            'INSERT INTO estadisticas_diarias (plataforma, metrica, valor) VALUES (?, ?, ?)',
            ['youtube', 'seguidores', seguidores]
        );
        await pool.query(
            'INSERT INTO estadisticas_diarias (plataforma, metrica, valor) VALUES (?, ?, ?)',
            ['youtube', 'vistas', vistas]
        );

        // Actualiza el estado del scraper a éxito (1)
        await pool.query(
            'UPDATE scrapers SET estado = 1 WHERE plataforma = ?', 
            ['youtube']
        );
        
        console.log("--- ¡Éxito! Datos de YouTube guardados y estado actualizado.");
    } catch (error) {
        console.error("--- Error en YouTube:", error.message);
        
        // Actualiza el estado del scraper a fallo (0)
        try {
            await pool.query(
                'UPDATE scrapers SET estado = 0 WHERE plataforma = ?', 
                ['youtube']
            );
            console.log("--- Estado del scraper de YouTube actualizado a Fallando (0).");
        } catch (dbError) {
            console.error("--- Error al actualizar la tabla de scrapers:", dbError);
        }
    }
}

// Exporta ambas funciones ahora
module.exports = { obtenerYGuardarFacebook, obtenerYGuardarInstagram, obtenerYGuardarYouTube, obtenerYGuardarX };