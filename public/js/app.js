/**
 * Lógica principal de la aplicación Frontend
 */

// Estado Global de la App
const state = {
  user: api.getUser(),
  categories: [],
  products: [],
  toppings: [],
  selectedCategory: null,
  searchQuery: '',
  cart: JSON.parse(localStorage.getItem('arepas_cart') || '[]'),
  currentCustomizingProduct: null,
  activeView: 'catalog', // 'catalog', 'reviews', 'orders', 'admin'
  currentOrderId: null,
  currentReportType: 'inventario'
};

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-600 text-white',
    info: 'bg-blue-600 text-white'
  };

  toast.className = `${bgColors[type] || bgColors.info} px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-sm font-medium fade-in space-x-3 mb-2`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" class="text-white hover:opacity-80 text-lg leading-none">&times;</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// ==========================================
// NAVEGACIÓN Y VISTAS
// ==========================================
function switchView(viewName) {
  if (viewName === 'admin' && state.user?.rol !== 'Administrador') {
    showToast('No tienes permisos para acceder al panel de administración', 'error');
    switchView('catalog');
    return;
  }
  if (viewName === 'orders' && !state.user) {
    showToast('Debes iniciar sesión para consultar tus pedidos', 'warning');
    openAuthModal(false);
    switchView('catalog');
    return;
  }
  if (viewName === 'orders' && state.user?.rol === 'Administrador') {
    showToast('Los pedidos personales están disponibles para clientes', 'info');
    switchView('catalog');
    return;
  }

  state.activeView = viewName;
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));

  const activeSec = document.getElementById(`view-${viewName}`);
  if (activeSec) {
    activeSec.classList.remove('hidden');
    activeSec.classList.add('fade-in');
  }

  // Actualizar estilos de los links del nav
  document.querySelectorAll('.nav-link').forEach(btn => {
    if (btn.dataset.view === viewName) {
      btn.className = 'nav-link text-amber-600 font-bold border-b-2 border-amber-600 pb-1';
    } else {
      btn.className = 'nav-link text-gray-600 hover:text-amber-600 font-medium pb-1';
    }
  });

  if (viewName === 'catalog') loadProducts();
  if (viewName === 'reviews') loadReviews();
  if (viewName === 'orders') loadMyOrders();
  if (viewName === 'admin') loadAdminReport();
}

// ==========================================
// AUTENTICACIÓN
// ==========================================
function updateAuthUI() {
  const guestBox = document.getElementById('nav-guest-box');
  const userBox = document.getElementById('nav-user-box');
  const userNameElem = document.getElementById('nav-user-name');
  const adminNavLink = document.getElementById('nav-admin-link');
  const ordersNavLink = document.getElementById('nav-orders-link');

  if (state.user) {
    guestBox.classList.add('hidden');
    userBox.classList.remove('hidden');
    userNameElem.textContent = `${state.user.nombre} (${state.user.rol})`;
    if (state.user.rol === 'Administrador') {
      adminNavLink.classList.remove('hidden');
      ordersNavLink.classList.add('hidden');
    } else {
      adminNavLink.classList.add('hidden');
      ordersNavLink.classList.remove('hidden');
    }
  } else {
    guestBox.classList.remove('hidden');
    userBox.classList.add('hidden');
    adminNavLink.classList.add('hidden');
    ordersNavLink.classList.add('hidden');
  }
}

function openAuthModal(isRegister = false) {
  document.getElementById('auth-modal').classList.remove('hidden');
  toggleAuthTab(isRegister ? 'register' : 'login');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function toggleAuthTab(tab) {
  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const tabLoginBtn = document.getElementById('tab-btn-login');
  const tabRegBtn = document.getElementById('tab-btn-register');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    tabLoginBtn.className = 'flex-1 py-2 font-bold text-amber-600 border-b-2 border-amber-600';
    tabRegBtn.className = 'flex-1 py-2 font-medium text-gray-500 hover:text-gray-800';
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    tabRegBtn.className = 'flex-1 py-2 font-bold text-amber-600 border-b-2 border-amber-600';
    tabLoginBtn.className = 'flex-1 py-2 font-medium text-gray-500 hover:text-gray-800';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await api.post('/auth/login', { email, password });
    api.setToken(res.data.token);
    api.setUser(res.data.usuario);
    state.user = res.data.usuario;
    updateAuthUI();
    closeAuthModal();
    showToast(`¡Bienvenido de nuevo, ${state.user.nombre}!`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const nombre = document.getElementById('reg-nombre').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const telefono = document.getElementById('reg-telefono').value;
  const direccion = document.getElementById('reg-direccion').value;

  try {
    const res = await api.post('/auth/register', { nombre, email, password, telefono, direccion });
    api.setToken(res.data.token);
    api.setUser(res.data.usuario);
    state.user = res.data.usuario;
    updateAuthUI();
    closeAuthModal();
    showToast('¡Registro exitoso! Ya puedes disfrutar de nuestras arepas.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function handleLogout() {
  api.setToken(null);
  api.setUser(null);
  state.user = null;
  updateAuthUI();
  switchView('catalog');
  showToast('Has cerrado sesión correctamente.', 'info');
}

// ==========================================
// CATÁLOGO Y PERSONALIZACIÓN (MÓDULO 2)
// ==========================================
async function loadCategories() {
  try {
    const res = await api.get('/products/categories');
    state.categories = res.data || [];
    renderCategories();
  } catch (err) {
    console.error('Error cargando categorías:', err);
  }
}

function renderCategories() {
  const container = document.getElementById('categories-container');
  if (!container) return;

  container.innerHTML = `
    <button onclick="selectCategory(null)" class="category-pill px-4 py-2 rounded-full text-sm font-semibold transition ${state.selectedCategory === null ? 'bg-amber-600 text-white shadow-md' : 'bg-amber-100 text-amber-900 hover:bg-amber-200'}">
      ✨ Todas
    </button>
  `;

  state.categories.forEach(cat => {
    const isSelected = state.selectedCategory === cat.CategoriaID;
    const btn = document.createElement('button');
    btn.className = `category-pill px-4 py-2 rounded-full text-sm font-semibold transition ${isSelected ? 'bg-amber-600 text-white shadow-md' : 'bg-amber-100 text-amber-900 hover:bg-amber-200'}`;
    btn.textContent = cat.Nombre;
    btn.onclick = () => selectCategory(cat.CategoriaID);
    container.appendChild(btn);
  });
}

function selectCategory(catId) {
  state.selectedCategory = catId;
  renderCategories();
  loadProducts();
}

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500 font-medium">Cargando productos frescos...</div>';

  try {
    let endpoint = '/products?';
    if (state.selectedCategory) endpoint += `categoriaId=${state.selectedCategory}&`;
    if (state.searchQuery) endpoint += `busqueda=${encodeURIComponent(state.searchQuery)}&`;

    const res = await api.get(endpoint);
    state.products = res.data || [];
    renderProducts();
  } catch (err) {
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-rose-500 font-medium">${err.message}</div>`;
  }
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  if (state.products.length === 0) {
    grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500 font-medium">No se encontraron productos en esta categoría o búsqueda.</div>';
    return;
  }

  // Placeholder elegante según si es arepa o combo
  const defaultImages = [
    'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=500&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80'
  ];

  grid.innerHTML = state.products.map((prod, idx) => {
    const isAgotado = prod.Agotado === 1;
    const imgUrl = prod.ImagenURL || defaultImages[idx % defaultImages.length];

    return `
      <div class="bg-white rounded-2xl shadow-sm hover:shadow-md border border-amber-100 overflow-hidden flex flex-col transition duration-200">
        <div class="relative h-48 bg-amber-50 overflow-hidden">
          <img src="${imgUrl}" alt="${prod.Nombre}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300 ${isAgotado ? 'filter grayscale opacity-60' : ''}">
          ${isAgotado ? `
            <span class="absolute top-3 right-3 bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow">
              Agotado
            </span>
          ` : `
            <span class="absolute top-3 right-3 bg-amber-500 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
              Stock: ${prod.StockActual}
            </span>
          `}
          ${prod.EsCombo ? `
            <span class="absolute top-3 left-3 bg-purple-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
              🔥 Combo
            </span>
          ` : ''}
        </div>
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <span class="text-xs font-semibold text-amber-700 uppercase tracking-wide">${prod.CategoriaNombre || 'Arepa'}</span>
            <h3 class="text-lg font-bold text-gray-900 mt-1">${prod.Nombre}</h3>
            <p class="text-gray-600 text-sm mt-1.5 line-clamp-2">${prod.Descripcion || 'Deliciosa preparación artesanal elaborada al momento con los mejores ingredientes.'}</p>
          </div>
          <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <div>
              <span class="text-xs text-gray-400 block font-medium">Precio base</span>
              <span class="text-xl font-extrabold text-amber-600">$${Number(prod.PrecioBase).toLocaleString('es-CO')}</span>
            </div>
            ${isAgotado ? `
              <button disabled class="bg-gray-200 text-gray-400 font-semibold px-4 py-2 rounded-xl text-sm cursor-not-allowed">
                Sin Stock
              </button>
            ` : `
              <button onclick="openCustomizeModal(${prod.ProductoID})" class="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold px-4 py-2 rounded-xl text-sm shadow-md transition flex items-center space-x-1">
                <span>Personalizar</span>
                <span>➔</span>
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Modal de Personalización (Elegir cantidad y Toppings)
async function openCustomizeModal(productId) {
  try {
    const res = await api.get(`/products/${productId}`);
    state.currentCustomizingProduct = res.data;
    const prod = res.data;

    document.getElementById('modal-custom-title').textContent = prod.Nombre;
    document.getElementById('modal-custom-desc').textContent = prod.Descripcion || '';
    document.getElementById('custom-presentation').value = 'individual';
    document.getElementById('modal-custom-baseprice').textContent = `$${Number(prod.PrecioBase).toLocaleString('es-CO')}`;
    document.getElementById('custom-quantity').value = 1;

    const toppingsList = document.getElementById('modal-toppings-list');
    const toppingsSection = document.getElementById('modal-toppings-section');

    if (prod.PermiteToppings && prod.toppingsDisponibles && prod.toppingsDisponibles.length > 0) {
      toppingsSection.classList.remove('hidden');
      toppingsList.innerHTML = prod.toppingsDisponibles.map(t => {
        const isSinStock = t.Agotado === 1;
        return `
          <label class="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-amber-400 cursor-pointer transition ${isSinStock ? 'opacity-50 pointer-events-none bg-gray-50' : 'hover:bg-amber-50/50'}">
            <div class="flex items-center space-x-3">
              <input type="checkbox" value="${t.ToppingID}" data-price="${t.PrecioAdicional}" data-name="${t.Nombre}" onchange="recalculateModalPrice()" ${isSinStock ? 'disabled' : ''} class="topping-checkbox w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500">
              <span class="text-sm font-medium text-gray-800">${t.Nombre} ${isSinStock ? '<span class="text-xs text-rose-500 font-bold">(Agotado)</span>' : ''}</span>
            </div>
            <span class="text-sm font-semibold text-amber-600">+$${Number(t.PrecioAdicional).toLocaleString('es-CO')}</span>
          </label>
        `;
      }).join('');
    } else {
      toppingsSection.classList.add('hidden');
      toppingsList.innerHTML = '';
    }

    recalculateModalPrice();
    document.getElementById('customize-modal').classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeCustomizeModal() {
  document.getElementById('customize-modal').classList.add('hidden');
  state.currentCustomizingProduct = null;
}

function changeQuantity(delta) {
  const input = document.getElementById('custom-quantity');
  let current = parseInt(input.value, 10) || 1;
  current = Math.max(1, current + delta);
  if (state.currentCustomizingProduct && current > state.currentCustomizingProduct.StockActual) {
    showToast(`Solo hay ${state.currentCustomizingProduct.StockActual} unidades disponibles`, 'warning');
    current = state.currentCustomizingProduct.StockActual;
  }
  input.value = current;
  recalculateModalPrice();
}

function recalculateModalPrice() {
  if (!state.currentCustomizingProduct) return;

  const basePrice = parseFloat(state.currentCustomizingProduct.PrecioBase);
  const presentation = document.getElementById('custom-presentation').value;
  const packagePrice = parseFloat(state.currentCustomizingProduct.PrecioPaquete);
  const selectedBasePrice = presentation === 'paquete' ? packagePrice : basePrice;
  document.getElementById('modal-custom-baseprice').textContent = `$${selectedBasePrice.toLocaleString('es-CO')}`;
  document.getElementById('custom-quantity-label').textContent = presentation === 'paquete' ? 'Cantidad de paquetes:' : 'Cantidad de unidades:';
  const quantity = parseInt(document.getElementById('custom-quantity').value, 10) || 1;

  let toppingsTotal = 0;
  document.querySelectorAll('.topping-checkbox:checked').forEach(cb => {
    toppingsTotal += parseFloat(cb.dataset.price);
  });

  const unitTotal = selectedBasePrice + toppingsTotal;
  const lineTotal = unitTotal * quantity;

  document.getElementById('modal-custom-subtotal').textContent = `$${Number(lineTotal).toLocaleString('es-CO')}`;
}

function addCurrentToCart() {
  if (!state.currentCustomizingProduct) return;

  const prod = state.currentCustomizingProduct;
  const quantity = parseInt(document.getElementById('custom-quantity').value, 10) || 1;
  const presentation = document.getElementById('custom-presentation').value;

  const selectedToppings = [];
  const toppingIds = [];
  document.querySelectorAll('.topping-checkbox:checked').forEach(cb => {
    selectedToppings.push({
      ToppingID: parseInt(cb.value, 10),
      Nombre: cb.dataset.name,
      PrecioAdicional: parseFloat(cb.dataset.price)
    });
    toppingIds.push(parseInt(cb.value, 10));
  });

  const itemKey = `${prod.ProductoID}-${presentation}-${toppingIds.sort().join('_')}`;
  const existingIdx = state.cart.findIndex(i => i.itemKey === itemKey);

  if (existingIdx > -1) {
    state.cart[existingIdx].cantidad += quantity;
  } else {
    state.cart.push({
      itemKey,
      productoId: prod.ProductoID,
      nombre: prod.Nombre,
      precioBase: parseFloat(prod.PrecioBase),
      presentacion: presentation,
      cantidad: quantity,
      toppings: selectedToppings,
      toppingIds
    });
  }

  saveCart();
  closeCustomizeModal();
  showToast(`¡"${prod.Nombre}" agregado al carrito!`);
  openCartDrawer();
}

// ==========================================
// CARRITO DE COMPRAS (MÓDULO 2 & 3)
// ==========================================
function saveCart() {
  localStorage.setItem('arepas_cart', JSON.stringify(state.cart));
  updateCartBadge();
  renderCartDrawer();
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const count = state.cart.reduce((sum, item) => sum + item.cantidad, 0);
  if (badge) {
    badge.textContent = count;
    badge.className = count > 0 
      ? 'absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse'
      : 'hidden';
  }
}

function openCartDrawer() {
  document.getElementById('cart-drawer').classList.remove('hidden');
  renderCartDrawer();
}

function closeCartDrawer() {
  document.getElementById('cart-drawer').classList.add('hidden');
}

async function renderCartDrawer() {
  const itemsContainer = document.getElementById('cart-items-container');
  const emptyState = document.getElementById('cart-empty-state');
  const footer = document.getElementById('cart-footer');

  if (state.cart.length === 0) {
    itemsContainer.innerHTML = '';
    emptyState.classList.remove('hidden');
    footer.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  footer.classList.remove('hidden');

  // Validar con la API para traer subtotales, IVA y stock exacto
  try {
    const payload = {
      items: state.cart.map(i => ({
        productoId: i.productoId,
        cantidad: i.cantidad,
        presentacion: i.presentacion,
        toppingIds: i.toppingIds
      }))
    };

    const res = await api.post('/cart/validate', payload);
    const validated = res.data;

    // Renderizar ítems
    itemsContainer.innerHTML = validated.items.map((item, idx) => {
      const toppingsText = item.toppings && item.toppings.length > 0 
        ? item.toppings.map(t => `+ ${t.nombre} ($${Number(t.precioAdicional).toLocaleString('es-CO')})`).join('<br>')
        : '<span class="text-gray-400">Sin toppings adicionales</span>';

      return `
        <div class="p-4 rounded-xl border ${item.agotado ? 'border-rose-300 bg-rose-50/50' : 'border-gray-200 bg-white'} space-y-2">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-bold text-gray-900 text-sm">${item.nombre} (${item.presentacion === 'paquete' ? 'Paquete x5' : 'Individual'})</h4>
              <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">${toppingsText}</p>
            </div>
            <button onclick="removeCartItem(${idx})" class="text-gray-400 hover:text-rose-600 transition text-sm">
              🗑️
            </button>
          </div>
          <div class="flex justify-between items-center pt-2 border-t border-gray-100 text-sm">
            <div class="flex items-center space-x-2 bg-gray-100 rounded-lg px-2 py-1">
              <button onclick="updateCartItemQty(${idx}, -1)" class="font-bold text-gray-600 px-1">-</button>
              <span class="font-bold text-gray-800 text-xs">${item.cantidad}</span>
              <button onclick="updateCartItemQty(${idx}, 1)" class="font-bold text-gray-600 px-1">+</button>
            </div>
            <span class="font-bold text-amber-700">$${Number(item.subtotalLinea).toLocaleString('es-CO')}</span>
          </div>
          ${item.agotado ? '<p class="text-xs text-rose-600 font-bold">⚠️ Unidades solicitadas superan el stock</p>' : ''}
        </div>
      `;
    }).join('');

    // Totales
    document.getElementById('cart-subtotal').textContent = `$${Number(validated.resumen.subtotal).toLocaleString('es-CO')}`;
    document.getElementById('cart-iva').textContent = `$${Number(validated.resumen.impuestoIVA).toLocaleString('es-CO')}`;
    document.getElementById('cart-shipping').textContent = `$${Number(validated.resumen.costoEnvio).toLocaleString('es-CO')}`;
    document.getElementById('cart-total').textContent = `$${Number(validated.resumen.total).toLocaleString('es-CO')}`;

    const checkoutBtn = document.getElementById('btn-proceed-checkout');
    if (validated.hayItemsSinStock) {
      checkoutBtn.disabled = true;
      checkoutBtn.className = 'w-full py-3 bg-gray-300 text-gray-500 rounded-xl font-bold cursor-not-allowed';
      checkoutBtn.textContent = 'Stock Insuficiente para Continuar';
    } else {
      checkoutBtn.disabled = false;
      checkoutBtn.className = 'w-full py-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl font-bold shadow-md transition';
      checkoutBtn.textContent = 'Confirmar y Proceder al Pago';
    }
  } catch (err) {
    showToast('Error validando carrito: ' + err.message, 'error');
  }
}

function updateCartItemQty(index, delta) {
  if (!state.cart[index]) return;
  state.cart[index].cantidad += delta;
  if (state.cart[index].cantidad <= 0) {
    state.cart.splice(index, 1);
  }
  saveCart();
}

function removeCartItem(index) {
  state.cart.splice(index, 1);
  saveCart();
}

// ==========================================
// CHECKOUT, PAGOS Y FACTURACIÓN (MÓDULO 3)
// ==========================================
function startCheckout() {
  if (!state.user) {
    closeCartDrawer();
    openAuthModal(false);
    showToast('Debes iniciar sesión para confirmar tu pedido', 'warning');
    return;
  }

  closeCartDrawer();
  document.getElementById('checkout-modal').classList.remove('hidden');
  document.getElementById('checkout-address').value = state.user.direccion || '';
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
}

async function handleConfirmOrder(e) {
  e.preventDefault();
  const direccionEntrega = document.getElementById('checkout-address').value;
  const metodoPago = document.getElementById('checkout-payment-method').value;

  if (!direccionEntrega.trim()) {
    showToast('Ingresa una dirección de entrega válida', 'warning');
    return;
  }

  try {
    const payload = {
      items: state.cart.map(i => ({
        productoId: i.productoId,
        cantidad: i.cantidad,
        presentacion: i.presentacion,
        toppingIds: i.toppingIds
      })),
      direccionEntrega,
      metodoPago
    };

    const res = await api.post('/orders/checkout', payload);
    state.currentOrderId = res.data.pedidoId;

    closeCheckoutModal();
    openPaymentGatewayModal(res.data);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Modal de la Pasarela de Pagos
function openPaymentGatewayModal(orderInfo) {
  document.getElementById('gateway-modal').classList.remove('hidden');
  document.getElementById('gateway-order-id').textContent = orderInfo.pedidoId;
  document.getElementById('gateway-amount').textContent = `$${Number(orderInfo.total).toLocaleString('es-CO')}`;
}

function closePaymentGatewayModal() {
  document.getElementById('gateway-modal').classList.add('hidden');
}

async function executePayment(simularRechazo) {
  if (!state.currentOrderId) return;

  try {
    const res = await api.post('/orders/pay', {
      pedidoId: state.currentOrderId,
      metodoPago: document.getElementById('checkout-payment-method').value,
      simularRechazo
    });

    closePaymentGatewayModal();

    // Pago Exitoso: limpiar carrito y mostrar modal de éxito con PDF
    state.cart = [];
    saveCart();

    document.getElementById('success-modal').classList.remove('hidden');
    document.getElementById('success-invoice-num').textContent = res.data.numeroFactura;
    document.getElementById('success-pdf-link').onclick = () => downloadInvoicePDF(state.currentOrderId);

    showToast('¡Pago aprobado y factura emitida con éxito!');
  } catch (err) {
    showToast(err.message, 'error');
    // Si fue rechazado, la pasarela permanece abierta o permite reintentar
  }
}

function closeSuccessModal() {
  document.getElementById('success-modal').classList.add('hidden');
  switchView('orders');
}

async function downloadInvoicePDF(pedidoId) {
  try {
    showToast('Generando y descargando factura PDF...', 'info');
    const blob = await api.get(`/orders/${pedidoId}/invoice-pdf`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Factura_Pedido_${pedidoId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadMyOrders() {
  const container = document.getElementById('orders-list-container');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando tus pedidos...</div>';

  try {
    const res = await api.get('/orders/my-orders');
    const orders = res.data || [];

    if (orders.length === 0) {
      container.innerHTML = '<div class="text-center py-8 text-gray-500">Aún no has realizado pedidos. ¡Anímate a probar nuestras arepas!</div>';
      return;
    }

    container.innerHTML = orders.map(ord => `
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="flex items-center space-x-3">
            <span class="font-bold text-gray-900">Pedido #${ord.PedidoID}</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${ord.Estado === 'Pagado' ? 'bg-emerald-100 text-emerald-800' : ord.Estado === 'Rechazado' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}">
              ${ord.Estado}
            </span>
          </div>
          <p class="text-xs text-gray-400 mt-1">Fecha: ${new Date(ord.FechaPedido).toLocaleString('es-CO')}</p>
          <p class="text-sm font-semibold text-gray-700 mt-2">Total: $${Number(ord.Total).toLocaleString('es-CO')}</p>
        </div>
        <div>
          ${ord.NumeroFactura ? `
            <button onclick="downloadInvoicePDF(${ord.PedidoID})" class="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold border border-amber-200 transition flex items-center space-x-1">
              <span>📄 Descargar Factura</span>
            </button>
          ` : `
            <span class="text-xs text-gray-400 italic">Factura no disponible</span>
          `}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-center py-8 text-rose-500">${err.message}</div>`;
  }
}

// ==========================================
// RESEÑAS Y COMENTARIOS (MÓDULO 4)
// ==========================================
async function loadReviews() {
  const container = document.getElementById('reviews-container');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando comentarios...</div>';

  try {
    const res = await api.get('/reviews');
    const reviews = res.data || [];

    if (reviews.length === 0) {
      container.innerHTML = '<div class="text-center py-8 text-gray-500">No hay comentarios aún. ¡Sé el primero en compartir tu experiencia!</div>';
      return;
    }

    container.innerHTML = reviews.map(rev => {
      const esAutor = state.user && (state.user.id === rev.UsuarioID || state.user.rol === 'Administrador');
      const stars = '⭐'.repeat(rev.Calificacion);

      return `
        <div class="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm space-y-3">
          <div class="flex justify-between items-start">
            <div>
              <div class="flex items-center space-x-2">
                <span class="font-bold text-gray-900">${rev.AutorNombre}</span>
                <span class="text-xs text-amber-500 font-bold">${stars}</span>
              </div>
              <p class="text-xs text-gray-400">${new Date(rev.FechaCreacion).toLocaleDateString('es-CO')} ${rev.FechaActualizacion ? '(Editado)' : ''}</p>
            </div>
            ${esAutor ? `
              <div class="flex space-x-2">
                <button onclick="openEditReviewModal(${rev.ComentarioID}, '${escape(rev.Texto)}', ${rev.Calificacion})" class="text-xs text-amber-600 hover:underline font-semibold">Editar</button>
                <button onclick="deleteReview(${rev.ComentarioID})" class="text-xs text-rose-600 hover:underline font-semibold">Eliminar</button>
              </div>
            ` : ''}
          </div>
          <p class="text-sm text-gray-700 leading-relaxed">${rev.Texto}</p>
          ${rev.ProductoNombre ? `
            <span class="inline-block text-xs font-medium text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md">
              Arepa/Producto: ${rev.ProductoNombre}
            </span>
          ` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-center py-8 text-rose-500">${err.message}</div>`;
  }
}

async function handleCreateReview(e) {
  e.preventDefault();
  if (!state.user) {
    openAuthModal(false);
    showToast('Debes iniciar sesión para publicar un comentario', 'warning');
    return;
  }

  const calificacion = document.getElementById('review-rating').value;
  const texto = document.getElementById('review-text').value;

  try {
    await api.post('/reviews', { calificacion, texto });
    document.getElementById('review-text').value = '';
    showToast('¡Gracias por tus comentarios y sugerencias!');
    loadReviews();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openEditReviewModal(id, textoEscaped, calificacion) {
  document.getElementById('edit-review-modal').classList.remove('hidden');
  document.getElementById('edit-review-id').value = id;
  document.getElementById('edit-review-text').value = unescape(textoEscaped);
  document.getElementById('edit-review-rating').value = calificacion;
}

function closeEditReviewModal() {
  document.getElementById('edit-review-modal').classList.add('hidden');
}

async function handleSaveEditedReview(e) {
  e.preventDefault();
  const id = document.getElementById('edit-review-id').value;
  const texto = document.getElementById('edit-review-text').value;
  const calificacion = document.getElementById('edit-review-rating').value;

  try {
    await api.put(`/reviews/${id}`, { texto, calificacion });
    closeEditReviewModal();
    showToast('Comentario actualizado correctamente');
    loadReviews();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteReview(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar este comentario?')) return;

  try {
    await api.delete(`/reviews/${id}`);
    showToast('Comentario eliminado');
    loadReviews();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// REPORTES Y AUDITORÍA (MÓDULO 5 - ADMIN)
// ==========================================
function switchAdminTab(tipo) {
  state.currentReportType = tipo;
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    if (btn.dataset.report === tipo) {
      btn.className = 'admin-tab-btn px-4 py-2 font-bold text-amber-600 border-b-2 border-amber-600';
    } else {
      btn.className = 'admin-tab-btn px-4 py-2 font-medium text-gray-500 hover:text-gray-800';
    }
  });
  loadAdminReport();
}

async function loadAdminReport() {
  const container = document.getElementById('admin-report-table-container');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-8 text-gray-500">Consultando datos en SQL Server...</div>';

  try {
    const res = await api.get(`/reports?tipo=${state.currentReportType}&formato=json`);
    const data = res.data;

    if (!data.registros || data.registros.length === 0) {
      container.innerHTML = '<div class="text-center py-8 text-gray-500">No hay registros para este reporte.</div>';
      return;
    }

    const headers = Object.keys(data.registros[0]);

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-gray-600 border-collapse">
          <thead class="bg-amber-50 text-amber-900 text-xs uppercase font-bold">
            <tr>
              ${headers.map(h => `<th class="px-4 py-3 border-b border-amber-200">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${data.registros.map(row => `
              <tr class="hover:bg-amber-50/40">
                ${headers.map(h => {
                  let val = row[h];
                  if (val === 'AGOTADO') val = '<span class="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold rounded-md text-xs">AGOTADO</span>';
                  if (val === 'DISPONIBLE') val = '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded-md text-xs">DISPONIBLE</span>';
                  return `<td class="px-4 py-3">${val !== null && val !== undefined ? val : '-'}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="text-center py-8 text-rose-500">${err.message}</div>`;
  }
}

async function exportAdminReport(formato) {
  try {
    showToast(`Generando y exportando reporte a ${formato.toUpperCase()}...`, 'info');
    const blob = await api.get(`/reports?tipo=${state.currentReportType}&formato=${formato}`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_${state.currentReportType}_${Date.now()}.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  updateCartBadge();
  loadCategories();
  loadProducts();

  // Búsqueda en tiempo real
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      loadProducts();
    });
  }
});
