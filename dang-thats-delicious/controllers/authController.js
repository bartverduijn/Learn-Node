const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');


exports.login = passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: 'Failed Login!',
  successRedirect: '/',
  successFlash: 'You are now logged in!',
});

exports.logout = (req, res) => {
  req.logout();
  req.flash('success', 'You are now logged out! 👋');
  res.redirect('/');
};

exports.isLoggedIn = (req, res, next) => {
  // 1. check if user is authenticated
  if (req.isAuthenticated()) {
    next(); // visitor is logged in
    return;
  }

  req.flash('error', 'Oops! You must be logged in to do that!');
  res.redirect('/login');
};

exports.forgot = async (req, res) => {
  // 1. See if user with that email exists
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash('error', 'No account with that email exists.');
    return res.redirect('/login');
  }
  // 2. Set reset tokens and expiry on their account
  user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
  await user.save();
  // 3. Send them an email with that token
  const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
  await mail.send({
    user,
    subject: 'Password Reset',
    resetURL,
    filename: 'password-reset',
  });
  req.flash('success', 'You have been emailed a password reset link.');
  // 4. redirect to login page
  res.redirect('/login');
};

exports.reset = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() } // check whether the hour already expires (gt = greter than)
  });

  // If the token does not exist or is already expired
  if (!user) {
    req.flash('error', 'Password reset is invalid or has expired.');
    return res.redirect('/login');
  }
  // If there is a user with that token and it did not expire yet, show the reset password form
  res.render('reset', { title: 'Reset your Password' });
};

exports.confirmedPasswords = (req, res, next) => {
  if (req.body.password === req.body['password-confirm']) {
    next(); // keep going if they are the same
    return;
  }
  req.flash('error', 'Passwords do not match.');
  res.redirect('back');
};

exports.update = async (req, res) => {
  // 1. Check if the token is still not expired
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    req.flash('error', 'Password reset is invalid or has expired.');
    return res.redirect('/login');
  }

  // 2. Reset the password and delete the reset password token and expiring time
  const setPassword = promisify(user.setPassword, user);
  await setPassword(req.body.password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  const updatedUser = await user.save();

  // 3. Log the user in
  await req.login(updatedUser);
  req.flash('success', '💃 Nice! Your password has been reset. You are now logged in!');
  res.redirect('/');
};
