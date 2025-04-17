const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const BearerStrategy = require("passport-azure-ad").BearerStrategy;
const bcrypt = require("bcryptjs");
const { User } = require("../models");
const config = require("../config");

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

// Local Strategy
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
          return done(null, false, { message: "Incorrect email or password" });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Incorrect email or password" });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// JWT Strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.jwt.secret,
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await User.findByPk(payload.id);
      if (!user) {
        return done(null, false);
      }
      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  })
);

// Azure AD Strategy
const azureOptions = {
  identityMetadata: `https://login.microsoftonline.com/${config.oauth.azure.tenantId}/v2.0/.well-known/openid-configuration`,
  clientID: config.oauth.azure.clientId,
  validateIssuer: true,
  passReqToCallback: false,
  loggingLevel: "info",
};

passport.use(
  new BearerStrategy(azureOptions, (token, done) => {
    // For Azure AD, we don't need to verify the token manually as it's done by the strategy
    // We just need to return the token's claims as the user
    return done(null, token, token);
  })
);

module.exports = passport;
