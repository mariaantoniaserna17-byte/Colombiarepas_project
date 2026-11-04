const { sql, poolPromise } = require('../config/database');
const { success, error } = require('../utils/responseHandler');
const { logAudit } = require('../middlewares/audit.middleware');

/**
 * Listar comentarios activos
 */
exports.getReviews = async (req, res, next) => {
  try {
    const { productoId } = req.query;
    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    const request = pool.request();
    let query = `
      SELECT 
        c.ComentarioID,
        c.UsuarioID,
        u.Nombre AS AutorNombre,
        c.ProductoID,
        p.Nombre AS ProductoNombre,
        c.Calificacion,
        c.Texto,
        c.FechaCreacion,
        c.FechaActualizacion
      FROM Comentarios c
      INNER JOIN Usuarios u ON c.UsuarioID = u.UsuarioID
      LEFT JOIN Productos p ON c.ProductoID = p.ProductoID
      WHERE c.Activo = 1
    `;

    if (productoId) {
      request.input('ProductoID', sql.Int, parseInt(productoId, 10));
      query += ' AND c.ProductoID = @ProductoID';
    }

    query += ' ORDER BY c.FechaCreacion DESC';

    const result = await request.query(query);
    return success(res, result.recordset, 'Comentarios obtenidos');
  } catch (err) {
    next(err);
  }
};

/**
 * Publicar un nuevo comentario o sugerencia
 */
exports.createReview = async (req, res, next) => {
  try {
    const { productoId, calificacion, texto } = req.body;
    const usuarioId = req.user.id;

    if (!calificacion || !texto || texto.trim().length === 0) {
      return error(res, 'La calificación (1-5) y el texto son obligatorios', 400);
    }

    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    const result = await pool.request()
      .input('UsuarioID', sql.Int, usuarioId)
      .input('ProductoID', sql.Int, productoId || null)
      .input('Calificacion', sql.Int, parseInt(calificacion, 10))
      .input('Texto', sql.VarChar(1000), texto.trim())
      .query(`
        INSERT INTO Comentarios (UsuarioID, ProductoID, Calificacion, Texto, FechaCreacion, Activo)
        OUTPUT INSERTED.ComentarioID, INSERTED.Calificacion, INSERTED.Texto, INSERTED.FechaCreacion
        VALUES (@UsuarioID, @ProductoID, @Calificacion, @Texto, GETDATE(), 1);
      `);

    await logAudit(usuarioId, 'Comentarios', 'Crear', `Comentario creado #${result.recordset[0].ComentarioID}`, req.ip);

    return success(res, result.recordset[0], 'Comentario publicado exitosamente', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Editar opinión publicada (SOLO el autor puede modificarla)
 */
exports.updateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { calificacion, texto } = req.body;
    const usuarioId = req.user.id;

    if (!texto || texto.trim().length === 0) {
      return error(res, 'El texto del comentario no puede estar vacío', 400);
    }

    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    // Verificar si el comentario existe y si pertenece al usuario solicitante
    const check = await pool.request()
      .input('ComentarioID', sql.Int, parseInt(id, 10))
      .query('SELECT ComentarioID, UsuarioID FROM Comentarios WHERE ComentarioID = @ComentarioID AND Activo = 1');

    if (check.recordset.length === 0) {
      return error(res, 'Comentario no encontrado', 404);
    }

    if (check.recordset[0].UsuarioID !== usuarioId) {
      return error(res, 'Acceso denegado. Solo el autor original puede editar este comentario', 403);
    }

    await pool.request()
      .input('ComentarioID', sql.Int, parseInt(id, 10))
      .input('Calificacion', sql.Int, calificacion ? parseInt(calificacion, 10) : 5)
      .input('Texto', sql.VarChar(1000), texto.trim())
      .query(`
        UPDATE Comentarios
        SET Texto = @Texto,
            Calificacion = @Calificacion,
            FechaActualizacion = GETDATE()
        WHERE ComentarioID = @ComentarioID;
      `);

    await logAudit(usuarioId, 'Comentarios', 'Editar', `Comentario #${id} editado por su autor`, req.ip);

    return success(res, { comentarioId: id }, 'Comentario actualizado exitosamente');
  } catch (err) {
    next(err);
  }
};

/**
 * Eliminar opinión publicada (SOLO el autor o el Administrador puede eliminarla)
 */
exports.deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const esAdmin = req.user.rol === 'Administrador';

    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    const check = await pool.request()
      .input('ComentarioID', sql.Int, parseInt(id, 10))
      .query('SELECT ComentarioID, UsuarioID FROM Comentarios WHERE ComentarioID = @ComentarioID AND Activo = 1');

    if (check.recordset.length === 0) {
      return error(res, 'Comentario no encontrado', 404);
    }

    if (!esAdmin && check.recordset[0].UsuarioID !== usuarioId) {
      return error(res, 'Acceso denegado. Solo el autor del comentario o un Administrador puede eliminarlo', 403);
    }

    // Soft delete
    await pool.request()
      .input('ComentarioID', sql.Int, parseInt(id, 10))
      .query('UPDATE Comentarios SET Activo = 0 WHERE ComentarioID = @ComentarioID');

    await logAudit(usuarioId, 'Comentarios', 'Eliminar', `Comentario #${id} eliminado`, req.ip);

    return success(res, { comentarioId: id }, 'Comentario eliminado exitosamente');
  } catch (err) {
    next(err);
  }
};

