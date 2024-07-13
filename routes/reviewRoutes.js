const express = require('express');
const reviewController = require('../controllers/reviewController');
const authController = require('./../controllers/authController');

const router = express.Router();
router.use(express.json());

router.route('/').get(reviewController.getAllReviews);
router
  .route('/')
  .post(
    authController.protect,
    authController.restrictTo('user'),
    reviewController.createReview
  );


module.exports = router;
