const { sql, poolPromise } = require('../config/database');

/**
 * Registra un evento en la tabla LogsAuditoria de SQL Server
 */
const logAudit = async (usuarioId, modulo, accion, detalle = '', ip = '') => {
  try {
    const pool = await poolPromise;
    if (!pool) return;

    await pool.request()
      .input('UsuarioID', sql.Int, usuarioId || null)
      .input('Modulo', sql.VarChar(100), modulo)
      .input('Accion', sql.VarChar(100), accion)
      .input('Detalle', sql.VarChar(sql.MAX), typeof detalle === 'object' ? JSON.stringify(detalle) : String(detalle))
      .input('DireccionIP', sql.VarChar(45), ip || '127.0.0.1')
      .query(`
        INSERT INTO LogsAuditoria (UsuarioID, Modulo, Accion, Detalle, DireccionIP, FechaRegistro)
        VALUES (@UsuarioID, @Modulo, @Accion, @Detalle, @DireccionIP, GETDATE());
      `);
  } catch (err) {
    console.error('[Auditoria Warning] Error al guardar log:', err.message);
  }
};

module.exports = { logAudit };

