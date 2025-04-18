const passport = require("passport");
const User = require("../models/User");
const config = require("../config");

// Load all OAuth strategies
const configureStrategies = require("../strategies");

// Serialize user for the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Initialize all configured OAuth strategies
configureStrategies(passport);

// Export the configured passport instance
module.exports = passport;
