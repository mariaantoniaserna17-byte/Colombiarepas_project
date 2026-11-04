const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const productRoutes = require('./product.routes');
const cartRoutes = require('./cart.routes');
const orderRoutes = require('./order.routes');
const reviewRoutes = require('./review.routes');
const reportRoutes = require('./report.routes');

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/reports', reportRoutes);

router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    servicio: 'Arepas E-Commerce Backend',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

