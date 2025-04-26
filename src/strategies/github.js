const GitHubStrategy = require("passport-github").Strategy;
const User = require("../models/User");
const config = require("../config");
const axios = require("axios");

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
        // Log raw provider data
        console.log("========== GITHUB AUTH DATA ==========");
        console.log("Raw profile:", JSON.stringify(profile, null, 2));
        console.log("Access Token:", accessToken);
        console.log("Refresh Token:", refreshToken);
        console.log("======================================");

        console.log(
          "Authentication state - isAuthenticated:",
          req.isAuthenticated()
        );
        if (req.user) {
          console.log("Current user:", req.user._id, req.user.email);
        }

        // Fetch user emails from GitHub API
        let email = null;
        let emailVerified = false;
        try {
          const response = await axios.get(
            "https://api.github.com/user/emails",
            {
              headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/vnd.github.v3+json",
              },
            }
          );

          console.log(
            "GitHub Emails Response:",
            JSON.stringify(response.data, null, 2)
          );

          // Find primary email or first verified email
          const emails = response.data;
          const primaryEmail = emails.find((e) => e.primary);
          const verifiedEmail = emails.find((e) => e.verified);

          if (primaryEmail) {
            email = primaryEmail.email;
            emailVerified = primaryEmail.verified;
          } else if (verifiedEmail) {
            email = verifiedEmail.email;
            emailVerified = true;
          } else if (emails.length > 0) {
            email = emails[0].email;
            emailVerified = emails[0].verified;
          }

          console.log("Extracted email info:", { email, emailVerified });
        } catch (error) {
          console.error("Error fetching GitHub emails:", error);
        }

        const name = profile.displayName || profile.username || "GitHub User";
        const profilePhoto = profile.photos && profile.photos[0]?.value;

        // If user is already logged in, link this account
        if (req.user) {
          console.log(
            "User is already logged in, linking account to:",
            req.user.email
          );

          // User is logged in, check if this GitHub account is already linked to another user
          const existingGitHubUser = await User.findOne({
            "providers.provider": "github",
            "providers.providerId": profile.id,
          });

          if (existingGitHubUser) {
            console.log(
              "Found existing GitHub user:",
              existingGitHubUser._id,
              existingGitHubUser.email
            );
          }

          if (
            existingGitHubUser &&
            existingGitHubUser._id.toString() !== req.user._id.toString()
          ) {
            console.log("GitHub account already linked to another user");
            return done(null, false, {
              message: "This GitHub account is already linked to another user.",
            });
          }

          // Check if this provider is already linked to this user
          const githubLinked = req.user.providers.some(
            (p) => p.provider === "github" && p.providerId === profile.id
          );

          console.log("GitHub already linked to current user:", githubLinked);

          if (!githubLinked) {
            // Add this provider to the user's providers
            console.log("Adding GitHub provider to user:", req.user.email);
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
            console.log("Provider added successfully");
          }

          return done(null, req.user);
        }

        console.log("User is not logged in, checking for existing accounts");

        // User is not logged in, try to find existing user with this GitHub ID
        let user = await User.findOne({
          "providers.provider": "github",
          "providers.providerId": profile.id,
        });

        if (user) {
          console.log("Found user by GitHub ID:", user._id, user.email);
          return done(null, user);
        }

        // No user found with this GitHub ID, check for a user with the same email
        console.log("No user with this GitHub ID, checking by email:", email);

        if (email && emailVerified) {
          console.log("Looking for user with email:", email);
          user = await User.findOne({ email });

          if (user) {
            console.log(
              "Found existing user with matching email:",
              user._id,
              user.email
            );
            console.log(
              "Current providers:",
              user.providers.map((p) => p.provider)
            );

            // Add GitHub as a login provider to this existing user
            console.log("Adding GitHub as provider to existing user");
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

            try {
              await user.save();
              console.log("Provider added successfully to existing user");
              return done(null, user);
            } catch (saveError) {
              console.error("Error saving user with new provider:", saveError);
              return done(saveError);
            }
          } else {
            console.log("No user found with email:", email);
          }
        } else {
          console.log("Email not verified or not available for matching:", {
            email,
            emailVerified,
          });
        }

        // No matching user found, create a new user
        console.log("Creating new user with email:", email);
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

        try {
          await newUser.save();
          console.log(
            "New user created successfully:",
            newUser._id,
            newUser.email
          );
          return done(null, newUser);
        } catch (createError) {
          console.error("Error creating new user:", createError);
          return done(createError);
        }
      } catch (error) {
        console.error("Strategy global error:", error);
        return done(error);
      }
    }
  );

  passport.use(githubStrategy);
  return githubStrategy;
};
