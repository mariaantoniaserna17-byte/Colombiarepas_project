const { error } = require('../utils/responseHandler');

/**
 * Middleware central de manejo de errores
 */
const errorHandler = (err, req, res, next) => {
  console.error('[Error Tracker]:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Ocurrió un error inesperado en el servidor';

  return error(res, message, statusCode, process.env.NODE_ENV === 'development' ? err.stack : null);
};

module.exports = { errorHandler };

