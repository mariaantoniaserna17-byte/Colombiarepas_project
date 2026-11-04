-- =====================================================================
-- PROYECTO: Plataforma E-commerce de Alimentos (Arepas, Combos y Toppings)
-- BASE DE DATOS: SQL Server (Compatible con SSMS 18/19/20)
-- SCRIPT: database/schema.sql
-- =====================================================================

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'ArepasDB')
BEGIN
    CREATE DATABASE ArepasDB;
END
GO

USE ArepasDB;
GO

-- Limpieza preventiva si se desea reiniciar el esquema (orden inverso por FKs)
IF OBJECT_ID('LogsAuditoria', 'U') IS NOT NULL DROP TABLE LogsAuditoria;
IF OBJECT_ID('Comentarios', 'U') IS NOT NULL DROP TABLE Comentarios;
IF OBJECT_ID('Facturas', 'U') IS NOT NULL DROP TABLE Facturas;
IF OBJECT_ID('Pagos', 'U') IS NOT NULL DROP TABLE Pagos;
IF OBJECT_ID('PedidoDetalleToppings', 'U') IS NOT NULL DROP TABLE PedidoDetalleToppings;
IF OBJECT_ID('PedidoDetalles', 'U') IS NOT NULL DROP TABLE PedidoDetalles;
IF OBJECT_ID('Pedidos', 'U') IS NOT NULL DROP TABLE Pedidos;
IF OBJECT_ID('EstadosPedido', 'U') IS NOT NULL DROP TABLE EstadosPedido;
IF OBJECT_ID('Toppings', 'U') IS NOT NULL DROP TABLE Toppings;
IF OBJECT_ID('Productos', 'U') IS NOT NULL DROP TABLE Productos;
IF OBJECT_ID('Categorias', 'U') IS NOT NULL DROP TABLE Categorias;
IF OBJECT_ID('Usuarios', 'U') IS NOT NULL DROP TABLE Usuarios;
IF OBJECT_ID('Roles', 'U') IS NOT NULL DROP TABLE Roles;
GO

-- =====================================================================
-- 1. TABLAS DE AUTENTICACIÓN, USUARIOS Y ROLES
-- =====================================================================
CREATE TABLE Roles (
    RolID INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE Usuarios (
    UsuarioID INT IDENTITY(1,1) PRIMARY KEY,
    RolID INT NOT NULL DEFAULT 1, -- 1: Cliente, 2: Administrador
    Nombre VARCHAR(100) NOT NULL,
    Email VARCHAR(150) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Telefono VARCHAR(20) NULL,
    Direccion VARCHAR(255) NULL,
    FechaRegistro DATETIME NOT NULL DEFAULT GETDATE(),
    Activo BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_Usuarios_Roles FOREIGN KEY (RolID) REFERENCES Roles(RolID)
);

CREATE NONCLUSTERED INDEX IX_Usuarios_Email ON Usuarios(Email);
GO

-- =====================================================================
-- 2. TABLAS DE CATÁLOGO, PRODUCTOS, COMBOS Y TOPPINGS
-- =====================================================================
CREATE TABLE Categorias (
    CategoriaID INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL UNIQUE,
    Descripcion VARCHAR(255) NULL,
    Activa BIT NOT NULL DEFAULT 1
);

CREATE TABLE Productos (
    ProductoID INT IDENTITY(1,1) PRIMARY KEY,
    CategoriaID INT NOT NULL,
    Nombre NVARCHAR(150) NOT NULL,
    Descripcion NVARCHAR(500) NULL,
    PrecioBase DECIMAL(10,2) NOT NULL CHECK (PrecioBase >= 0),
    PrecioPaquete DECIMAL(10,2) NOT NULL CHECK (PrecioPaquete >= 0),
    StockActual INT NOT NULL DEFAULT 0 CHECK (StockActual >= 0),
    EsCombo BIT NOT NULL DEFAULT 0,
    PermiteToppings BIT NOT NULL DEFAULT 1,
    ImagenURL VARCHAR(300) NULL,
    Activo BIT NOT NULL DEFAULT 1,
    FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Productos_Categorias FOREIGN KEY (CategoriaID) REFERENCES Categorias(CategoriaID)
);

CREATE NONCLUSTERED INDEX IX_Productos_Categoria ON Productos(CategoriaID);
CREATE NONCLUSTERED INDEX IX_Productos_Activo ON Productos(Activo);

CREATE TABLE Toppings (
    ToppingID INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL UNIQUE,
    PrecioAdicional DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (PrecioAdicional >= 0),
    StockActual INT NOT NULL DEFAULT 0 CHECK (StockActual >= 0),
    Activo BIT NOT NULL DEFAULT 1
);
GO

-- =====================================================================
-- 3. TABLAS DE PEDIDOS, DETALLES, PERSONALIZACIONES Y PAGOS
-- =====================================================================
CREATE TABLE EstadosPedido (
    EstadoID INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE Pedidos (
    PedidoID INT IDENTITY(1,1) PRIMARY KEY,
    UsuarioID INT NOT NULL,
    EstadoID INT NOT NULL DEFAULT 1, -- Pendiente
    Subtotal DECIMAL(10,2) NOT NULL CHECK (Subtotal >= 0),
    ImpuestoIVA DECIMAL(10,2) NOT NULL CHECK (ImpuestoIVA >= 0),
    CostoEnvio DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (CostoEnvio >= 0),
    Total DECIMAL(10,2) NOT NULL CHECK (Total >= 0),
    DireccionEntrega VARCHAR(255) NOT NULL,
    MetodoPago VARCHAR(50) NOT NULL DEFAULT 'Efectivo',
    FechaPedido DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Pedidos_Usuarios FOREIGN KEY (UsuarioID) REFERENCES Usuarios(UsuarioID),
    CONSTRAINT FK_Pedidos_Estados FOREIGN KEY (EstadoID) REFERENCES EstadosPedido(EstadoID)
);

CREATE NONCLUSTERED INDEX IX_Pedidos_Usuario ON Pedidos(UsuarioID);
CREATE NONCLUSTERED INDEX IX_Pedidos_Fecha ON Pedidos(FechaPedido);

CREATE TABLE PedidoDetalles (
    DetalleID INT IDENTITY(1,1) PRIMARY KEY,
    PedidoID INT NOT NULL,
    ProductoID INT NOT NULL,
    Cantidad INT NOT NULL CHECK (Cantidad > 0),
    PrecioUnitario DECIMAL(10,2) NOT NULL,
    SubtotalLinea DECIMAL(10,2) NOT NULL,
    CONSTRAINT FK_Detalles_Pedidos FOREIGN KEY (PedidoID) REFERENCES Pedidos(PedidoID),
    CONSTRAINT FK_Detalles_Productos FOREIGN KEY (ProductoID) REFERENCES Productos(ProductoID)
);

-- Personalizaciones de toppings para cada producto en el pedido
CREATE TABLE PedidoDetalleToppings (
    DetalleToppingID INT IDENTITY(1,1) PRIMARY KEY,
    DetalleID INT NOT NULL,
    ToppingID INT NOT NULL,
    PrecioAdicional DECIMAL(10,2) NOT NULL,
    CONSTRAINT FK_PDT_Detalles FOREIGN KEY (DetalleID) REFERENCES PedidoDetalles(DetalleID) ON DELETE CASCADE,
    CONSTRAINT FK_PDT_Toppings FOREIGN KEY (ToppingID) REFERENCES Toppings(ToppingID)
);

CREATE TABLE Pagos (
    PagoID INT IDENTITY(1,1) PRIMARY KEY,
    PedidoID INT NOT NULL,
    TransaccionPasarelaID VARCHAR(100) NULL,
    MetodoPago VARCHAR(50) NOT NULL,
    Monto DECIMAL(10,2) NOT NULL,
    EstadoPago VARCHAR(50) NOT NULL, -- 'Pendiente', 'Aprobado', 'Rechazado'
    RespuestaPasarela VARCHAR(MAX) NULL,
    FechaPago DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Pagos_Pedidos FOREIGN KEY (PedidoID) REFERENCES Pedidos(PedidoID)
);

CREATE TABLE Facturas (
    FacturaID INT IDENTITY(1,1) PRIMARY KEY,
    PedidoID INT NOT NULL UNIQUE,
    NumeroFactura VARCHAR(50) NOT NULL UNIQUE,
    FechaEmision DATETIME NOT NULL DEFAULT GETDATE(),
    MontoSubtotal DECIMAL(10,2) NOT NULL,
    MontoIVA DECIMAL(10,2) NOT NULL,
    MontoEnvio DECIMAL(10,2) NOT NULL,
    MontoTotal DECIMAL(10,2) NOT NULL,
    URLFacturaPDF VARCHAR(300) NULL,
    CONSTRAINT FK_Facturas_Pedidos FOREIGN KEY (PedidoID) REFERENCES Pedidos(PedidoID)
);
GO

-- =====================================================================
-- 4. TABLA DE COMENTARIOS Y RESEÑAS
-- =====================================================================
CREATE TABLE Comentarios (
    ComentarioID INT IDENTITY(1,1) PRIMARY KEY,
    UsuarioID INT NOT NULL,
    ProductoID INT NULL, -- NULL si es recomendación o sugerencia general
    Calificacion INT NOT NULL CHECK (Calificacion BETWEEN 1 AND 5),
    Texto VARCHAR(1000) NOT NULL,
    FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
    FechaActualizacion DATETIME NULL,
    Activo BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_Comentarios_Usuarios FOREIGN KEY (UsuarioID) REFERENCES Usuarios(UsuarioID),
    CONSTRAINT FK_Comentarios_Productos FOREIGN KEY (ProductoID) REFERENCES Productos(ProductoID)
);

CREATE NONCLUSTERED INDEX IX_Comentarios_Producto ON Comentarios(ProductoID);
GO

-- =====================================================================
-- 5. TABLA DE AUDITORÍA
-- =====================================================================
CREATE TABLE LogsAuditoria (
    LogID INT IDENTITY(1,1) PRIMARY KEY,
    UsuarioID INT NULL,
    Modulo VARCHAR(100) NOT NULL,
    Accion VARCHAR(100) NOT NULL,
    Detalle VARCHAR(MAX) NULL,
    DireccionIP VARCHAR(45) NULL,
    FechaRegistro DATETIME NOT NULL DEFAULT GETDATE()
);

CREATE NONCLUSTERED INDEX IX_Logs_Modulo ON LogsAuditoria(Modulo);
CREATE NONCLUSTERED INDEX IX_Logs_Fecha ON LogsAuditoria(FechaRegistro);
GO
