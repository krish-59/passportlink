const FacebookStrategy = require("passport-facebook").Strategy;
const User = require("../models/User");
const config = require("../config");

/**
 * Configure Facebook OAuth authentication strategy
 *
 * @param {Object} passport - Passport.js instance
 * @returns {Object} - Configured Facebook strategy
 */
module.exports = (passport) => {
  const facebookStrategy = new FacebookStrategy(
    {
      clientID: config.oauth.facebook.clientID,
      clientSecret: config.oauth.facebook.clientSecret,
      callbackURL: `${config.urls.base}/auth/facebook/callback`,
      profileFields: ["id", "displayName", "name", "photos", "email"],
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Log raw provider data
        console.log("========== FACEBOOK AUTH DATA ==========");
        console.log("Raw profile:", JSON.stringify(profile, null, 2));
        console.log("Access Token:", accessToken);
        console.log("Refresh Token:", refreshToken);
        console.log("======================================");

        // Extract profile information
        const email = profile.emails && profile.emails[0]?.value;
        // Facebook generally returns only verified emails
        const emailVerified = !!email;
        const name =
          profile.displayName ||
          `${profile.name.givenName} ${profile.name.familyName}` ||
          "Facebook User";
        const profilePhoto = profile.photos && profile.photos[0]?.value;

        // If user is already logged in, link this account
        if (req.user) {
          // User is logged in, check if this Facebook account is already linked to another user
          const existingFacebookUser = await User.findOne({
            "providers.provider": "facebook",
            "providers.providerId": profile.id,
          });

          if (
            existingFacebookUser &&
            existingFacebookUser._id.toString() !== req.user._id.toString()
          ) {
            return done(null, false, {
              message:
                "This Facebook account is already linked to another user.",
            });
          }

          // Check if this provider is already linked to this user
          const facebookLinked = req.user.providers.some(
            (p) => p.provider === "facebook" && p.providerId === profile.id
          );

          if (!facebookLinked) {
            // Add this provider to the user's providers
            req.user.providers.push({
              provider: "facebook",
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

        // User is not logged in, try to find existing user with this Facebook ID
        let user = await User.findOne({
          "providers.provider": "facebook",
          "providers.providerId": profile.id,
        });

        if (user) {
          return done(null, user);
        }

        // No user found with this Facebook ID, check for a user with the same email
        if (email && emailVerified) {
          user = await User.findOne({ email });

          if (user) {
            // Add Facebook as a login provider to this existing user
            user.providers.push({
              provider: "facebook",
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
          email: email || `user-${profile.id}@facebook.account`, // Fallback if no email
          emailVerified: emailVerified,
          providers: [
            {
              provider: "facebook",
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

  passport.use(facebookStrategy);
  return facebookStrategy;
};
