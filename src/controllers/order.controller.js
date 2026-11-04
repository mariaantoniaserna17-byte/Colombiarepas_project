const { sql, poolPromise } = require('../config/database');
const { success, error } = require('../utils/responseHandler');
const { logAudit } = require('../middlewares/audit.middleware');
const { generateInvoicePDF } = require('../services/pdf.service');
const { sendInvoiceEmail } = require('../services/email.service');

/**
 * Confirmación inicial del pedido y reserva bajo transacción SQL Server
 */
exports.createOrder = async (req, res, next) => {
  const pool = await poolPromise;
  if (!pool) return error(res, 'Base de datos no disponible', 503);

  const transaction = new sql.Transaction(pool);

  try {
    const { items, direccionEntrega, metodoPago } = req.body;
    const usuarioId = req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, 'No se proporcionaron ítems para el pedido', 400);
    }

    if (!direccionEntrega) {
      return error(res, 'La dirección de entrega es obligatoria', 400);
    }

    await transaction.begin();

    let subtotalCalculado = 0;
    const itemsDetallados = [];

    // 1. Verificación estricta de inventario con UPDLOCK para evitar condiciones de carrera (Race Conditions)
    for (const item of items) {
      const cantidad = parseInt(item.cantidad, 10);
      if (cantidad <= 0) continue;

      const prodReq = new sql.Request(transaction);
      const prodRes = await prodReq
        .input('ProdID', sql.Int, item.productoId)
        .query('SELECT ProductoID, Nombre, PrecioBase, PrecioPaquete, StockActual, Activo FROM Productos WITH (UPDLOCK) WHERE ProductoID = @ProdID');

      if (prodRes.recordset.length === 0 || !prodRes.recordset[0].Activo) {
        throw new Error(`El producto #${item.productoId} no existe o no está activo.`);
      }

      const prod = prodRes.recordset[0];
      const presentacion = item.presentacion === 'paquete' ? 'paquete' : 'individual';
      const unidadesPorPresentacion = presentacion === 'paquete' ? 5 : 1;
      if (prod.StockActual < cantidad * unidadesPorPresentacion) {
        throw new Error(`Stock insuficiente para "${prod.Nombre}". Disponibles: ${prod.StockActual}, Solicitados: ${cantidad}`);
      }

      // Validar toppings
      let adicionalesTopping = 0;
      const toppingsEncontrados = [];

      if (item.toppingIds && Array.isArray(item.toppingIds)) {
        for (const tId of item.toppingIds) {
          const topReq = new sql.Request(transaction);
          const topRes = await topReq
            .input('TID', sql.Int, tId)
            .query('SELECT ToppingID, Nombre, PrecioAdicional, StockActual FROM Toppings WITH (UPDLOCK) WHERE ToppingID = @TID AND Activo = 1');

          if (topRes.recordset.length > 0) {
            const top = topRes.recordset[0];
            if (top.StockActual < cantidad * unidadesPorPresentacion) {
              throw new Error(`Ingrediente adicional "${top.Nombre}" sin stock suficiente.`);
            }
            adicionalesTopping += parseFloat(top.PrecioAdicional);
            toppingsEncontrados.push(top);
          }
        }
      }

      const precioBase = presentacion === 'paquete' ? parseFloat(prod.PrecioPaquete) : parseFloat(prod.PrecioBase);
      const precioUnitarioTotal = precioBase + adicionalesTopping;
      const subtotalLinea = precioUnitarioTotal * cantidad;
      subtotalCalculado += subtotalLinea;

      itemsDetallados.push({
        productoId: prod.ProductoID,
        nombre: prod.Nombre,
        cantidad,
        presentacion,
        precioUnitario: precioUnitarioTotal,
        subtotalLinea,
        toppings: toppingsEncontrados
      });
    }

    const ivaPorcentaje = parseFloat(process.env.IVA_PORCENTAJE) || 0.19;
    const costoEnvio = parseFloat(process.env.COSTO_ENVIO) || 5000.00;
    const impuestoIVA = subtotalCalculado * ivaPorcentaje;
    const total = subtotalCalculado + impuestoIVA + costoEnvio;

    // 2. Insertar Encabezado de Pedido (Estado 1: 'Pendiente')
    const orderReq = new sql.Request(transaction);
    const orderRes = await orderReq
      .input('UsuarioID', sql.Int, usuarioId)
      .input('EstadoID', sql.Int, 1) // Pendiente
      .input('Subtotal', sql.Decimal(10, 2), subtotalCalculado)
      .input('ImpuestoIVA', sql.Decimal(10, 2), impuestoIVA)
      .input('CostoEnvio', sql.Decimal(10, 2), costoEnvio)
      .input('Total', sql.Decimal(10, 2), total)
      .input('DireccionEntrega', sql.VarChar(255), direccionEntrega)
      .input('MetodoPago', sql.VarChar(50), metodoPago || 'Tarjeta')
      .query(`
        INSERT INTO Pedidos (UsuarioID, EstadoID, Subtotal, ImpuestoIVA, CostoEnvio, Total, DireccionEntrega, MetodoPago)
        OUTPUT INSERTED.PedidoID
        VALUES (@UsuarioID, @EstadoID, @Subtotal, @ImpuestoIVA, @CostoEnvio, @Total, @DireccionEntrega, @MetodoPago);
      `);

    const pedidoId = orderRes.recordset[0].PedidoID;

    // 3. Insertar Detalles del Pedido y personalizaciones de Toppings
    for (const item of itemsDetallados) {
      const itemReq = new sql.Request(transaction);
      const itemRes = await itemReq
        .input('PedidoID', sql.Int, pedidoId)
        .input('ProductoID', sql.Int, item.productoId)
        .input('Cantidad', sql.Int, item.cantidad)
        .input('PrecioUnitario', sql.Decimal(10, 2), item.precioUnitario)
        .input('SubtotalLinea', sql.Decimal(10, 2), item.subtotalLinea)
        .query(`
          INSERT INTO PedidoDetalles (PedidoID, ProductoID, Cantidad, PrecioUnitario, SubtotalLinea)
          OUTPUT INSERTED.DetalleID
          VALUES (@PedidoID, @ProductoID, @Cantidad, @PrecioUnitario, @SubtotalLinea);
        `);

      const detalleId = itemRes.recordset[0].DetalleID;

      for (const top of item.toppings) {
        const topReq = new sql.Request(transaction);
        await topReq
          .input('DetalleID', sql.Int, detalleId)
          .input('ToppingID', sql.Int, top.ToppingID)
          .input('PrecioAdicional', sql.Decimal(10, 2), top.PrecioAdicional)
          .query(`
            INSERT INTO PedidoDetalleToppings (DetalleID, ToppingID, PrecioAdicional)
            VALUES (@DetalleID, @ToppingID, @PrecioAdicional);
          `);
      }
    }

    await transaction.commit();

    await logAudit(usuarioId, 'Pedidos', 'CrearPedido', `Pedido #${pedidoId} registrado por total de $${total}`, req.ip);

    return success(res, {
      pedidoId,
      subtotal: subtotalCalculado,
      iva: impuestoIVA,
      costoEnvio,
      total,
      estado: 'Pendiente',
      instruccionesPago: 'Procede al endpoint de pago para completar la orden.'
    }, 'Pedido creado y registrado exitosamente', 201);
  } catch (err) {
    if (transaction) await transaction.rollback();
    return error(res, err.message, 400);
  }
};

/**
 * Procesamiento de pago / Pasarela de Pagos
 * Maneja estados: Aprobado (descuenta stock, crea factura, envía email) o Rechazado (permite reintentar)
 */
exports.processPayment = async (req, res, next) => {
  const pool = await poolPromise;
  if (!pool) return error(res, 'Base de datos no disponible', 503);

  const { pedidoId, metodoPago, datosTarjeta, simularRechazo } = req.body;
  const usuarioId = req.user.id;

  if (!pedidoId) {
    return error(res, 'El ID del pedido es obligatorio', 400);
  }

  // Verificar que el pedido existe y le pertenece al usuario o es admin
  const orderCheck = await pool.request()
    .input('PedidoID', sql.Int, pedidoId)
    .input('UsuarioID', sql.Int, usuarioId)
    .query(`
      SELECT p.PedidoID, p.EstadoID, p.Subtotal, p.ImpuestoIVA, p.CostoEnvio, p.Total, p.DireccionEntrega,
             u.Nombre AS ClienteNombre, u.Email AS ClienteEmail, u.Telefono AS ClienteTelefono
      FROM Pedidos p
      INNER JOIN Usuarios u ON p.UsuarioID = u.UsuarioID
      WHERE p.PedidoID = @PedidoID AND (p.UsuarioID = @UsuarioID OR @UsuarioID = 1)
    `);

  if (orderCheck.recordset.length === 0) {
    return error(res, 'Pedido no encontrado o sin autorización', 404);
  }

  const pedido = orderCheck.recordset[0];

  if (pedido.EstadoID === 2) {
    return error(res, 'Este pedido ya se encuentra PAGADO', 400);
  }

  // SIMULACIÓN DE PASARELA DE PAGOS
  // Si se envía simularRechazo: true, se simula fallo de fondos / tarjeta
  const pagoExitoso = !simularRechazo;

  if (!pagoExitoso) {
    // Transacción para registrar pago Rechazado
    await pool.request()
      .input('PedidoID', sql.Int, pedidoId)
      .input('EstadoID', sql.Int, 3) // Rechazado
      .input('MetodoPago', sql.VarChar(50), metodoPago || 'Tarjeta')
      .input('Monto', sql.Decimal(10, 2), pedido.Total)
      .query(`
        UPDATE Pedidos SET EstadoID = @EstadoID WHERE PedidoID = @PedidoID;

        INSERT INTO Pagos (PedidoID, TransaccionPasarelaID, MetodoPago, Monto, EstadoPago, RespuestaPasarela)
        VALUES (@PedidoID, CONCAT('REJ-', NEWID()), @MetodoPago, @Monto, 'Rechazado', 'Fondos insuficientes o transacción declinada por la entidad financiera.');
      `);

    await logAudit(usuarioId, 'Pagos', 'PagoRechazado', `Intento de pago rechazado para pedido #${pedidoId}`, req.ip);

    return error(res, 'El pago fue RECHAZADO por la pasarela de pagos. Puedes reintentar con otro medio de pago o verificar tus fondos.', 402, {
      pedidoId,
      estado: 'Rechazado',
      permiteReintento: true
    });
  }

  // SI EL PAGO ES APROBADO: Iniciar transacción para descontar inventario y registrar factura
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Actualizar estado a 'Pagado' (EstadoID = 2)
    const updateOrderReq = new sql.Request(transaction);
    await updateOrderReq
      .input('PedidoID', sql.Int, pedidoId)
      .query('UPDATE Pedidos SET EstadoID = 2 WHERE PedidoID = @PedidoID');

    // 2. Registrar en la tabla Pagos
    const transaccionId = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const payReq = new sql.Request(transaction);
    await payReq
      .input('PedidoID', sql.Int, pedidoId)
      .input('TransaccionID', sql.VarChar(100), transaccionId)
      .input('MetodoPago', sql.VarChar(50), metodoPago || 'Tarjeta')
      .input('Monto', sql.Decimal(10, 2), pedido.Total)
      .query(`
        INSERT INTO Pagos (PedidoID, TransaccionPasarelaID, MetodoPago, Monto, EstadoPago, RespuestaPasarela)
        VALUES (@PedidoID, @TransaccionID, @MetodoPago, @Monto, 'Aprobado', 'Transacción aprobada satisfactoriamente.');
      `);

    // 3. Descontar Inventario de Productos
    const stockProdReq = new sql.Request(transaction);
    await stockProdReq
      .input('PedidoID', sql.Int, pedidoId)
      .query(`
        UPDATE p
        SET p.StockActual = p.StockActual - pd.Cantidad
        FROM Productos p
        INNER JOIN PedidoDetalles pd ON p.ProductoID = pd.ProductoID
        WHERE pd.PedidoID = @PedidoID;
      `);

    // 4. Descontar Inventario de Toppings
    const stockTopReq = new sql.Request(transaction);
    await stockTopReq
      .input('PedidoID', sql.Int, pedidoId)
      .query(`
        UPDATE t
        SET t.StockActual = t.StockActual - pd.Cantidad
        FROM Toppings t
        INNER JOIN PedidoDetalleToppings pdt ON t.ToppingID = pdt.ToppingID
        INNER JOIN PedidoDetalles pd ON pdt.DetalleID = pd.DetalleID
        WHERE pd.PedidoID = @PedidoID;
      `);

    // 5. Registrar Factura
    const numeroFactura = `FAC-${new Date().getFullYear()}-${String(pedidoId).padStart(6, '0')}`;
    const invoiceReq = new sql.Request(transaction);
    await invoiceReq
      .input('PedidoID', sql.Int, pedidoId)
      .input('NumeroFactura', sql.VarChar(50), numeroFactura)
      .input('Subtotal', sql.Decimal(10, 2), pedido.Subtotal)
      .input('IVA', sql.Decimal(10, 2), pedido.ImpuestoIVA)
      .input('Envio', sql.Decimal(10, 2), pedido.CostoEnvio)
      .input('Total', sql.Decimal(10, 2), pedido.Total)
      .query(`
        INSERT INTO Facturas (PedidoID, NumeroFactura, MontoSubtotal, MontoIVA, MontoEnvio, MontoTotal)
        VALUES (@PedidoID, @NumeroFactura, @Subtotal, @IVA, @Envio, @Total);
      `);

    await transaction.commit();

    // 6. Obtener ítems completos para el PDF
    const itemsResult = await pool.request()
      .input('PedidoID', sql.Int, pedidoId)
      .query(`
        SELECT pd.DetalleID, pd.ProductoID, p.Nombre, pd.Cantidad, pd.PrecioUnitario, pd.SubtotalLinea
        FROM PedidoDetalles pd
        INNER JOIN Productos p ON pd.ProductoID = p.ProductoID
        WHERE pd.PedidoID = @PedidoID
      `);

    const itemsParaPDF = [];
    for (const it of itemsResult.recordset) {
      const topRes = await pool.request()
        .input('DetalleID', sql.Int, it.DetalleID)
        .query(`
          SELECT t.Nombre, pdt.PrecioAdicional
          FROM PedidoDetalleToppings pdt
          INNER JOIN Toppings t ON pdt.ToppingID = t.ToppingID
          WHERE pdt.DetalleID = @DetalleID
        `);
      itemsParaPDF.push({
        ...it,
        toppings: topRes.recordset
      });
    }

    // 7. Generar Factura en PDF y Enviar por Correo Electrónico
    const invoicePayload = {
      numeroFactura,
      clienteNombre: pedido.ClienteNombre,
      clienteEmail: pedido.ClienteEmail,
      clienteTelefono: pedido.ClienteTelefono,
      direccionEntrega: pedido.DireccionEntrega,
      metodoPago: metodoPago || 'Tarjeta',
      subtotal: pedido.Subtotal,
      impuestoIVA: pedido.ImpuestoIVA,
      costoEnvio: pedido.CostoEnvio,
      total: pedido.Total,
      items: itemsParaPDF
    };

    const pdfBuffer = await generateInvoicePDF(invoicePayload);

    // Envío asíncrono del correo con el adjunto
    sendInvoiceEmail(pedido.ClienteEmail, pedido.ClienteNombre, numeroFactura, pdfBuffer)
      .catch(mailErr => console.error('[Order Error] Fallo al enviar email:', mailErr));

    await logAudit(usuarioId, 'Pagos', 'PagoAprobado', `Pago aprobado para pedido #${pedidoId}. Factura: ${numeroFactura}`, req.ip);

    return success(res, {
      pedidoId,
      estado: 'Pagado',
      numeroFactura,
      transaccionId,
      total: pedido.Total,
      notificacion: 'Factura generada y enviada al correo del cliente.'
    }, 'Pago aprobado y pedido procesado con éxito');
  } catch (err) {
    if (transaction) await transaction.rollback();
    next(err);
  }
};

/**
 * Historial de pedidos del usuario autenticado
 */
exports.getMyOrders = async (req, res, next) => {
  try {
    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    const result = await pool.request()
      .input('UsuarioID', sql.Int, req.user.id)
      .query(`
        SELECT p.PedidoID, p.FechaPedido, ep.Nombre AS Estado, p.Subtotal, p.ImpuestoIVA, p.CostoEnvio, p.Total,
               f.NumeroFactura
        FROM Pedidos p
        INNER JOIN EstadosPedido ep ON p.EstadoID = ep.EstadoID
        LEFT JOIN Facturas f ON p.PedidoID = f.PedidoID
        WHERE p.UsuarioID = @UsuarioID
        ORDER BY p.FechaPedido DESC
      `);

    return success(res, result.recordset, 'Historial de pedidos obtenido');
  } catch (err) {
    next(err);
  }
};

/**
 * Descargar PDF de factura de un pedido
 */
exports.downloadInvoicePDF = async (req, res, next) => {
  try {
    const { pedidoId } = req.params;
    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    const orderCheck = await pool.request()
      .input('PedidoID', sql.Int, parseInt(pedidoId, 10))
      .query(`
        SELECT p.PedidoID, p.Subtotal, p.ImpuestoIVA, p.CostoEnvio, p.Total, p.DireccionEntrega, p.MetodoPago,
               u.UsuarioID, u.Nombre AS ClienteNombre, u.Email AS ClienteEmail, u.Telefono AS ClienteTelefono,
               f.NumeroFactura
        FROM Pedidos p
        INNER JOIN Usuarios u ON p.UsuarioID = u.UsuarioID
        INNER JOIN Facturas f ON p.PedidoID = f.PedidoID
        WHERE p.PedidoID = @PedidoID
      `);

    if (orderCheck.recordset.length === 0) {
      return error(res, 'Factura no encontrada para este pedido', 404);
    }

    const pedido = orderCheck.recordset[0];

    // Verificar que el usuario sea el dueño o admin
    if (req.user.rol !== 'Administrador' && req.user.id !== pedido.UsuarioID) {
      return error(res, 'No tienes permisos para ver esta factura', 403);
    }

    const itemsResult = await pool.request()
      .input('PedidoID', sql.Int, pedidoId)
      .query(`
        SELECT pd.DetalleID, p.Nombre, pd.Cantidad, pd.PrecioUnitario, pd.SubtotalLinea
        FROM PedidoDetalles pd
        INNER JOIN Productos p ON pd.ProductoID = p.ProductoID
        WHERE pd.PedidoID = @PedidoID
      `);

    const items = [];
    for (const it of itemsResult.recordset) {
      const topRes = await pool.request()
        .input('DetalleID', sql.Int, it.DetalleID)
        .query(`
          SELECT t.Nombre, pdt.PrecioAdicional
          FROM PedidoDetalleToppings pdt
          INNER JOIN Toppings t ON pdt.ToppingID = t.ToppingID
          WHERE pdt.DetalleID = @DetalleID
        `);
      items.push({ ...it, toppings: topRes.recordset });
    }

    const pdfBuffer = await generateInvoicePDF({
      numeroFactura: pedido.NumeroFactura,
      clienteNombre: pedido.ClienteNombre,
      clienteEmail: pedido.ClienteEmail,
      clienteTelefono: pedido.ClienteTelefono,
      direccionEntrega: pedido.DireccionEntrega,
      metodoPago: pedido.MetodoPago,
      subtotal: pedido.Subtotal,
      impuestoIVA: pedido.ImpuestoIVA,
      costoEnvio: pedido.CostoEnvio,
      total: pedido.Total,
      items
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Factura_${pedido.NumeroFactura}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};
