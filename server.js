require('dotenv').config();
const app = require('./src/app');
const { poolPromise } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Probar conexión a la base de datos SQL Server
    const pool = await poolPromise;
    if (pool) {
      console.log('✅ Base de datos SQL Server lista.');
    } else {
      console.warn('⚠️ La base de datos aún no está conectada. Verifica tu archivo .env y que SQL Server esté en ejecución.');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Servidor Express escuchando en el puerto ${PORT}`);
      console.log(`📡 URL API: http://localhost:${PORT}/api`);
      console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();

