const app = require('./app');

const PUERTO = 3000;

app.listen(PUERTO, () => {
    console.log(`===========================================`);
    console.log(`Servidor de UTMedic`);
    console.log(`URL: http://localhost:${PUERTO}`);
    console.log(`===========================================`);
});