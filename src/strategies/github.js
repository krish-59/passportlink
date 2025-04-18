const GitHubStrategy = require("passport-github").Strategy;
const User = require("../models/User");
const config = require("../config");

/**
 * Configure GitHub OAuth authentication strategy
 *
 * @param {Object} passport - Passport.js instance
 * @returns {Object} - Configured GitHub strategy
 */
module.exports = (passport) => {
  const githubStrategy = new GitHubStrategy(
    {
      clientID: config.oauth.github.clientID,
      clientSecret: config.oauth.github.clientSecret,
      callbackURL: `${config.urls.base}/auth/github/callback`,
      scope: ["user:email"],
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Extract profile information
        // GitHub may not provide email in profile, but it should be in emails array
        const email = profile.emails && profile.emails[0]?.value;
        // GitHub doesn't provide email verification status directly
        // We assume the primary email is verified (GitHub usually returns verified emails first)
        const emailVerified = !!email;
        const name = profile.displayName || profile.username || "GitHub User";
        const profilePhoto = profile.photos && profile.photos[0]?.value;

        // If user is already logged in, link this account
        if (req.user) {
          // User is logged in, check if this GitHub account is already linked to another user
          const existingGitHubUser = await User.findOne({
            "providers.provider": "github",
            "providers.providerId": profile.id,
          });

          if (
            existingGitHubUser &&
            existingGitHubUser._id.toString() !== req.user._id.toString()
          ) {
            return done(null, false, {
              message: "This GitHub account is already linked to another user.",
            });
          }

          // Check if this provider is already linked to this user
          const githubLinked = req.user.providers.some(
            (p) => p.provider === "github" && p.providerId === profile.id
          );

          if (!githubLinked) {
            // Add this provider to the user's providers
            req.user.providers.push({
              provider: "github",
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

        // User is not logged in, try to find existing user with this GitHub ID
        let user = await User.findOne({
          "providers.provider": "github",
          "providers.providerId": profile.id,
        });

        if (user) {
          return done(null, user);
        }

        // No user found with this GitHub ID, check for a user with the same email
        if (email && emailVerified) {
          user = await User.findOne({ email });

          if (user) {
            // Add GitHub as a login provider to this existing user
            user.providers.push({
              provider: "github",
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
          email: email || `user-${profile.id}@github.account`, // Fallback if no email
          emailVerified: emailVerified,
          providers: [
            {
              provider: "github",
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

  passport.use(githubStrategy);
  return githubStrategy;
};
