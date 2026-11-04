/**
 * Utilidades para estandarizar las respuestas JSON de la API
 */

const success = (res, data = null, message = 'Operación exitosa', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const error = (res, message = 'Error en el servidor', statusCode = 500, details = null) => {
  const payload = {
    success: false,
    message
  };
  if (details) payload.details = details;
  return res.status(statusCode).json(payload);
};

module.exports = { success, error };

