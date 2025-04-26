const express = require("express");
const passport = require("passport");
const config = require("../config");

const router = express.Router();

/**
 * Error handler middleware for auth routes
 */
const handleError = (err, res) => {
  console.error("Auth Error:", err);
  const statusCode = err.status || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal server error" : message,
    message: config.server.env === "development" ? err.stack : undefined,
  });
};

/**
 * Check if a strategy is configured
 * @param {string} provider - Name of the OAuth provider
 * @returns {function} - Middleware that checks if the provider is configured
 */
const checkProviderEnabled = (provider) => {
  return (req, res, next) => {
    try {
      if (
        !process.env[`${provider.toUpperCase()}_CLIENT_ID`] ||
        !process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]
      ) {
        const error = new Error(
          `The ${provider} authentication provider is not configured.`
        );
        error.status = 404;
        throw error;
      }
      next();
    } catch (err) {
      handleError(err, res);
    }
  };
};

/**
 * Wrapper for passport authenticate/authorize
 * @param {string} provider - OAuth provider name
 * @param {Object} options - Authentication options
 * @param {boolean} isLink - Whether this is a linking request
 */
const handlePassportAuth = (provider, options, isLink = false) => {
  return (req, res, next) => {
    try {
      const authMethod = isLink ? passport.authorize : passport.authenticate;
      authMethod(provider, options)(req, res, (err) => {
        if (err) {
          throw err;
        }
        next();
      });
    } catch (err) {
      handleError(err, res);
    }
  };
};

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: Authentication endpoints for OAuth providers
 *   - name: User
 *     description: User management endpoints
 */

/**
 * @swagger
 * /auth/{provider}:
 *   get:
 *     tags: [Authentication]
 *     summary: Initiate OAuth authentication with a provider
 *     description: Redirects the user to the provider's authorization page
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, github, facebook, microsoft, linkedin]
 *     responses:
 *       302:
 *         description: Redirect to provider's authorization page
 *       404:
 *         description: Provider not configured or not found
 */
const supportedProviders = ["google", "github", "facebook", "linkedin"];
supportedProviders.forEach((provider) => {
  router.get(
    `/${provider}`,
    checkProviderEnabled(provider),
    (req, res, next) => {
      try {
        const authOptions = {
          scope: getProviderScope(provider),
          state: true,
        };

        if (req.isAuthenticated()) {
          passport.authorize(provider, authOptions)(req, res, next);
        } else {
          passport.authenticate(provider, authOptions)(req, res, next);
        }
      } catch (err) {
        handleError(err, res);
      }
    }
  );
});

/**
 * Get the appropriate scope for each provider
 */
function getProviderScope(provider) {
  try {
    switch (provider) {
      case "google":
        return ["profile", "email"];
      case "github":
        return ["user:email"];
      case "facebook":
        return ["email", "public_profile"];
      case "microsoft":
        return ["profile", "email", "openid"];
      case "linkedin":
        return ["openid", "profile", "email"];
      default:
        return ["profile", "email"];
    }
  } catch (err) {
    console.error("Error getting provider scope:", err);
    return ["profile", "email"]; // Default scope
  }
}

/**
 * @swagger
 * /auth/{provider}/callback:
 *   get:
 *     tags: [Authentication]
 *     summary: OAuth callback from provider
 *     description: Handles the callback from the OAuth provider after authorization
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, github, facebook, microsoft, linkedin]
 *     responses:
 *       302:
 *         description: Redirect to frontend success/failure URL
 */
supportedProviders.forEach((provider) => {
  router.get(
    `/${provider}/callback`,
    checkProviderEnabled(provider),
    (req, res, next) => {
      try {
        const authOptions = {
          successRedirect: config.urls.frontend + "/auth/success",
          failureRedirect: config.urls.frontend + "/auth/failure",
        };

        if (req.isAuthenticated()) {
          console.log("========== AUTHENTICATED ==========");
          passport.authorize(provider, authOptions)(req, res, next);
        } else {
          console.log("========== NOT AUTHENTICATED ==========");

          // Special handling for LinkedIn due to API changes
          if (provider === "linkedin") {
            console.log("Using custom LinkedIn callback handler");
            const axios = require("axios");
            const qs = require("querystring");
            const User = require("../models/User");

            // Extract the authorization code from the callback URL
            const { code } = req.query;
            if (!code) {
              return res.redirect(config.urls.frontend + "/auth/failure");
            }

            // Exchange the code for an access token
            const exchangeCodeForToken = async () => {
              try {
                console.log("Exchanging code for token...");
                const tokenResponse = await axios.post(
                  "https://www.linkedin.com/oauth/v2/accessToken",
                  qs.stringify({
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: `${config.urls.base}/auth/linkedin/callback`,
                    client_id: config.oauth.linkedin.clientID,
                    client_secret: config.oauth.linkedin.clientSecret,
                  }),
                  {
                    headers: {
                      "Content-Type": "application/x-www-form-urlencoded",
                    },
                  }
                );

                const { access_token, expires_in } = tokenResponse.data;
                console.log("Token received:", access_token ? "YES" : "NO");

                // Fetch user profile from LinkedIn API
                console.log("Fetching user profile from LinkedIn...");
                const userInfoResponse = await axios.get(
                  "https://api.linkedin.com/v2/userinfo",
                  {
                    headers: {
                      Authorization: `Bearer ${access_token}`,
                    },
                  }
                );

                const profile = userInfoResponse.data;
                console.log(
                  "Profile data received:",
                  JSON.stringify(profile, null, 2)
                );

                // Extract profile information
                const linkedinId = profile.sub;
                const email = profile.email;
                const emailVerified = profile.email_verified || false;
                const name =
                  profile.name ||
                  `${profile.given_name || ""} ${
                    profile.family_name || ""
                  }`.trim() ||
                  "LinkedIn User";
                const profilePhoto = profile.picture;

                // Find or create user
                let user = await User.findOne({
                  "providers.provider": "linkedin",
                  "providers.providerId": linkedinId,
                });

                if (user) {
                  // Login the existing user
                  req.login(user, (err) => {
                    if (err) {
                      console.error("Login error:", err);
                      return res.redirect(
                        config.urls.frontend + "/auth/failure"
                      );
                    }
                    return res.redirect(config.urls.frontend + "/auth/success");
                  });
                  return;
                }

                // Check for existing user with same email
                if (email && emailVerified) {
                  user = await User.findOne({ email });

                  if (user) {
                    // Add LinkedIn provider to existing user
                    user.providers.push({
                      provider: "linkedin",
                      providerId: linkedinId,
                      displayName: name,
                      email: email,
                      profilePhoto: profilePhoto,
                      accessToken: access_token,
                      refreshToken: null,
                      linkedAt: new Date(),
                    });

                    await user.save();

                    // Login the user
                    req.login(user, (err) => {
                      if (err) {
                        console.error("Login error:", err);
                        return res.redirect(
                          config.urls.frontend + "/auth/failure"
                        );
                      }
                      return res.redirect(
                        config.urls.frontend + "/auth/success"
                      );
                    });
                    return;
                  }
                }

                // Create new user
                const newUser = new User({
                  name: name,
                  email: email || `user-${linkedinId}@linkedin.account`,
                  emailVerified: emailVerified,
                  providers: [
                    {
                      provider: "linkedin",
                      providerId: linkedinId,
                      displayName: name,
                      email: email,
                      profilePhoto: profilePhoto,
                      accessToken: access_token,
                      refreshToken: null,
                      linkedAt: new Date(),
                    },
                  ],
                });

                await newUser.save();

                // Login the new user
                req.login(newUser, (err) => {
                  if (err) {
                    console.error("Login error:", err);
                    return res.redirect(config.urls.frontend + "/auth/failure");
                  }
                  return res.redirect(config.urls.frontend + "/auth/success");
                });
              } catch (error) {
                console.error("LinkedIn OAuth Error:", error.message);
                if (error.response) {
                  console.error("Response status:", error.response.status);
                  console.error(
                    "Response data:",
                    JSON.stringify(error.response.data, null, 2)
                  );
                }
                return res.redirect(config.urls.frontend + "/auth/failure");
              }
            };

            // Execute the token exchange and profile fetch
            exchangeCodeForToken();
          } else {
            passport.authenticate(provider, authOptions)(req, res, next);
          }
        }
      } catch (err) {
        handleError(err, res);
      }
    }
  );
});

// Special case for Microsoft which might use form_post response mode
router.post(
  "/microsoft/callback",
  checkProviderEnabled("microsoft"),
  (req, res, next) => {
    try {
      const authOptions = {
        successRedirect: config.urls.frontend + "/auth/success",
        failureRedirect: config.urls.frontend + "/auth/failure",
      };

      if (req.isAuthenticated()) {
        passport.authorize("microsoft", authOptions)(req, res, next);
      } else {
        passport.authenticate("microsoft", authOptions)(req, res, next);
      }
    } catch (err) {
      handleError(err, res);
    }
  }
);

/**
 * @swagger
 * /auth/user:
 *   get:
 *     tags: [User]
 *     summary: Get the current authenticated user
 *     description: Returns the user information if authenticated
 *     responses:
 *       200:
 *         description: User information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/user", (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      const error = new Error("Not authenticated");
      error.status = 401;
      throw error;
    }

    // Don't send sensitive information like tokens
    const safeUser = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      emailVerified: req.user.emailVerified,
      providers: req.user.providers.map((p) => ({
        provider: p.provider,
        displayName: p.displayName,
        email: p.email,
        profilePhoto: p.profilePhoto,
        linkedAt: p.linkedAt,
      })),
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    };

    res.json(safeUser);
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout the current user
 *     description: Destroys the current session
 *     responses:
 *       200:
 *         description: Successfully logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Error during logout
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/logout", (req, res) => {
  console.log("Logging out");
  try {
    if (!req.isAuthenticated()) {
      return res.status(200).json({ message: "Not logged in" });
    }

    // Check Passport version by examining function signature
    // req.logout.length === 0 for Passport < 0.6.0
    // req.logout.length === 1 for Passport >= 0.6.0
    if (req.logout.length === 0) {
      // Old version of Passport (< 0.6.0)
      console.log("Using Passport < 0.6.0 logout method");
      req.logout();
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res
            .status(500)
            .json({ error: "Session destroy error", message: err.message });
        }
        res.clearCookie("connect.sid", { path: "/" });
        return res.status(200).json({ message: "Logged out successfully" });
      });
    } else {
      // New version of Passport (>= 0.6.0)
      console.log("Using Passport >= 0.6.0 logout method");
      req.logout((err) => {
        if (err) {
          console.error("Logout error:", err);
          return res
            .status(500)
            .json({ error: "Logout error", message: err.message });
        }
        req.session.destroy((err) => {
          if (err) {
            console.error("Session destroy error:", err);
            return res
              .status(500)
              .json({ error: "Session destroy error", message: err.message });
          }
          res.clearCookie("connect.sid", { path: "/" });
          return res.status(200).json({ message: "Logged out successfully" });
        });
      });
    }
  } catch (err) {
    console.error("Unhandled logout error:", err);
    return res.status(500).json({
      error: "Internal server error during logout",
      message: err.message,
    });
  }
});

/**
 * @swagger
 * /auth/unlink/{provider}:
 *   get:
 *     tags: [User]
 *     summary: Unlink a provider from the current user
 *     description: Removes the specified provider from the user's account
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, github, facebook, microsoft, linkedin]
 *     responses:
 *       200:
 *         description: Provider successfully unlinked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 providers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User/properties/providers/items'
 *       400:
 *         description: Cannot unlink the last provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Provider not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/unlink/:provider", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      const error = new Error("Not authenticated");
      error.status = 401;
      throw error;
    }

    const { provider } = req.params;

    if (!supportedProviders.includes(provider)) {
      const error = new Error("Provider not found");
      error.status = 404;
      throw error;
    }

    const providerIndex = req.user.providers.findIndex(
      (p) => p.provider === provider
    );

    if (providerIndex === -1) {
      const error = new Error(`No ${provider} account linked to this user`);
      error.status = 404;
      throw error;
    }

    if (req.user.providers.length <= 1) {
      const error = new Error("Cannot unlink the last provider");
      error.status = 400;
      error.details = "You must have at least one login method";
      throw error;
    }

    // Remove the provider and save
    req.user.providers.splice(providerIndex, 1);
    await req.user.save();

    res.json({
      message: `${provider} account unlinked successfully`,
      providers: req.user.providers.map((p) => ({
        provider: p.provider,
        displayName: p.displayName,
        email: p.email,
        profilePhoto: p.profilePhoto,
        linkedAt: p.linkedAt,
      })),
    });
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * @swagger
 * /auth/link/{provider}:
 *   get:
 *     tags: [User]
 *     summary: Start the process to link a new provider
 *     description: Redirects to the provider's authorization page for account linking
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, github, facebook, microsoft, linkedin]
 *     responses:
 *       302:
 *         description: Redirect to provider's authorization page
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Provider not found or not configured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/link/:provider", (req, res, next) => {
  try {
    if (!req.isAuthenticated()) {
      const error = new Error("Must be logged in to link accounts");
      error.status = 401;
      throw error;
    }

    const { provider } = req.params;

    if (!supportedProviders.includes(provider)) {
      const error = new Error("Provider not found");
      error.status = 404;
      throw error;
    }

    if (
      !process.env[`${provider.toUpperCase()}_CLIENT_ID`] ||
      !process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]
    ) {
      const error = new Error(
        `The ${provider} authentication provider is not configured.`
      );
      error.status = 404;
      throw error;
    }

    passport.authorize(provider, {
      scope: getProviderScope(provider),
      state: true,
    })(req, res, next);
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * @swagger
 * /auth/providers:
 *   get:
 *     tags: [Authentication]
 *     summary: Get list of configured providers
 *     description: Returns a list of OAuth providers that are configured and available
 *     responses:
 *       200:
 *         description: List of available providers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 providers:
 *                   type: array
 *                   items:
 *                     type: string
 *                     enum: [google, github, facebook, microsoft, linkedin]
 */
router.get("/providers", (req, res) => {
  try {
    const enabledProviders = supportedProviders.filter((provider) => {
      return (
        process.env[`${provider.toUpperCase()}_CLIENT_ID`] &&
        process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]
      );
    });

    res.json({ providers: enabledProviders });
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;
