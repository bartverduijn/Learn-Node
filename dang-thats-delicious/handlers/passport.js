const passport = require('passport');
const mongoose = require('mongoose');
const User = mongoose.model('User');

passport.use(User.createStrategy());

// what information do we want on each request for a user?
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
