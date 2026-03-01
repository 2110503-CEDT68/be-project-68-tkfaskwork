const express = require('express');
const { getRecommendation } = require('../controllers/recommend');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, getRecommendation);

module.exports = router;
