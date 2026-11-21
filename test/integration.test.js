const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

test('carrito rechaza cuerpo vacío', async () => {
  const { response, body } = await request('/api/cart/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /carrito/i);
});

test('reseña protegida rechaza acceso sin token', async () => {
  const { response, body } = await request('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productoId: 1, calificacion: 5, texto: 'Excelente' })
  });

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
});

test('reporte administrativo rechaza acceso sin token', async () => {
  const { response, body } = await request('/api/reports?tipo=inventario');

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
});

test('producto protegido rechaza creación sin token', async () => {
  const { response, body } = await request('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
});

test('perfil rechaza cabecera Bearer vacía', async () => {
  const { response, body } = await request('/api/auth/profile', {
    headers: { Authorization: 'Bearer ' }
  });

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
});
