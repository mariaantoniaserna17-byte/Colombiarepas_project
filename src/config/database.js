const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'ArepasDB',
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
  },
  pool: {
    max: 15,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log(`[Database] Conexión establecida con SQL Server en '${dbConfig.server}', BD: '${dbConfig.database}'`);
    return pool;
  })
  .catch(err => {
    console.error('[Database Error] Error conectando a SQL Server:', err.message);
    // No matamos el proceso para permitir que Express levante e informe adecuadamente
    return null;
  });

module.exports = {
  sql,
  poolPromise
};

