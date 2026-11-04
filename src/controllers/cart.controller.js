const { sql, poolPromise } = require('../config/database');
const { success, error } = require('../utils/responseHandler');

/**
 * Valida los ítems del carrito, calculando precios en vivo con toppings y stock
 */
exports.validateCart = async (req, res, next) => {
  try {
    const { items } = req.body; 
    // Estructura esperada de items:
    // [{ productoId: 1, cantidad: 2, toppingIds: [1, 3] }]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, 'El carrito está vacío o el formato es incorrecto', 400);
    }

    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    let subtotalGeneral = 0;
    const validatedItems = [];
    let hayItemsSinStock = false;

    for (const item of items) {
      const cantidad = parseInt(item.cantidad, 10) || 1;
      if (cantidad <= 0) continue;

      // 1. Consultar información actualizada del Producto
      const prodResult = await pool.request()
        .input('ProductoID', sql.Int, item.productoId)
        .query(`
          SELECT ProductoID, Nombre, PrecioBase, PrecioPaquete, StockActual, Activo, PermiteToppings, ImagenURL
          FROM Productos
          WHERE ProductoID = @ProductoID
        `);

      if (prodResult.recordset.length === 0 || !prodResult.recordset[0].Activo) {
        return error(res, `El producto con ID ${item.productoId} ya no se encuentra disponible`, 404);
      }

      const prod = prodResult.recordset[0];
      const presentacion = item.presentacion === 'paquete' ? 'paquete' : 'individual';
      const unidadesPorPresentacion = presentacion === 'paquete' ? 5 : 1;
      const stockProductoInsuficiente = prod.StockActual < cantidad * unidadesPorPresentacion;
      if (stockProductoInsuficiente) {
        hayItemsSinStock = true;
      }

      // 2. Consultar y sumar Toppings seleccionados
      let adicionalesToppings = 0;
      const toppingsDetalle = [];

      if (prod.PermiteToppings && item.toppingIds && Array.isArray(item.toppingIds) && item.toppingIds.length > 0) {
        for (const tId of item.toppingIds) {
          const topResult = await pool.request()
            .input('ToppingID', sql.Int, tId)
            .query(`
              SELECT ToppingID, Nombre, PrecioAdicional, StockActual, Activo
              FROM Toppings
              WHERE ToppingID = @ToppingID AND Activo = 1
            `);

          if (topResult.recordset.length > 0) {
            const topping = topResult.recordset[0];
            const stockToppingInsuficiente = topping.StockActual < cantidad * unidadesPorPresentacion;
            if (stockToppingInsuficiente) {
              hayItemsSinStock = true;
            }

            adicionalesToppings += parseFloat(topping.PrecioAdicional);
            toppingsDetalle.push({
              toppingId: topping.ToppingID,
              nombre: topping.Nombre,
              precioAdicional: parseFloat(topping.PrecioAdicional),
              agotado: stockToppingInsuficiente
            });
          }
        }
      }

      const precioBase = presentacion === 'paquete' ? parseFloat(prod.PrecioPaquete) : parseFloat(prod.PrecioBase);
      const precioUnitarioTotal = precioBase + adicionalesToppings;
      const subtotalLinea = precioUnitarioTotal * cantidad;
      subtotalGeneral += subtotalLinea;

      validatedItems.push({
        productoId: prod.ProductoID,
        nombre: prod.Nombre,
        imagenURL: prod.ImagenURL,
        cantidad,
        presentacion,
        precioBase,
        toppings: toppingsDetalle,
        precioUnitarioTotal,
        subtotalLinea,
        stockDisponible: prod.StockActual,
        agotado: stockProductoInsuficiente
      });
    }

    const ivaPorcentaje = parseFloat(process.env.IVA_PORCENTAJE) || 0.19;
    const costoEnvio = parseFloat(process.env.COSTO_ENVIO) || 5000.00;
    const impuestoIVA = subtotalGeneral * ivaPorcentaje;
    const total = subtotalGeneral + impuestoIVA + costoEnvio;

    return success(res, {
      items: validatedItems,
      resumen: {
        subtotal: subtotalGeneral,
        ivaPorcentaje: `${(ivaPorcentaje * 100).toFixed(0)}%`,
        impuestoIVA,
        costoEnvio,
        total
      },
      hayItemsSinStock,
      mensajeStock: hayItemsSinStock 
        ? 'Algunos productos o ingredientes no tienen existencias suficientes para completar la orden.' 
        : 'Todos los productos cuentan con inventario disponible.'
    }, 'Carrito procesado');
  } catch (err) {
    next(err);
  }
};
