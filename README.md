# 🫓 Plataforma E-Commerce y Gestión de Pedidos de Arepas Gourmet

Backend robusto desarrollado en **Node.js**, **Express** y **Microsoft SQL Server**, diseñado para la venta de alimentos, personalización de arepas con toppings/adicionales, combos, facturación electrónica en PDF, pagos, comentarios de clientes y panel de administración con reportes y auditoría.

---

## 🏗️ 1. Arquitectura y Estructura del Proyecto

El sistema implementa una **Arquitectura en Capas (Layered Architecture)** desacoplada:

```text
trabajomaria/
├── database/
│   ├── schema.sql              # Script DDL de creación de tablas, FKs, índices y restricciones
│   └── seed.sql                # Script con datos iniciales (roles, usuarios, productos, toppings)
├── src/
│   ├── config/
│   │   ├── database.js         # Pool de conexiones mssql a SQL Server
│   │   └── mailer.js           # Configuración Nodemailer para envío de facturas
│   ├── controllers/
│   │   ├── auth.controller.js      # Registro, login y perfil con JWT y bcrypt
│   │   ├── product.controller.js   # Catálogo, categorías, productos, toppings, "Agotado"
│   │   ├── cart.controller.js      # Validación y cálculo dinámico de carrito
│   │   ├── order.controller.js     # Checkout transaccional, pagos, facturación y PDF
│   │   ├── review.controller.js    # Reseñas (crear, editar/eliminar autor)
│   │   └── report.controller.js    # Reportes Admin (Inventario, Pedidos, Ventas, Auditoría en PDF/Excel)
│   ├── middlewares/
│   │   ├── auth.middleware.js      # Validación de Token JWT y usuario activo
│   │   ├── role.middleware.js      # Control de acceso RBAC (Cliente / Administrador)
│   │   ├── audit.middleware.js     # Registro automático en LogsAuditoria
│   │   └── error.middleware.js     # Manejador global de excepciones
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── product.routes.js
│   │   ├── cart.routes.js
│   │   ├── order.routes.js
│   │   ├── review.routes.js
│   │   ├── report.routes.js
│   │   └── index.js
│   ├── services/
│   │   ├── pdf.service.js          # Generación de factura y reportes con PDFKit
│   │   └── email.service.js        # Envío de correos electrónicos con factura adjunta
│   ├── utils/
│   │   └── responseHandler.js      # Estandarización de respuestas JSON
│   └── app.js                      # Inicialización de Express y middlewares
├── .env.example                    # Plantilla de variables de entorno
├── .env                            # Variables de entorno configuradas
├── package.json
├── server.js                       # Entrada principal del servidor
└── README.md
```

---

## 💾 2. Configuración de Base de Datos en SQL Server (SSMS)

### Paso A: Ejecutar el esquema (DDL)
1. Abre **SQL Server Management Studio (SSMS)** y conéctate a tu instancia local (`localhost` o `.\SQLEXPRESS`).
2. Abre el archivo [`database/schema.sql`](file:///d:/Cosas/trabajomaria/database/schema.sql).
3. Presiona **F5** o haz clic en **Execute**. Esto creará la base de datos `ArepasDB` con todas sus tablas, índices y restricciones.

### Paso B: Cargar datos iniciales de prueba (Seed)
1. Abre el archivo [`database/seed.sql`](file:///d:/Cosas/trabajomaria/database/seed.sql).
2. Presiona **F5** o haz clic en **Execute**.
3. Se insertarán los roles, productos (Reina Pepiada, Pelúa, Combos), toppings (queso costeño, tocineta, aguacate) y 2 usuarios de prueba:
   - **Administrador:** `admin@arepasgourmet.com` | Contraseña: `Admin123*`
   - **Cliente:** `cliente@correo.com` | Contraseña: `Cliente123*`

---

## ⚙️ 3. Instalación y Ejecución de la API

1. Asegúrate de tener instalado **Node.js** (v18+) en tu equipo.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Verifica tus credenciales de SQL Server en el archivo `.env`:
   ```env
   DB_USER=sa
   DB_PASSWORD=TuPasswordSeguro123*
   DB_SERVER=localhost
   DB_DATABASE=ArepasDB
   DB_PORT=1433
   ```
4. Inicia el servidor:
   ```bash
   npm run dev
   # o para producción:
   npm start
   ```

El servidor Express levantará tanto la API como la interfaz Web (Frontend integrado):
- **Frontend Web interactivo:** Abre tu navegador en **`http://localhost:3000`**
- **API REST:** `http://localhost:3000/api`
- **Health Check:** `http://localhost:3000/api/health`

---

## 🚀 4. Documentación de Endpoints por Módulo

### 1. Autenticación (`/api/auth`)
- `POST /api/auth/register`: Registro de nuevos usuarios clientes (hasheado con bcrypt).
  ```json
  {
    "nombre": "Carlos Gómez",
    "email": "carlos@correo.com",
    "password": "Password123*",
    "telefono": "3001234567",
    "direccion": "Calle 45 # 10-20, Bogotá"
  }
  ```
- `POST /api/auth/login`: Autenticación y generación de JWT de 24 horas.
  ```json
  {
    "email": "admin@arepasgourmet.com",
    "password": "Admin123*"
  }
  ```
- `GET /api/auth/profile`: Consulta de perfil (`Authorization: Bearer <token>`).

---

### 2. Catálogo y Gestión de Productos (`/api/products`)
- `GET /api/products/categories`: Categorías activas.
- `GET /api/products/toppings`: Lista de adicionales disponibles con stock.
- `GET /api/products`: Catálogo completo. Admite query params:
  - `?categoriaId=1` (Filtro por categoría)
  - `?busqueda=reina` (Búsqueda por texto)
  - Incluye automáticamente el campo `"Agotado": 1` cuando `StockActual <= 0`.
- `GET /api/products/:id`: Detalle del producto con sus toppings disponibles.
- `POST /api/products`: Creación de producto (Rol: Administrador).
- `PUT /api/products/:id`: Edición de producto y ajuste de inventario (Rol: Administrador).

---

### 3. Carrito y Confirmación de Pedidos (`/api/cart` y `/api/orders`)
- `POST /api/cart/validate`: Validación en tiempo real del carrito:
  ```json
  {
    "items": [
      {
        "productoId": 1,
        "cantidad": 2,
        "toppingIds": [1, 2]
      },
      {
        "productoId": 5,
        "cantidad": 1,
        "toppingIds": []
      }
    ]
  }
  ```
  *Devuelve desglose con precio unitario, adicionales, IVA (19%), costo de envío ($5.000) y alerta si algún ítem está agotado.*

- `POST /api/orders/checkout`: Reserva transaccional del pedido bajo **SQL Server Transaction** con `UPDLOCK` para garantizar coherencia de inventario:
  ```json
  {
    "items": [
      {
        "productoId": 1,
        "cantidad": 2,
        "toppingIds": [1, 2]
      }
    ],
    "direccionEntrega": "Carrera 7 # 72-10, Apto 501",
    "metodoPago": "Tarjeta"
  }
  ```

- `POST /api/orders/pay`: Procesamiento de pagos (pasarela simulada):
  - **Aprobado:** Descuenta automáticamente el inventario de `Productos` y `Toppings`, genera registro en `Facturas`, crea el archivo **PDF con PDFKit** y lo **envía al correo del cliente**.
  - **Rechazado:** Envía `"simularRechazo": true` para probar el flujo de error, marcando el pedido como `Rechazado` y permitiendo reintento sin descontar stock.
  ```json
  {
    "pedidoId": 1,
    "metodoPago": "Tarjeta de Crédito",
    "simularRechazo": false
  }
  ```

- `GET /api/orders/my-orders`: Historial de pedidos del cliente.
- `GET /api/orders/:pedidoId/invoice-pdf`: Descarga directa de la factura en PDF.

---

### 4. Interacción y Comentarios (`/api/reviews`)
- `GET /api/reviews`: Listar todas las opiniones o filtrar por producto con `?productoId=1`.
- `POST /api/reviews`: Publicar comentario (Autenticado).
  ```json
  {
    "productoId": 1,
    "calificacion": 5,
    "texto": "¡La mejor Reina Pepiada que he probado! Muy recomendada."
  }
  ```
- `PUT /api/reviews/:id`: Editar comentario (**Validación SQL: solo el autor original puede editarlo**).
- `DELETE /api/reviews/:id`: Eliminar comentario (**Solo el autor o Administrador**).

---

### 5. Reportes y Auditoría - Panel de Administración (`/api/reports`)
*(Requiere header `Authorization: Bearer <TOKEN_ADMIN>`)*

- `GET /api/reports?tipo=inventario&formato=json` (o `&formato=pdf` / `&formato=excel`)
- `GET /api/reports?tipo=pedidos&fechaInicio=2026-01-01&fechaFin=2026-12-31`
- `GET /api/reports?tipo=ventas&formato=excel` (Descarga directa de archivo `.xlsx`)
- `GET /api/reports?tipo=auditoria&formato=pdf` (Descarga directa del reporte en `.pdf`)

