// Obtener el lienzo donde se dibujara la gráfica
const ctxF = document.getElementById('graficaY');
const ctxF2 = document.getElementById('graficaY2');
let graficaActualF; // Variable para guardar la gráfica y poder actualizarla
let graficaActualF2; // Variable para guardar la gráfica y poder actualizarla

// Función asíncrona para obtener los datos del servidor
async function cargarDatosYoutube() {
    try {
        const respuesta = await fetch('/api/estadisticas/youtube');
        const datos = await respuesta.json();
        const etiquetasFechas = datos.estadisticas.map(fila => fila.fecha);
        const etiquetasFechasVistas = datos.vistas.map(fila => fila.fecha);
        const valoresSeguidores = datos.estadisticas.map(fila => fila.valor);
        const valoresVistas = datos.vistas.map(fila => fila.valor);

        // Lógica del estado
        const textoEstado = document.getElementById('estado-scraper');
        const textoEstadoVistas = document.getElementById('estado-scraper-vistas');
        const esOperativo = datos.estado_scraper === 1;
        const estadoTexto = esOperativo ? "Operativo" : "Fallo de API";
        const estadoClase = esOperativo ? "fw-bold mb-1 text-success" : "fw-bold mb-1 text-danger";
        textoEstado.innerText = estadoTexto;
        textoEstado.className = estadoClase;
        textoEstadoVistas.innerText = estadoTexto;
        textoEstadoVistas.className = estadoClase;
        etiquetasFechas.reverse();
        valoresSeguidores.reverse();
        valoresVistas.reverse();
        etiquetasFechasVistas.reverse();

        // Actualiza las tarjetas con el último valor real obtenido
        const seguidoresCard = document.getElementById('fb-total');
        const ultimoSeguidores = valoresSeguidores.length ? valoresSeguidores[valoresSeguidores.length - 1] : 0;
        seguidoresCard.textContent = ultimoSeguidores.toLocaleString(); // Actualiza el número de seguidores en la tarjeta
        const vistasCard = document.getElementById('youtube-vistas');
        const ultimoVistas = valoresVistas.length ? valoresVistas[valoresVistas.length - 1] : 0;
        vistasCard.textContent = ultimoVistas.toLocaleString(); // Actualiza el número de vistas en la tarjeta

        // Calcula el crecimiento comparando el último valor con el anterior
        const crecimientoCard = document.getElementById('crecimientoF');
        const crecimiento = valoresSeguidores.length > 1 ? valoresSeguidores[valoresSeguidores.length - 1] - valoresSeguidores[valoresSeguidores.length - 2] : 0;
        const fechaCrecimientoCard = document.getElementById('fecha-crecimientoF');
        crecimientoCard.textContent = crecimiento.toLocaleString(); // Actualiza el crecimiento en la tarjeta
        fechaCrecimientoCard.textContent = etiquetasFechas[etiquetasFechas.length - 2] || 'N/A'; // Actualiza la fecha de crecimiento en la tarjeta

        const crecimientoVCard = document.getElementById('crecimientoV');
        const fechaCrecimientoVCard = document.getElementById('fecha-crecimientoV');
        const crecimientoV = valoresVistas.length > 1 ? valoresVistas[valoresVistas.length - 1] - valoresVistas[valoresVistas.length - 2] : 0;
        crecimientoVCard.textContent = crecimientoV.toLocaleString();
        fechaCrecimientoVCard.textContent = etiquetasFechasVistas[etiquetasFechasVistas.length - 2] || 'N/A';

        const actualizacionCard = document.getElementById('texto-actualizacion');
        actualizacionCard.textContent = etiquetasFechas[etiquetasFechas.length - 1]; // Actualiza la fecha de última actualización en la tarjeta

        // Dibuja la gráfica con los datos reales
        graficaActualF = new Chart(ctxF, {
            type: 'line',
            data: {
            labels: etiquetasFechas, // Las fechas que vienen de MySQL
                datasets: [{
                    label: 'Suscriptores de YouTube',
                    data: valoresSeguidores, // Los números que vienen de MySQL
                    borderColor: '#ff5252',
                    tension: 0.3,
                    fill: true,
                    backgroundColor: 'rgba(255, 91, 91, 0.1)'
               }]
            },
            options: { 
                maintainAspectRatio: false,
                responsive: true 
            }
        });

        const tiempoUltimaPeticion = document.getElementById('tiempo-ultima-peticion');
        const tiempoUltimaPeticionVistas = document.getElementById('tiempo-ultima-peticion-vistas');
        if (datos.ultima_fecha) {
            const ultimaFecha = new Date(datos.ultima_fecha);
            const ahora = new Date();
            const diferenciaHoras = (ahora - ultimaFecha) / (1000 * 60 * 60);
            const horas = Math.round(diferenciaHoras);
            tiempoUltimaPeticion.textContent = horas;
            tiempoUltimaPeticionVistas.textContent = horas;
        } else {
            tiempoUltimaPeticion.textContent = 'N/A';
            tiempoUltimaPeticionVistas.textContent = 'N/A';
        }

        // Dibuja la gráfica con los datos reales
        graficaActualF2 = new Chart(ctxF2, {
            type: 'line',
            data: {
                labels: etiquetasFechasVistas, // Las fechas que vienen de MySQL
                datasets: [{
                    label: 'Vistas de YouTube',
                    data: valoresVistas, // Los números que vienen de MySQL
                    borderColor: '#ff5252',
                    tension: 0.3,
                    fill: true,
                    backgroundColor: 'rgba(255, 91, 91, 0.1)'
                }]
            },
            options: { 
                maintainAspectRatio: false,
                responsive: true 
            }
        });


    } catch (error) {
        console.error("Error cargando los datos para la gráfica:", error);
   }
}

// Ejecuta la función apenas cargue la página
cargarDatosYoutube();

// Lógica para el botón de Cerrar Sesión
document.getElementById('btn-logout').addEventListener('click', async () => {
    try {
        const respuesta = await fetch('/api/logout', { method: 'POST' });
        const datos = await respuesta.json();
                
        if (datos.exito) {
            // Si el servidor confirma la destrucción de la sesión, lo manda al login
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
});

// PDF
document.getElementById('btn-exportar-pdf').addEventListener('click', async () => {
    
    const elemento = document.getElementById('area-reporte');
    const botonE = document.getElementById('btn-exportar-pdf');
    
    // Cambia el texto
    const textoOriginal = botonE.innerHTML;
    botonE.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Generando...';
    
    const estilosPrevios = {
        height: elemento.style.height,
        overflow: elemento.style.overflow,
        transform: elemento.style.transform,
        transformOrigin: elemento.style.transformOrigin,
        width: elemento.style.width,
    };

    elemento.style.height = 'auto';
    elemento.style.overflow = 'visible';
    elemento.style.transform = 'none';
    elemento.style.transformOrigin = 'top left';
    elemento.style.width = '100%';

    const opciones = {
        margin:       [8, 8, 8, 8],
        filename:     'Reporte_YouTube.pdf',
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  {
            scale: 2,
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            width: elemento.scrollWidth,
            windowWidth: document.body.scrollWidth,
            windowHeight: document.body.scrollHeight
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    try {
        await html2pdf()
            .set(opciones)
            .from(elemento)
            .save();
    } catch (error) {
        console.error("Error al generar PDF:", error);
    } finally {
        // Restaura la pantalla
        elemento.style.transform = estilosPrevios.transform;
        elemento.style.transformOrigin = estilosPrevios.transformOrigin;
        elemento.style.height = estilosPrevios.height;
        elemento.style.overflow = estilosPrevios.overflow;
        elemento.style.width = estilosPrevios.width;
        botonE.innerHTML = textoOriginal;
    }
});