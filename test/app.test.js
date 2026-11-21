const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return { response, body };
}

test('health check responde correctamente', async () => {
  const { response, body } = await request('/api/health');

  assert.equal(response.status, 200);
  assert.equal(body.status, 'OK');
  assert.equal(body.servicio, 'Arepas E-Commerce Backend');
  assert.ok(body.timestamp);
});

test('ruta API inexistente devuelve 404 JSON', async () => {
  const { response, body } = await request('/api/no-existe');

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.match(body.message, /Ruta no encontrada/);
});

test('la página principal se sirve como archivo estático', async () => {
  const { response, body } = await request('/');

  assert.equal(response.status, 200);
  assert.match(body, /<!DOCTYPE html>/i);
});

test('registro rechaza datos obligatorios incompletos', async () => {
  const { response, body } = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'prueba@example.com' })
  });

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /obligatorios/);
});

test('login rechaza datos obligatorios incompletos', async () => {
  const { response, body } = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /requeridos/);
});

test('perfil protegido rechaza petición sin token', async () => {
  const { response, body } = await request('/api/auth/profile');

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.match(body.message, /Token no proporcionado/);
});

test('checkout protegido rechaza petición sin token', async () => {
  const { response, body } = await request('/api/orders/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.match(body.message, /Token no proporcionado/);
});
