// Obtener el lienzo donde se dibujara la gráfica
        const ctxF = document.getElementById('graficaInstagram');
        let graficaActualF; // Variable para guardar la gráfica y poder actualizarla

        // Función asíncrona para obtener los datos del servidor
        async function cargarDatosInstagram() {
            try {
                const respuesta = await fetch('/api/estadisticas/instagram');
                const datos = await respuesta.json();

                const etiquetasFechas = datos.estadisticas.map(fila => fila.fecha);
                const valoresSeguidores = datos.estadisticas.map(fila => fila.valor);

                // Lógica del estado
                const textoEstado = document.getElementById('estado-scraper');
                if (datos.estado_scraper === 1) {
                    textoEstado.innerText = "Operativo";
                    textoEstado.className = "fw-bold mb-1 text-success";
                } else {
                    textoEstado.innerText = "Fallo de API";
                    textoEstado.className = "fw-bold mb-1 text-danger";
                }
                etiquetasFechas.reverse();
                valoresSeguidores.reverse();

                // Actualiza las tarjetas con el último valor real obtenido
                const seguidoresCard = document.getElementById('fb-total');
                seguidoresCard.textContent = valoresSeguidores[valoresSeguidores.length - 1].toLocaleString(); // Actualiza el número de seguidores en la tarjeta
                
                // Calcula el crecimiento comparando el último valor con el anterior
                const crecimientoCard = document.getElementById('crecimientoF');
                const crecimiento = valoresSeguidores[valoresSeguidores.length - 1] - valoresSeguidores[valoresSeguidores.length - 2];
                const fechaCrecimientoCard = document.getElementById('fecha-crecimientoF');
                crecimientoCard.textContent = crecimiento.toLocaleString(); // Actualiza el crecimiento en la tarjeta
                fechaCrecimientoCard.textContent = etiquetasFechas[etiquetasFechas.length - 2]; // Actualiza la fecha de crecimiento en la tarjeta

                const actualizacionCard = document.getElementById('texto-actualizacion');
                actualizacionCard.textContent = etiquetasFechas[etiquetasFechas.length - 1]; // Actualiza la fecha de última actualización en la tarjeta

                // Dibuja la gráfica con los datos reales
                graficaActualF = new Chart(ctxF, {
                    type: 'line',
                    data: {
                        labels: etiquetasFechas, // Las fechas que vienen de MySQL
                        datasets: [{
                            label: 'Seguidores de Instagram',
                            data: valoresSeguidores, // Los números que vienen de MySQL
                            borderColor: '#ff54cc',
                            tension: 0.3,
                            fill: true,
                            backgroundColor: 'rgba(253, 13, 189, 0.1)'
                        }]
                    },
                    options: { 
                        maintainAspectRatio: false,
                        responsive: true 
                    }
                });

                const tiempoUltimaPeticion = document.getElementById('tiempo-ultima-peticion');
                if (datos.ultima_fecha) {
                    const ultimaFecha = new Date(datos.ultima_fecha);
                    const ahora = new Date();
                    const diferenciaHoras = (ahora - ultimaFecha) / (1000 * 60 * 60);
                    tiempoUltimaPeticion.textContent = Math.round(diferenciaHoras);
                } else {
                    tiempoUltimaPeticion.textContent = 'N/A';
                }

            } catch (error) {
                console.error("Error cargando los datos para la gráfica:", error);
            }
        }

        // Ejecuta la función apenas cargue la página
        cargarDatosInstagram();

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
    
    // Cambiar el texto
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
        filename:     'Reporte_Instagram.pdf',
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