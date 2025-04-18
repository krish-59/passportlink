const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
const User = require("../models/User");
const config = require("../config");

/**
 * Configure LinkedIn OAuth authentication strategy
 *
 * @param {Object} passport - Passport.js instance
 * @returns {Object} - Configured LinkedIn strategy
 */
module.exports = (passport) => {
  const linkedinStrategy = new LinkedInStrategy(
    {
      clientID: config.oauth.linkedin.clientID,
      clientSecret: config.oauth.linkedin.clientSecret,
      callbackURL: `${config.urls.base}/auth/linkedin/callback`,
      scope: ["r_emailaddress", "r_liteprofile"],
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Extract profile information
        const email = profile.emails && profile.emails[0]?.value;
        // LinkedIn should provide verified emails only
        const emailVerified = !!email;
        const name =
          profile.displayName ||
          `${profile.name.givenName} ${profile.name.familyName}` ||
          "LinkedIn User";
        const profilePhoto = profile.photos && profile.photos[0]?.value;

        // If user is already logged in, link this account
        if (req.user) {
          // User is logged in, check if this LinkedIn account is already linked to another user
          const existingLinkedInUser = await User.findOne({
            "providers.provider": "linkedin",
            "providers.providerId": profile.id,
          });

          if (
            existingLinkedInUser &&
            existingLinkedInUser._id.toString() !== req.user._id.toString()
          ) {
            return done(null, false, {
              message:
                "This LinkedIn account is already linked to another user.",
            });
          }

          // Check if this provider is already linked to this user
          const linkedinLinked = req.user.providers.some(
            (p) => p.provider === "linkedin" && p.providerId === profile.id
          );

          if (!linkedinLinked) {
            // Add this provider to the user's providers
            req.user.providers.push({
              provider: "linkedin",
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

        // User is not logged in, try to find existing user with this LinkedIn ID
        let user = await User.findOne({
          "providers.provider": "linkedin",
          "providers.providerId": profile.id,
        });

        if (user) {
          return done(null, user);
        }

        // No user found with this LinkedIn ID, check for a user with the same email
        if (email && emailVerified) {
          user = await User.findOne({ email });

          if (user) {
            // Add LinkedIn as a login provider to this existing user
            user.providers.push({
              provider: "linkedin",
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
          email: email || `user-${profile.id}@linkedin.account`, // Fallback if no email
          emailVerified: emailVerified,
          providers: [
            {
              provider: "linkedin",
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

  passport.use(linkedinStrategy);
  return linkedinStrategy;
};
