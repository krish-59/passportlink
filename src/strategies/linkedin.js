const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
const User = require("../models/User");
const config = require("../config");
const axios = require("axios");

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
      passReqToCallback: true,
      state: true,
      authorizationURL: "https://www.linkedin.com/oauth/v2/authorization",
      tokenURL: "https://www.linkedin.com/oauth/v2/accessToken",
      profileURL: "https://api.linkedin.com/v2/userinfo",
      scope: ["openid", "profile", "email"],
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        console.log("========== LINKEDIN AUTH FLOW ==========");
        console.log(
          "Received access token from OAuth flow:",
          accessToken ? "Valid token received" : "No token received"
        );

        if (!accessToken) {
          throw new Error("No access token received from LinkedIn");
        }

        console.log("Making request to LinkedIn userinfo endpoint");
        // Fetch user profile directly from LinkedIn's userinfo endpoint
        const userInfoResponse = await axios.get(
          "https://api.linkedin.com/v2/userinfo",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        console.log(
          "LinkedIn userinfo response status:",
          userInfoResponse.status
        );
        const linkedinProfile = userInfoResponse.data;

        // Log raw provider data
        console.log("========== LINKEDIN AUTH DATA ==========");
        console.log("Raw profile:", JSON.stringify(linkedinProfile, null, 2));
        console.log("Access Token:", accessToken);
        console.log("Refresh Token:", refreshToken);
        console.log("======================================");

        // Extract profile information from userinfo endpoint
        const email = linkedinProfile.email;
        const emailVerified = linkedinProfile.email_verified || false;
        const name =
          linkedinProfile.name ||
          `${linkedinProfile.given_name || ""} ${
            linkedinProfile.family_name || ""
          }`.trim() ||
          "LinkedIn User";
        const profilePhoto = linkedinProfile.picture;
        const linkedinId = linkedinProfile.sub;

        // If user is already logged in, link this account
        if (req.user) {
          // User is logged in, check if this LinkedIn account is already linked to another user
          const existingLinkedInUser = await User.findOne({
            "providers.provider": "linkedin",
            "providers.providerId": linkedinId,
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
            (p) => p.provider === "linkedin" && p.providerId === linkedinId
          );

          if (!linkedinLinked) {
            // Add this provider to the user's providers
            req.user.providers.push({
              provider: "linkedin",
              providerId: linkedinId,
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
          "providers.providerId": linkedinId,
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
              providerId: linkedinId,
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
          email: email || `user-${linkedinId}@linkedin.account`, // Fallback if no email
          emailVerified: emailVerified,
          providers: [
            {
              provider: "linkedin",
              providerId: linkedinId,
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
        console.error("========== LINKEDIN AUTH ERROR ==========");
        console.error("Error message:", error.message);

        if (error.response) {
          console.error("Response status:", error.response.status);
          console.error(
            "Response headers:",
            JSON.stringify(error.response.headers, null, 2)
          );
          console.error(
            "Response data:",
            JSON.stringify(error.response.data, null, 2)
          );
        } else if (error.request) {
          console.error(
            "No response received. Request details:",
            error.request
          );
        } else {
          console.error("Error details:", error);
        }
        console.error("=========================================");

        return done(error);
      }
    }
  );

  passport.use(linkedinStrategy);
  return linkedinStrategy;
};
