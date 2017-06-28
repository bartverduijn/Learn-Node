const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');

exports.loginForm = (req, res) => {
  res.render('login', { title: 'Login Form' });
};

exports.registerForm = (req, res) => {
  res.render('register', { title: 'Register' });
};

exports.validateRegister = (req, res, next) => {
   // methods from expressValidator in app.js
  req.sanitizeBody('name');
  req.checkBody('name', 'You must supply a name.').notEmpty();

  req.checkBody('email', 'You must supply an email address.').isEmail();
  req.sanitizeBody('email').normalizeEmail({
    remove_dots: false,
    remove_extension: false,
    gmail_remove_subaddress: false,
  });

  req.checkBody('password', 'Password cannot be blank.').notEmpty();
  req.checkBody('password-confirm', 'Confirmed password cannot be blank.').notEmpty();
  req.checkBody('password-confirm', 'Oops! Your passwords do not match.').equals(req.body.password);

  const errors = req.validationErrors();
  if (errors) {
    req.flash('error', errors.map(err => err.msg));
    // Pass body to prepopulate the fields the user already filled in
    res.render('register', { title: 'Register', body: req.body, flashes: req.flash() });
    return;
  }

  next(); // There were no errors :)
};

exports.register = async (req, res, next) => {
  const user = new User({ email: req.body.email, name: req.body.name });
  // .register() imported by passportLocalMongoose in model
  const register = promisify(User.register, User);
  await register(user, req.body.password);

  next(); // user is registered
};

exports.account = (req, res) => {
  res.render('account', { title: 'Edit your Account' });
};

exports.updateAccount = async (req, res) => {
  const updates = {
    name: req.body.name,
    email: req.body.email,
  };

  const user = await User.findOneAndUpdate(
    { _id: req.user._id }, // query
    { $set: updates }, // update
    { new: true, runValidators: true, context: 'query' } // options
  );

  req.flash('success', 'Updated the profile!');
  res.redirect('back'); // send back to where the user came from
};
