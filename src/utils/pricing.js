const calculateCartTotals = (subtotal, environment = {}) => {
  const ivaPorcentaje = parseFloat(environment.IVA_PORCENTAJE) || 0.19;
  const costoEnvio = parseFloat(environment.COSTO_ENVIO) || 5000;
  const netSubtotal = Number(subtotal) || 0;
  const impuestoIVA = netSubtotal * ivaPorcentaje;

  return {
    ivaPorcentaje,
    impuestoIVA,
    costoEnvio,
    total: netSubtotal + impuestoIVA + costoEnvio
  };
};

const calculateItemTotal = (precioBase, adicionalesToppings = 0, cantidad = 1) => {
  const safeBase = Number(precioBase) || 0;
  const safeAdicionales = Number(adicionalesToppings) || 0;
  const safeCantidad = Number(cantidad) || 0;
  if (safeCantidad < 0) return 0;
  return (safeBase + safeAdicionales) * safeCantidad;
};

module.exports = { calculateCartTotals, calculateItemTotal };
