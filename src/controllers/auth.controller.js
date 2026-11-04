const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../config/database');
const { success, error } = require('../utils/responseHandler');
const { logAudit } = require('../middlewares/audit.middleware');

/**
 * Registro de nuevos usuarios (Clientes)
 */
exports.register = async (req, res, next) => {
  try {
    const { nombre, email, password, telefono, direccion } = req.body;

    if (!nombre || !email || !password) {
      return error(res, 'Nombre, correo electrónico y contraseña son obligatorios', 400);
    }

    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    // Verificar si el email ya existe
    const existCheck = await pool.request()
      .input('Email', sql.VarChar(150), email.trim().toLowerCase())
      .query('SELECT UsuarioID FROM Usuarios WHERE Email = @Email');

    if (existCheck.recordset.length > 0) {
      return error(res, 'El correo electrónico ya está registrado', 400);
    }

    // Hashear contraseña con bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insertar usuario con rol Cliente (RolID = 1)
    const result = await pool.request()
      .input('RolID', sql.Int, 1)
      .input('Nombre', sql.VarChar(100), nombre.trim())
      .input('Email', sql.VarChar(150), email.trim().toLowerCase())
      .input('PasswordHash', sql.VarChar(255), passwordHash)
      .input('Telefono', sql.VarChar(20), telefono || null)
      .input('Direccion', sql.VarChar(255), direccion || null)
      .query(`
        INSERT INTO Usuarios (RolID, Nombre, Email, PasswordHash, Telefono, Direccion, Activo)
        OUTPUT INSERTED.UsuarioID, INSERTED.Nombre, INSERTED.Email, INSERTED.FechaRegistro
        VALUES (@RolID, @Nombre, @Email, @PasswordHash, @Telefono, @Direccion, 1);
      `);

    const nuevoUsuario = result.recordset[0];

    // Registro de auditoría
    await logAudit(nuevoUsuario.UsuarioID, 'Autenticacion', 'Registro', `Nuevo usuario registrado: ${nuevoUsuario.Email}`, req.ip);

    // Generar Token JWT
    const token = jwt.sign(
      { id: nuevoUsuario.UsuarioID, email: nuevoUsuario.Email, rol: 'Cliente' },
      process.env.JWT_SECRET || 'super_secret_jwt_key_arepas_2026_xYz987!',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return success(res, {
      token,
      usuario: {
        id: nuevoUsuario.UsuarioID,
        nombre: nuevoUsuario.Nombre,
        email: nuevoUsuario.Email,
        rol: 'Cliente'
      }
    }, 'Usuario registrado exitosamente', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Inicio de sesión y verificación de credenciales
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, 'Correo electrónico y contraseña requeridos', 400);
    }

    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    const result = await pool.request()
      .input('Email', sql.VarChar(150), email.trim().toLowerCase())
      .query(`
        SELECT u.UsuarioID, u.Nombre, u.Email, u.PasswordHash, u.RolID, r.Nombre AS RolNombre, u.Activo
        FROM Usuarios u
        INNER JOIN Roles r ON u.RolID = r.RolID
        WHERE u.Email = @Email
      `);

    if (result.recordset.length === 0) {
      return error(res, 'Credenciales incorrectas', 401);
    }

    const usuario = result.recordset[0];

    if (!usuario.Activo) {
      return error(res, 'Tu cuenta está inactiva. Contacta al administrador', 403);
    }

    // Verificar contraseña con bcrypt
    const match = await bcrypt.compare(password, usuario.PasswordHash);
    if (!match) {
      await logAudit(usuario.UsuarioID, 'Autenticacion', 'IntentoFallido', `Contraseña incorrecta para: ${usuario.Email}`, req.ip);
      return error(res, 'Credenciales incorrectas', 401);
    }

    // Generar Token JWT
    const token = jwt.sign(
      { id: usuario.UsuarioID, email: usuario.Email, rol: usuario.RolNombre },
      process.env.JWT_SECRET || 'super_secret_jwt_key_arepas_2026_xYz987!',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    await logAudit(usuario.UsuarioID, 'Autenticacion', 'Login', `Inicio de sesión exitoso`, req.ip);

    return success(res, {
      token,
      usuario: {
        id: usuario.UsuarioID,
        nombre: usuario.Nombre,
        email: usuario.Email,
        rolId: usuario.RolID,
        rol: usuario.RolNombre
      }
    }, 'Inicio de sesión exitoso');
  } catch (err) {
    next(err);
  }
};

/**
 * Obtener perfil del usuario autenticado
 */
exports.getProfile = async (req, res) => {
  return success(res, { usuario: req.user }, 'Perfil obtenido exitosamente');
};

