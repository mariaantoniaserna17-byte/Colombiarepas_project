const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Genera la factura en PDF para un pedido completado
 * @param {Object} orderData Datos del pedido y usuario
 * @returns {Promise<Buffer>} Buffer del documento PDF generado
 */
const generateInvoicePDF = (orderData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Cabecera
      doc.fillColor('#e65100').fontSize(22).text('AREPAS GOURMET EXPRESS', { align: 'center', bold: true });
      doc.moveDown(0.3);
      doc.fillColor('#444444').fontSize(10).text('E-commerce de Alimentos & Comida Rápida Tradicional', { align: 'center' });
      doc.text('NIT: 900.123.456-7 | Bogotá, Colombia | Tel: (+57) 300 123 4567', { align: 'center' });
      doc.moveDown();

      doc.strokeColor('#cccccc').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown();

      // Información de Factura y Cliente
      const infoY = doc.y;
      doc.fontSize(11).fillColor('#222222');
      doc.text(`Factura N°: ${orderData.numeroFactura}`, 40, infoY, { bold: true });
      doc.text(`Fecha: ${new Date().toLocaleString('es-CO')}`, 40, infoY + 15);
      doc.text(`Estado Pago: APROBADO`, 40, infoY + 30);
      doc.text(`Método: ${orderData.metodoPago || 'Digital'}`, 40, infoY + 45);

      doc.text(`Cliente: ${orderData.clienteNombre}`, 320, infoY);
      doc.text(`Email: ${orderData.clienteEmail}`, 320, infoY + 15);
      doc.text(`Dirección: ${orderData.direccionEntrega}`, 320, infoY + 30);
      doc.text(`Teléfono: ${orderData.clienteTelefono || 'N/A'}`, 320, infoY + 45);

      doc.moveDown(4.5);
      doc.strokeColor('#cccccc').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      // Tabla de ítems
      const tableTop = doc.y;
      doc.fontSize(10).fillColor('#000000');
      doc.text('Descripción del Producto / Toppings', 40, tableTop, { bold: true });
      doc.text('Cant.', 320, tableTop, { bold: true });
      doc.text('Precio Unit.', 380, tableTop, { bold: true });
      doc.text('Subtotal', 480, tableTop, { bold: true, align: 'right' });

      doc.moveDown(0.5);
      doc.strokeColor('#e65100').lineWidth(1.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      orderData.items.forEach(item => {
        const itemY = doc.y;
        doc.fillColor('#222222').fontSize(10).text(item.nombre, 40, itemY);
        doc.text(String(item.cantidad), 320, itemY);
        doc.text(`$${Number(item.precioUnitario).toLocaleString('es-CO')}`, 380, itemY);
        doc.text(`$${Number(item.subtotalLinea).toLocaleString('es-CO')}`, 480, itemY, { align: 'right' });
        doc.moveDown(0.5);

        // Si tiene toppings, listarlos
        if (item.toppings && item.toppings.length > 0) {
          const toppingNames = item.toppings.map(t => `+ ${t.Nombre} ($${Number(t.PrecioAdicional).toLocaleString('es-CO')})`).join(' | ');
          doc.fontSize(8).fillColor('#666666').text(`   Personalización: ${toppingNames}`, 40, doc.y);
          doc.moveDown(0.5);
        }
      });

      doc.moveDown();
      doc.strokeColor('#cccccc').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      // Totales
      const totalsY = doc.y;
      doc.fontSize(10).fillColor('#333333');
      doc.text('Subtotal:', 350, totalsY);
      doc.text(`$${Number(orderData.subtotal).toLocaleString('es-CO')}`, 480, totalsY, { align: 'right' });

      doc.text('IVA (19%):', 350, totalsY + 15);
      doc.text(`$${Number(orderData.impuestoIVA).toLocaleString('es-CO')}`, 480, totalsY + 15, { align: 'right' });

      doc.text('Costo de Envío:', 350, totalsY + 30);
      doc.text(`$${Number(orderData.costoEnvio).toLocaleString('es-CO')}`, 480, totalsY + 30, { align: 'right' });

      doc.fontSize(12).fillColor('#b71c1c');
      doc.text('TOTAL PAGADO:', 350, totalsY + 50, { bold: true });
      doc.text(`$${Number(orderData.total).toLocaleString('es-CO')}`, 480, totalsY + 50, { bold: true, align: 'right' });

      // Pie de página
      doc.moveDown(5);
      doc.fontSize(9).fillColor('#777777').text('¡Gracias por tu compra! Tu pedido está siendo preparado con ingredientes de la mejor calidad.', { align: 'center' });
      doc.text('Para soporte o cambios en tu pedido, contáctanos a soporte@arepasgourmet.com', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Genera un PDF simple para reportes administrativos
 */
const generateReportPDF = (reportTitle, headers, rows) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.fillColor('#e65100').fontSize(18).text(`REPORTE ADMINISTRATIVO: ${reportTitle.toUpperCase()}`, { align: 'center', bold: true });
      doc.fontSize(10).fillColor('#555555').text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
      doc.moveDown();

      doc.strokeColor('#cccccc').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      // Tabla de datos
      const colWidth = Math.floor(515 / headers.length);
      const startY = doc.y;

      // Encabezados
      headers.forEach((h, i) => {
        doc.fontSize(9).fillColor('#000000').text(h, 40 + (i * colWidth), startY, { bold: true, width: colWidth });
      });
      doc.moveDown();
      doc.strokeColor('#e65100').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      // Filas
      rows.forEach(row => {
        const curY = doc.y;
        if (curY > 750) {
          doc.addPage();
        }
        headers.forEach((h, i) => {
          const val = row[h] !== null && row[h] !== undefined ? String(row[h]) : '-';
          doc.fontSize(8).fillColor('#333333').text(val, 40 + (i * colWidth), curY, { width: colWidth });
        });
        doc.moveDown(0.7);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateInvoicePDF, generateReportPDF };

