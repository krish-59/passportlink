const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
const config = require("../config");

/**
 * Configure Google OAuth 2.0 authentication strategy
 *
 * @param {Object} passport - Passport.js instance
 * @returns {Object} - Configured Google strategy
 */
module.exports = (passport) => {
  const googleStrategy = new GoogleStrategy(
    {
      clientID: config.oauth.google.clientID,
      clientSecret: config.oauth.google.clientSecret,
      callbackURL: `${config.urls.base}/auth/google/callback`,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Extract profile information
        const email = profile.emails && profile.emails[0]?.value;
        const emailVerified =
          (profile.emails && profile.emails[0]?.verified) || false;
        const name =
          profile.displayName ||
          (profile.name
            ? `${profile.name.givenName} ${profile.name.familyName}`
            : "User");
        const profilePhoto = profile.photos && profile.photos[0]?.value;

        // If user is already logged in, link this account
        if (req.user) {
          // User is logged in, check if this Google account is already linked to another user
          const existingGoogleUser = await User.findOne({
            "providers.provider": "google",
            "providers.providerId": profile.id,
          });

          if (
            existingGoogleUser &&
            existingGoogleUser._id.toString() !== req.user._id.toString()
          ) {
            // This Google account is already linked to another user
            return done(null, false, {
              message: "This Google account is already linked to another user.",
            });
          }

          // Check if this provider is already linked to this user
          const googleLinked = req.user.providers.some(
            (p) => p.provider === "google" && p.providerId === profile.id
          );

          if (!googleLinked) {
            // Add this provider to the user's providers
            req.user.providers.push({
              provider: "google",
              providerId: profile.id,
              displayName: name,
              email: email,
              profilePhoto: profilePhoto,
              accessToken,
              refreshToken,
              linkedAt: new Date(),
            });

            await req.user.save();
          }

          return done(null, req.user);
        }

        // User is not logged in, try to find existing user with this Google ID
        let user = await User.findOne({
          "providers.provider": "google",
          "providers.providerId": profile.id,
        });

        if (user) {
          return done(null, user);
        }

        // No user found with this Google ID, check for a user with the same email
        // Only if the email is verified by Google (to prevent account hijacking)
        if (email && emailVerified) {
          user = await User.findOne({ email });

          if (user) {
            // Add Google as a login provider to this existing user
            user.providers.push({
              provider: "google",
              providerId: profile.id,
              displayName: name,
              email: email,
              profilePhoto: profilePhoto,
              accessToken,
              refreshToken,
              linkedAt: new Date(),
            });

            await user.save();
            return done(null, user);
          }
        }

        // No matching user found, create a new user
        const newUser = new User({
          name: name,
          email: email || `user-${profile.id}@google.account`, // Fallback if no email
          emailVerified: emailVerified,
          providers: [
            {
              provider: "google",
              providerId: profile.id,
              displayName: name,
              email: email,
              profilePhoto: profilePhoto,
              accessToken,
              refreshToken,
              linkedAt: new Date(),
            },
          ],
        });

        await newUser.save();
        return done(null, newUser);
      } catch (error) {
        return done(error);
      }
    }
  );

  passport.use(googleStrategy);
  return googleStrategy;
};
