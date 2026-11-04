-- =====================================================================
-- PROYECTO: Plataforma E-commerce de Alimentos (Arepas, Combos y Toppings)
-- SCRIPT: database/seed.sql (Datos iniciales de prueba)
-- =====================================================================

USE ArepasDB;
GO

-- 1. ROLES
SET IDENTITY_INSERT Roles ON;
INSERT INTO Roles (RolID, Nombre) VALUES 
(1, 'Cliente'),
(2, 'Administrador');
SET IDENTITY_INSERT Roles OFF;
GO

-- 2. USUARIOS INICIALES (Contraseña de prueba: 'Admin123*' y 'Cliente123*')
-- Hash generado con bcrypt salt rounds 10
-- 'Admin123*' -> $2a$10$hSw.q.V/Zy5nkyWjxiKY8ujbJ2pDjB7QQSPofE.cKblQBHEwW7Lhe
-- 'Cliente123*' -> $2a$10$yusI11nP6cJupIeAqhHZH.bKcXEazSfXJ9MwteVv5G95A0vvm1hPG
INSERT INTO Usuarios (RolID, Nombre, Email, PasswordHash, Telefono, Direccion, Activo)
VALUES 
(2, 'Administrador General', 'admin@arepasgourmet.com', '$2a$10$hSw.q.V/Zy5nkyWjxiKY8ujbJ2pDjB7QQSPofE.cKblQBHEwW7Lhe', '3001234567', 'Carrera 15 # 85-30, Bogotá', 1),
(1, 'María Cliente', 'cliente@correo.com', '$2a$10$yusI11nP6cJupIeAqhHZH.bKcXEazSfXJ9MwteVv5G95A0vvm1hPG', '3109876543', 'Calle 100 # 19-45, Apto 402, Bogotá', 1);
GO

-- Corregir las cuentas de prueba si la base de datos ya existía.
UPDATE Usuarios
SET PasswordHash = CASE LOWER(Email)
  WHEN 'admin@arepasgourmet.com' THEN '$2a$10$hSw.q.V/Zy5nkyWjxiKY8ujbJ2pDjB7QQSPofE.cKblQBHEwW7Lhe'
  WHEN 'cliente@correo.com' THEN '$2a$10$yusI11nP6cJupIeAqhHZH.bKcXEazSfXJ9MwteVv5G95A0vvm1hPG'
END
WHERE LOWER(Email) IN ('admin@arepasgourmet.com', 'cliente@correo.com');
GO

-- 3. ESTADOS DE PEDIDO
SET IDENTITY_INSERT EstadosPedido ON;
INSERT INTO EstadosPedido (EstadoID, Nombre) VALUES 
(1, 'Pendiente'),
(2, 'Pagado'),
(3, 'Rechazado'),
(4, 'Cancelado'),
(5, 'Entregado');
SET IDENTITY_INSERT EstadosPedido OFF;
GO

-- 4. CATEGORÍAS
SET IDENTITY_INSERT Categorias ON;
INSERT INTO Categorias (CategoriaID, Nombre, Descripcion, Activa) VALUES 
(1, 'Arepas Rellenas', 'Arepas rellenas y arepas de queso.', 1),
(2, 'Arepas Tradicionales', 'Arepas de chócolo, plátano, trigo y maíz.', 1),
(3, 'Arepas Especiales', 'Arepas multicolores y arepas de arroz.', 1);
SET IDENTITY_INSERT Categorias OFF;
GO

-- 5. TOPPINGS / ADICIONALES
SET IDENTITY_INSERT Toppings ON;
INSERT INTO Toppings (ToppingID, Nombre, PrecioAdicional, StockActual, Activo) VALUES 
(1, 'Hogao', 2000.00, 100, 1),
(2, 'Tocineta crujiente', 3500.00, 100, 1),
(3, 'Carne desmechada', 4000.00, 100, 1),
(4, 'Pollo desmechado', 3500.00, 100, 1),
(5, 'Queso mozzarella', 3000.00, 100, 1);
SET IDENTITY_INSERT Toppings OFF;
GO

-- 6. PRODUCTOS Y COMBOS
SET IDENTITY_INSERT Productos ON;
INSERT INTO Productos (ProductoID, CategoriaID, Nombre, Descripcion, PrecioBase, PrecioPaquete, StockActual, EsCombo, PermiteToppings, ImagenURL, Activo) VALUES 
(1, 3, N'Arepa de arroz', N'Deliciosa arepa elaborada a base de arroz, suave y perfecta para acompañar cualquier comida.', 3500.00, 9000.00, 35, 0, 1, '/images/arepa_arroz.jpeg', 1),
(2, 2, N'Arepa de maíz', N'La tradicional arepa de maíz artesanal, doradita y crujiente por fuera.', 3000.00, 8000.00, 25, 0, 1, '/images/arepa_maiz.jpg', 1),
(3, 2, N'Arepa de plátano', N'Exquisita arepa con un toque dulce de plátano maduro.', 3500.00, 9000.00, 20, 0, 1, '/images/arepa_platano.jpeg', 1),
(4, 2, N'Arepa de trigo', N'Tradicional arepa de harina de trigo, de textura suave y gran sabor.', 3500.00, 9000.00, 0, 0, 1, '/images/arepa_trigo.jpeg', 1),
(5, 2, N'Arepa chócolo', N'Dulce arepa de chócolo tierna, ideal para acompañar con quesito fresco.', 6000.00, 14000.00, 15, 0, 1, '/images/arepas_chocolo.jpg', 1),
(6, 3, N'Arepas multicolores', N'Divertidas y coloridas arepas elaboradas con ingredientes naturales.', 6000.00, 13000.00, 18, 0, 1, '/images/Arepas_multicolores.png', 1),
(7, 1, N'Arepa de queso', N'Rellenas y cargadas de auténtico queso derretido en cada bocado.', 6000.00, 13000.00, 50, 0, 1, '/images/arepas_queso.jpg', 1),
(8, 1, N'Arepas rellenas', N'Arepas gourmet completamente repletas de los mejores ingredientes y carnes.', 10000.00, 22000.00, 30, 0, 1, '/images/Arepas_rellenas.jpg', 1);
SET IDENTITY_INSERT Productos OFF;
GO

UPDATE Productos
SET ImagenURL = CASE ProductoID
  WHEN 1 THEN '/images/arepa_arroz.jpeg'
  WHEN 2 THEN '/images/arepa_maiz.jpg'
  WHEN 3 THEN '/images/arepa_platano.jpeg'
  WHEN 4 THEN '/images/arepa_trigo.jpeg'
  WHEN 5 THEN '/images/arepas_chocolo.jpg'
  WHEN 6 THEN '/images/Arepas_multicolores.png'
  WHEN 7 THEN '/images/arepas_queso.jpg'
  WHEN 8 THEN '/images/Arepas_rellenas.jpg'
END
WHERE ProductoID BETWEEN 1 AND 8;
GO

-- 7. COMENTARIOS DE PRUEBA
INSERT INTO Comentarios (UsuarioID, ProductoID, Calificacion, Texto, FechaCreacion, Activo) VALUES 
(2, 1, 5, '¡La Reina Pepiada es insuperable! El aguacate siempre fresco y bien sazonada.', GETDATE(), 1),
(2, NULL, 5, 'Excelente servicio de entrega a domicilio, llegó caliente y bien empacada.', GETDATE(), 1);
GO
