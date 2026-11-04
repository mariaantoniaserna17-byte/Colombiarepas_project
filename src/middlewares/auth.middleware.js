const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../config/database');
const { error } = require('../utils/responseHandler');

/**
 * Middleware para validar token JWT y cargar usuario y rol desde SQL Server
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Acceso no autorizado. Token no proporcionado', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_arepas_2026_xYz987!');

    const pool = await poolPromise;
    if (!pool) {
      return error(res, 'Error de conexión con la base de datos', 503);
    }

    const result = await pool.request()
      .input('UsuarioID', sql.Int, decoded.id)
      .query(`
        SELECT u.UsuarioID, u.Nombre, u.Email, u.RolID, r.Nombre AS RolNombre, u.Activo
        FROM Usuarios u
        INNER JOIN Roles r ON u.RolID = r.RolID
        WHERE u.UsuarioID = @UsuarioID
      `);

    if (result.recordset.length === 0 || !result.recordset[0].Activo) {
      return error(res, 'Usuario inválido o inactivo', 403);
    }

    // Adjuntar usuario autenticado a la solicitud
    req.user = {
      id: result.recordset[0].UsuarioID,
      nombre: result.recordset[0].Nombre,
      email: result.recordset[0].Email,
      rolId: result.recordset[0].RolID,
      rol: result.recordset[0].RolNombre
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'La sesión ha expirado. Inicia sesión nuevamente', 401);
    }
    return error(res, 'Token inválido', 401);
  }
};

module.exports = { verifyToken };

