const MicrosoftStrategy = require("passport-azure-ad").OIDCStrategy;
const User = require("../models/User");
const config = require("../config");

/**
 * Configure Microsoft OAuth authentication strategy
 *
 * @param {Object} passport - Passport.js instance
 * @returns {Object} - Configured Microsoft strategy
 */
module.exports = (passport) => {
  const microsoftStrategy = new MicrosoftStrategy(
    {
      identityMetadata: `https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration`,
      clientID: config.oauth.azure.clientID,
      clientSecret: config.oauth.azure.clientSecret,
      responseType: "code id_token",
      responseMode: "form_post",
      redirectUrl: `${config.urls.base}/auth/microsoft/callback`,
      allowHttpForRedirectUrl: config.server.env !== "production",
      scope: ["profile", "email", "openid"],
      passReqToCallback: true,
    },
    async (
      req,
      iss,
      sub,
      profile,
      jwtClaims,
      accessToken,
      refreshToken,
      done
    ) => {
      try {
        // Log raw provider data
        console.log("========== MICROSOFT AUTH DATA ==========");
        console.log("Raw profile:", JSON.stringify(profile, null, 2));
        console.log("JWT Claims:", JSON.stringify(jwtClaims, null, 2));
        console.log("Access Token:", accessToken);
        console.log("Refresh Token:", refreshToken);
        console.log("Issuer:", iss);
        console.log("Subject:", sub);
        console.log("=========================================");

        // Extract profile information from claims
        const email =
          profile._json.email ||
          jwtClaims.email ||
          jwtClaims.preferred_username;
        // Microsoft/AAD generally only provides verified emails
        const emailVerified = !!email;
        const name =
          profile.displayName || jwtClaims.name || email.split("@")[0];
        // There's no standard photo in Microsoft profile, we could use a default
        const profilePhoto = null;

        // Use the sub (subject) claim as the unique ID
        const providerId = sub;

        // If user is already logged in, link this account
        if (req.user) {
          // User is logged in, check if this Microsoft account is already linked to another user
          const existingMicrosoftUser = await User.findOne({
            "providers.provider": "microsoft",
            "providers.providerId": providerId,
          });

          if (
            existingMicrosoftUser &&
            existingMicrosoftUser._id.toString() !== req.user._id.toString()
          ) {
            return done(null, false, {
              message:
                "This Microsoft account is already linked to another user.",
            });
          }

          // Check if this provider is already linked to this user
          const microsoftLinked = req.user.providers.some(
            (p) => p.provider === "microsoft" && p.providerId === providerId
          );

          if (!microsoftLinked) {
            // Add this provider to the user's providers
            req.user.providers.push({
              provider: "microsoft",
              providerId: providerId,
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

        // User is not logged in, try to find existing user with this Microsoft ID
        let user = await User.findOne({
          "providers.provider": "microsoft",
          "providers.providerId": providerId,
        });

        if (user) {
          return done(null, user);
        }

        // No user found with this Microsoft ID, check for a user with the same email
        if (email && emailVerified) {
          user = await User.findOne({ email });

          if (user) {
            // Add Microsoft as a login provider to this existing user
            user.providers.push({
              provider: "microsoft",
              providerId: providerId,
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
          email: email || `user-${providerId}@microsoft.account`, // Fallback if no email
          emailVerified: emailVerified,
          providers: [
            {
              provider: "microsoft",
              providerId: providerId,
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

  passport.use(microsoftStrategy);
  return microsoftStrategy;
};
