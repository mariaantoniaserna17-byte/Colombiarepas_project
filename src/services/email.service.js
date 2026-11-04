const { getTransporter } = require('../config/mailer');

/**
 * Envía la factura por correo electrónico al cliente
 */
const sendInvoiceEmail = async (destinatario, nombreCliente, numeroFactura, pdfBuffer) => {
  try {
    const transporter = await getTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Arepas Gourmet Express" <pedidos@arepasgourmet.com>',
      to: destinatario,
      subject: `Factura de tu pedido #${numeroFactura} - Arepas Gourmet Express`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #e65100; text-align: center;">¡Gracias por tu compra, ${nombreCliente}!</h2>
          <p>Tu pago ha sido confirmado con éxito y estamos preparando tus deliciosas arepas.</p>
          <div style="background-color: #fff3e0; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Número de Factura:</strong> ${numeroFactura}</p>
            <p style="margin: 5px 0 0 0;"><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CO')}</p>
          </div>
          <p>Adjunto a este correo encontrarás la factura electrónica detallada en formato PDF.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center;">Arepas Gourmet Express © ${new Date().getFullYear()} - Todos los derechos reservados.</p>
        </div>
      `,
      attachments: [
        {
          filename: `Factura_${numeroFactura}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Correo enviado a ${destinatario}. ID: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('[Email Error] Error al enviar correo:', err.message);
    return null;
  }
};

module.exports = { sendInvoiceEmail };

