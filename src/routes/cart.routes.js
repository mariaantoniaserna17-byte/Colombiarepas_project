const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');

// Valida carrito, toppings seleccionados, stock y calcula subtotales en tiempo real
router.post('/validate', cartController.validateCart);

module.exports = router;

