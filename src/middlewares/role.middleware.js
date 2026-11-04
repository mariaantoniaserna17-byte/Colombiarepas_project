const { error } = require('../utils/responseHandler');

/**
 * Middleware para validar que el usuario posea uno de los roles autorizados
 * @param {Array<string>} rolesPermitidos - Ej: ['Administrador']
 */
const checkRole = (rolesPermitidos = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Usuario no autenticado', 401);
    }

    if (!rolesPermitidos.includes(req.user.rol)) {
      return error(
        res,
        `Acceso denegado. Se requiere uno de los siguientes roles: [${rolesPermitidos.join(', ')}]`,
        403
      );
    }

    next();
  };
};

module.exports = { checkRole };

