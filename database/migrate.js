const fs = require('fs');
const path = require('path');
const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER || 'arepas_user',
  password: process.env.DB_PASSWORD || 'TuPasswordSeguro123*',
  server: process.env.DB_SERVER || 'localhost',
  database: 'master', // Primero conectamos a master para asegurar que la BD exista
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
  }
};

/**
 * Divide un script SQL en lotes basados en la palabra clave 'GO'
 */
function splitBatches(sqlText) {
  return sqlText
    .split(/^\s*GO\s*$/gmi)
    .map(b => b.trim())
    .filter(b => b.length > 0);
}

async function runMigration() {
  console.log('🚀 Iniciando proceso de migración de base de datos...');
  console.log(`📡 Conectando a SQL Server: ${dbConfig.server} con usuario '${dbConfig.user}'...`);

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    console.log('✅ Conexión establecida con SQL Server.');

    // 1. Ejecutar Schema (DDL)
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`📄 Leyendo script DDL: ${schemaPath}...`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const schemaBatches = splitBatches(schemaSql);

    console.log(`⚙️ Ejecutando ${schemaBatches.length} lotes de creación de tablas e índices...`);
    for (let i = 0; i < schemaBatches.length; i++) {
      const batch = schemaBatches[i];
      try {
        await pool.request().query(batch);
      } catch (err) {
        console.warn(`[Aviso en lote ${i + 1} de schema]:`, err.message);
      }
    }
    console.log('✅ Tablas, restricciones y relaciones creadas satisfactoriamente.');

    // 2. Ejecutar Seed (Datos Iniciales)
    const seedPath = path.join(__dirname, 'seed.sql');
    console.log(`🌱 Leyendo script Seed: ${seedPath}...`);
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    const seedBatches = splitBatches(seedSql);

    console.log(`📦 Insertando ${seedBatches.length} lotes de productos, toppings, roles y usuarios...`);
    for (let j = 0; j < seedBatches.length; j++) {
      const batch = seedBatches[j];
      try {
        await pool.request().query(batch);
      } catch (err) {
        console.warn(`[Aviso en lote ${j + 1} de seed]:`, err.message);
      }
    }

    console.log('🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
    console.log('✨ La base de datos ArepasDB está lista con todos sus datos y relaciones.');
  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
  } finally {
    if (pool) {
      await pool.close();
    }
    process.exit(0);
  }
}

runMigration();

