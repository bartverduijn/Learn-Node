const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const reviewController = require('../controllers/reviewController');

const { catchErrors } = require('../handlers/errorHandlers');

// STORES (is also the homepage) + PAGINATION
router.get('/', catchErrors(storeController.getStores));
router.get('/stores', catchErrors(storeController.getStores));
router.get('/stores/page/:page', catchErrors(storeController.getStores));

// ADD OR EDIT STORE
router.get('/add', authController.isLoggedIn, storeController.addStore);
router.post('/add',
  storeController.upload,
  catchErrors(storeController.resize),
  catchErrors(storeController.createStore)
);
router.post('/add/:id',
  storeController.upload,
  catchErrors(storeController.resize),
  catchErrors(storeController.updateStore)
);
router.get('/stores/:id/edit', catchErrors(storeController.editStore));

// INDIVIDUAL STORE VIEWS
router.get('/store/:slug', catchErrors(storeController.getStoreBySlug));

// TAGS
router.get('/tags', catchErrors(storeController.getStoresByTag));
router.get('/tags/:tag', catchErrors(storeController.getStoresByTag));

// RESET and LOGIN
router.get('/register', userController.registerForm);
// 1. Validate registration data
// 2. Register user
// 3. Log user in
router.post('/register',
  userController.validateRegister,
  catchErrors(userController.register),
  authController.login
);
router.get('/login', userController.loginForm);
router.post('/login', authController.login);

// LOGOUT
router.get('/logout', authController.logout);

// ACCOUNT
router.get('/account', authController.isLoggedIn, userController.account);
router.post('/account', catchErrors(userController.updateAccount));

// RESET PASSWORD
router.post('/account/forgot', catchErrors(authController.forgot));
router.get('/account/reset/:token', catchErrors(authController.reset));
router.post('/account/reset/:token',
  authController.confirmedPasswords,
  catchErrors(authController.update)
);

// MAP
router.get('/map', storeController.mapPage);

// HEARTS
router.get('/hearts',
  authController.isLoggedIn,
  catchErrors(storeController.getHearts)
);

// REVIEWS
router.post('/reviews/:id',
  authController.isLoggedIn,
  catchErrors(reviewController.addReview)
);

// TOP
router.get('/top', catchErrors(storeController.getTopStores));

/*
  API
*/

router.get('/api/search', catchErrors(storeController.searchStores));
router.get('/api/stores/near', catchErrors(storeController.mapStores));
router.post('/api/stores/:id/heart', catchErrors(storeController.heartStore));


module.exports = router;
