const { sql, poolPromise } = require('../config/database');
const { success, error } = require('../utils/responseHandler');
const { logAudit } = require('../middlewares/audit.middleware');

/**
 * Obtener lista de categorías activas
 */
exports.getCategories = async (req, res, next) => {
  try {
    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    const result = await pool.request()
      .query('SELECT CategoriaID, Nombre, Descripcion FROM Categorias WHERE Activa = 1 ORDER BY Nombre ASC');

    return success(res, result.recordset, 'Categorías obtenidas');
  } catch (err) {
    next(err);
  }
};

/**
 * Listar productos activos con filtros, búsqueda y validación de stock ("Agotado")
 */
exports.getProducts = async (req, res, next) => {
  try {
    const { categoriaId, busqueda } = req.query;
    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    const request = pool.request();
    let query = `
      SELECT 
        p.ProductoID, 
        p.CategoriaID, 
        c.Nombre AS CategoriaNombre,
        p.Nombre, 
        p.Descripcion, 
        p.PrecioBase,
        p.PrecioPaquete,
        p.StockActual, 
        CASE WHEN p.StockActual <= 0 THEN 1 ELSE 0 END AS Agotado,
        p.EsCombo, 
        p.PermiteToppings, 
        p.ImagenURL,
        p.Activo
      FROM Productos p
      INNER JOIN Categorias c ON p.CategoriaID = c.CategoriaID
      WHERE p.Activo = 1
    `;

    if (categoriaId) {
      request.input('CategoriaID', sql.Int, parseInt(categoriaId, 10));
      query += ' AND p.CategoriaID = @CategoriaID';
    }

    if (busqueda) {
      request.input('Busqueda', sql.VarChar(100), `%${busqueda.trim()}%`);
      query += ' AND (p.Nombre LIKE @Busqueda OR p.Descripcion LIKE @Busqueda)';
    }

    query += ' ORDER BY p.Nombre ASC';

    const result = await request.query(query);
    return success(res, result.recordset, 'Catálogo de productos obtenido');
  } catch (err) {
    next(err);
  }
};

/**
 * Obtener detalle de producto con toppings disponibles
 */
exports.getProductDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    const prodResult = await pool.request()
      .input('ProductoID', sql.Int, parseInt(id, 10))
      .query(`
        SELECT 
          p.ProductoID, p.CategoriaID, c.Nombre AS CategoriaNombre,
          p.Nombre, p.Descripcion, p.PrecioBase, p.PrecioPaquete, p.StockActual,
          CASE WHEN p.StockActual <= 0 THEN 1 ELSE 0 END AS Agotado,
          p.EsCombo, p.PermiteToppings, p.ImagenURL
        FROM Productos p
        INNER JOIN Categorias c ON p.CategoriaID = c.CategoriaID
        WHERE p.ProductoID = @ProductoID AND p.Activo = 1
      `);

    if (prodResult.recordset.length === 0) {
      return error(res, 'Producto no encontrado', 404);
    }

    const producto = prodResult.recordset[0];
    let toppings = [];

    // Si el producto permite toppings, consultar los toppings activos
    if (producto.PermiteToppings) {
      const topResult = await pool.request()
        .query(`
          SELECT ToppingID, Nombre, PrecioAdicional, StockActual,
                 CASE WHEN StockActual <= 0 THEN 1 ELSE 0 END AS Agotado
          FROM Toppings
          WHERE Activo = 1
          ORDER BY Nombre ASC
        `);
      toppings = topResult.recordset;
    }

    return success(res, {
      ...producto,
      toppingsDisponibles: toppings
    }, 'Detalle de producto obtenido');
  } catch (err) {
    next(err);
  }
};

/**
 * Obtener lista de todos los toppings
 */
exports.getToppings = async (req, res, next) => {
  try {
    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    const result = await pool.request()
      .query(`
        SELECT ToppingID, Nombre, PrecioAdicional, StockActual,
               CASE WHEN StockActual <= 0 THEN 1 ELSE 0 END AS Agotado
        FROM Toppings 
        WHERE Activo = 1 
        ORDER BY Nombre ASC
      `);

    return success(res, result.recordset, 'Lista de toppings obtenida');
  } catch (err) {
    next(err);
  }
};

/**
 * Crear producto (Administrador)
 */
exports.createProduct = async (req, res, next) => {
  try {
    const { categoriaId, nombre, descripcion, precioBase, precioPaquete, stockActual, esCombo, permiteToppings, imagenURL } = req.body;
    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    const result = await pool.request()
      .input('CategoriaID', sql.Int, categoriaId)
      .input('Nombre', sql.NVarChar(150), nombre)
      .input('Descripcion', sql.NVarChar(500), descripcion || null)
      .input('PrecioBase', sql.Decimal(10, 2), precioBase)
      .input('PrecioPaquete', sql.Decimal(10, 2), precioPaquete)
      .input('StockActual', sql.Int, stockActual || 0)
      .input('EsCombo', sql.Bit, esCombo ? 1 : 0)
      .input('PermiteToppings', sql.Bit, permiteToppings !== undefined ? (permiteToppings ? 1 : 0) : 1)
      .input('ImagenURL', sql.VarChar(300), imagenURL || null)
      .query(`
        INSERT INTO Productos (CategoriaID, Nombre, Descripcion, PrecioBase, PrecioPaquete, StockActual, EsCombo, PermiteToppings, ImagenURL, Activo)
        OUTPUT INSERTED.*
        VALUES (@CategoriaID, @Nombre, @Descripcion, @PrecioBase, @PrecioPaquete, @StockActual, @EsCombo, @PermiteToppings, @ImagenURL, 1);
      `);

    await logAudit(req.user.id, 'Productos', 'Crear', `Producto creado: ${nombre}`, req.ip);
    return success(res, result.recordset[0], 'Producto creado exitosamente', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Actualizar producto y stock (Administrador)
 */
exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { categoriaId, nombre, descripcion, precioBase, precioPaquete, stockActual, activo, esCombo, permiteToppings, imagenURL } = req.body;
    const pool = await poolPromise;
    if (!pool) return error(res, 'Base de datos no disponible', 503);

    await pool.request()
      .input('ProductoID', sql.Int, parseInt(id, 10))
      .input('CategoriaID', sql.Int, categoriaId)
      .input('Nombre', sql.NVarChar(150), nombre)
      .input('Descripcion', sql.NVarChar(500), descripcion || null)
      .input('PrecioBase', sql.Decimal(10, 2), precioBase)
      .input('PrecioPaquete', sql.Decimal(10, 2), precioPaquete)
      .input('StockActual', sql.Int, stockActual)
      .input('Activo', sql.Bit, activo !== undefined ? (activo ? 1 : 0) : 1)
      .input('EsCombo', sql.Bit, esCombo ? 1 : 0)
      .input('PermiteToppings', sql.Bit, permiteToppings ? 1 : 0)
      .input('ImagenURL', sql.VarChar(300), imagenURL || null)
      .query(`
        UPDATE Productos
        SET CategoriaID = @CategoriaID,
            Nombre = @Nombre,
            Descripcion = @Descripcion,
            PrecioBase = @PrecioBase,
            PrecioPaquete = @PrecioPaquete,
            StockActual = @StockActual,
            Activo = @Activo,
            EsCombo = @EsCombo,
            PermiteToppings = @PermiteToppings,
            ImagenURL = @ImagenURL
        WHERE ProductoID = @ProductoID
      `);

    await logAudit(req.user.id, 'Productos', 'Actualizar', `Producto ID ${id} actualizado`, req.ip);
    return success(res, { productoId: id }, 'Producto actualizado exitosamente');
  } catch (err) {
    next(err);
  }
};
