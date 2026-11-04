const ExcelJS = require('exceljs');
const { sql, poolPromise } = require('../config/database');
const { success, error } = require('../utils/responseHandler');
const { generateReportPDF } = require('../services/pdf.service');
const { logAudit } = require('../middlewares/audit.middleware');

/**
 * Generador y exportador de reportes administrativos (Inventario, Pedidos, Ventas, Auditoría)
 */
exports.getReport = async (req, res, next) => {
  try {
    const { tipo, formato = 'json', fechaInicio, fechaFin } = req.query;

    const tiposValidos = ['inventario', 'pedidos', 'ventas', 'auditoria'];
    if (!tipo || !tiposValidos.includes(tipo.toLowerCase())) {
      return error(res, `Tipo de reporte inválido. Debe ser uno de: [${tiposValidos.join(', ')}]`, 400);
    }

    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    let query = '';
    let reportTitle = '';
    let headers = [];
    const request = pool.request();

    // 1. REPORTE DE INVENTARIO
    if (tipo.toLowerCase() === 'inventario') {
      reportTitle = 'Reporte de Inventario de Productos y Toppings';
      headers = ['ID', 'Nombre', 'Tipo', 'Precio', 'StockActual', 'EstadoStock'];
      query = `
        SELECT 
          p.ProductoID AS ID, 
          p.Nombre, 
          'Producto' AS Tipo, 
          p.PrecioBase AS Precio, 
          p.StockActual,
          CASE WHEN p.StockActual <= 0 THEN 'AGOTADO' ELSE 'DISPONIBLE' END AS EstadoStock
        FROM Productos p
        WHERE p.Activo = 1
        UNION ALL
        SELECT 
          t.ToppingID AS ID, 
          t.Nombre, 
          'Topping/Adicional' AS Tipo, 
          t.PrecioAdicional AS Precio, 
          t.StockActual,
          CASE WHEN t.StockActual <= 0 THEN 'AGOTADO' ELSE 'DISPONIBLE' END AS EstadoStock
        FROM Toppings t
        WHERE t.Activo = 1
        ORDER BY Tipo, StockActual ASC;
      `;
    } 
    // 2. REPORTE DE PEDIDOS
    else if (tipo.toLowerCase() === 'pedidos') {
      reportTitle = 'Reporte de Pedidos';
      headers = ['PedidoID', 'Fecha', 'Cliente', 'Estado', 'Subtotal', 'IVA', 'Total'];
      query = `
        SELECT 
          p.PedidoID,
          CONVERT(VARCHAR(19), p.FechaPedido, 120) AS Fecha,
          u.Nombre AS Cliente,
          ep.Nombre AS Estado,
          p.Subtotal,
          p.ImpuestoIVA AS IVA,
          p.Total
        FROM Pedidos p
        INNER JOIN Usuarios u ON p.UsuarioID = u.UsuarioID
        INNER JOIN EstadosPedido ep ON p.EstadoID = ep.EstadoID
        WHERE 1=1
      `;
      if (fechaInicio) {
        request.input('FInicio', sql.VarChar, fechaInicio);
        query += ' AND p.FechaPedido >= @FInicio';
      }
      if (fechaFin) {
        request.input('FFin', sql.VarChar, `${fechaFin} 23:59:59`);
        query += ' AND p.FechaPedido <= @FFin';
      }
      query += ' ORDER BY p.FechaPedido DESC;';
    } 
    // 3. REPORTE DE VENTAS
    else if (tipo.toLowerCase() === 'ventas') {
      reportTitle = 'Reporte Consolidado de Ventas Facturadas';
      headers = ['Factura', 'FechaEmision', 'PedidoID', 'Subtotal', 'IVA', 'Envio', 'TotalFacturado'];
      query = `
        SELECT 
          f.NumeroFactura AS Factura,
          CONVERT(VARCHAR(19), f.FechaEmision, 120) AS FechaEmision,
          f.PedidoID,
          f.MontoSubtotal AS Subtotal,
          f.MontoIVA AS IVA,
          f.MontoEnvio AS Envio,
          f.MontoTotal AS TotalFacturado
        FROM Facturas f
        INNER JOIN Pedidos p ON f.PedidoID = p.PedidoID
        WHERE p.EstadoID = 2
      `;
      if (fechaInicio) {
        request.input('FInicio', sql.VarChar, fechaInicio);
        query += ' AND f.FechaEmision >= @FInicio';
      }
      if (fechaFin) {
        request.input('FFin', sql.VarChar, `${fechaFin} 23:59:59`);
        query += ' AND f.FechaEmision <= @FFin';
      }
      query += ' ORDER BY f.FechaEmision DESC;';
    } 
    // 4. REPORTE DE AUDITORÍA
    else if (tipo.toLowerCase() === 'auditoria') {
      reportTitle = 'Registro de Auditoría de Sistema';
      headers = ['LogID', 'Fecha', 'Usuario', 'Modulo', 'Accion', 'DireccionIP', 'Detalle'];
      query = `
        SELECT TOP 200
          l.LogID,
          CONVERT(VARCHAR(19), l.FechaRegistro, 120) AS Fecha,
          ISNULL(u.Email, 'Sistema / Anónimo') AS Usuario,
          l.Modulo,
          l.Accion,
          l.DireccionIP,
          l.Detalle
        FROM LogsAuditoria l
        LEFT JOIN Usuarios u ON l.UsuarioID = u.UsuarioID
        ORDER BY l.FechaRegistro DESC;
      `;
    }

    const result = await request.query(query);
    const rows = result.recordset;

    await logAudit(req.user.id, 'Reportes', 'GenerarReporte', `Reporte generado: ${tipo} (${formato})`, req.ip);

    // EXPORTACIÓN A EXCEL
    if (formato.toLowerCase() === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(tipo.toUpperCase());

      worksheet.columns = headers.map(h => ({
        header: h,
        key: h,
        width: 20
      }));

      // Estilo a la cabecera
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE65100' }
      };

      rows.forEach(r => worksheet.addRow(r));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Reporte_${tipo}_${Date.now()}.xlsx`);

      return await workbook.xlsx.write(res).then(() => res.end());
    }

    // EXPORTACIÓN A PDF
    if (formato.toLowerCase() === 'pdf') {
      const pdfBuffer = await generateReportPDF(reportTitle, headers, rows);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Reporte_${tipo}_${Date.now()}.pdf`);
      return res.send(pdfBuffer);
    }

    // RETORNO POR DEFECTO JSON
    return success(res, {
      reporte: tipo,
      totalRegistros: rows.length,
      registros: rows
    }, `Reporte de ${tipo} generado exitosamente`);
  } catch (err) {
    next(err);
  }
};

