const test = require('node:test');
const assert = require('node:assert/strict');
const { checkRole } = require('../src/middlewares/role.middleware');
const { verifyToken } = require('../src/middlewares/auth.middleware');
const { calculateCartTotals, calculateItemTotal } = require('../src/utils/pricing');
const { success, error } = require('../src/utils/responseHandler');

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test('calcula subtotal por cantidad y adicionales', () => {
  assert.equal(calculateItemTotal(8000, 2500, 2), 21000);
});

test('calcula IVA y costo de envío por defecto', () => {
  const totals = calculateCartTotals(100000, {});

  assert.equal(totals.ivaPorcentaje, 0.19);
  assert.equal(totals.impuestoIVA, 19000);
  assert.equal(totals.costoEnvio, 5000);
  assert.equal(totals.total, 124000);
});

test('respeta IVA y envío configurados', () => {
  const totals = calculateCartTotals(100000, {
    IVA_PORCENTAJE: '0.10',
    COSTO_ENVIO: '3000'
  });

  assert.equal(totals.ivaPorcentaje, 0.10);
  assert.equal(totals.impuestoIVA, 10000);
  assert.equal(totals.costoEnvio, 3000);
  assert.equal(totals.total, 113000);
});

test('tolerancia segura ante valores numéricos inválidos', () => {
  assert.equal(calculateItemTotal('texto', null, -1), 0);
  assert.deepEqual(
    calculateCartTotals('texto', {}),
    {
      ivaPorcentaje: 0.19,
      impuestoIVA: 0,
      costoEnvio: 5000,
      total: 5000
    }
  );
});

test('checkRole permite al administrador', () => {
  const res = createMockResponse();
  let nextCalled = false;

  checkRole(['Administrador'])(
    { user: { rol: 'Administrador' } },
    res,
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, true);
});

test('checkRole rechaza cliente en una ruta administrativa', () => {
  const res = createMockResponse();
  let nextCalled = false;

  checkRole(['Administrador'])(
    { user: { rol: 'Cliente' } },
    res,
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.success, false);
});

test('checkRole rechaza usuario sin adjuntar identidad', () => {
  const res = createMockResponse();

  checkRole(['Administrador'])({}, res, () => {});

  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.success, false);
});

test('verifyToken rechaza token Bearer inválido', async () => {
  const res = createMockResponse();
  let nextCalled = false;

  await verifyToken(
    { headers: { authorization: 'Bearer token-invalido' } },
    res,
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.message, /inválido/i);
});

test('responseHandler genera respuesta exitosa y de error', () => {
  const successRes = createMockResponse();
  const errorRes = createMockResponse();

  success(successRes, { id: 1 }, 'Creado', 201);
  error(errorRes, 'Datos inválidos', 400);

  assert.equal(successRes.statusCode, 201);
  assert.equal(successRes.payload.data.id, 1);
  assert.equal(errorRes.statusCode, 400);
  assert.equal(errorRes.payload.message, 'Datos inválidos');
});
