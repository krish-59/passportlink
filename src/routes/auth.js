const express = require("express");
const passport = require("passport");
const config = require("../config");

const router = express.Router();

/**
 * Check if a strategy is configured
 * @param {string} provider - Name of the OAuth provider
 * @returns {function} - Middleware that checks if the provider is configured
 */
const checkProviderEnabled = (provider) => {
  return (req, res, next) => {
    if (
      !process.env[`${provider.toUpperCase()}_CLIENT_ID`] ||
      !process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]
    ) {
      return res.status(404).json({
        error: `The ${provider} authentication provider is not configured.`,
      });
    }
    next();
  };
};

/**
 * @swagger
 * /auth/{provider}:
 *   get:
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
const supportedProviders = [
  "google",
  "github",
  "facebook",
  "microsoft",
  "linkedin",
];
supportedProviders.forEach((provider) => {
  router.get(
    `/${provider}`,
    checkProviderEnabled(provider),
    (req, res, next) => {
      // Define authentication options
      const authOptions = {
        scope: getProviderScope(provider),
        state: true, // Protect against CSRF
      };

      // If user is authenticated, we're linking accounts
      if (req.isAuthenticated()) {
        passport.authorize(provider, authOptions)(req, res, next);
      } else {
        passport.authenticate(provider, authOptions)(req, res, next);
      }
    }
  );
});

/**
 * Get the appropriate scope for each provider
 */
function getProviderScope(provider) {
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
      return ["r_emailaddress", "r_liteprofile"];
    default:
      return ["profile", "email"];
  }
}

/**
 * @swagger
 * /auth/{provider}/callback:
 *   get:
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
      const authOptions = {
        successRedirect: config.urls.frontend + "/auth/success",
        failureRedirect: config.urls.frontend + "/auth/failure",
      };

      // If user is authenticated, we're linking accounts
      if (req.isAuthenticated()) {
        passport.authorize(provider, authOptions)(req, res, next);
      } else {
        passport.authenticate(provider, authOptions)(req, res, next);
      }
    }
  );
});

// Special case for Microsoft which might use form_post response mode
router.post(
  "/microsoft/callback",
  checkProviderEnabled("microsoft"),
  (req, res, next) => {
    const authOptions = {
      successRedirect: config.urls.frontend + "/auth/success",
      failureRedirect: config.urls.frontend + "/auth/failure",
    };

    // If user is authenticated, we're linking accounts
    if (req.isAuthenticated()) {
      passport.authorize("microsoft", authOptions)(req, res, next);
    } else {
      passport.authenticate("microsoft", authOptions)(req, res, next);
    }
  }
);

/**
 * @swagger
 * /auth/user:
 *   get:
 *     summary: Get the current authenticated user
 *     description: Returns the user information if authenticated
 *     responses:
 *       200:
 *         description: User information
 *       401:
 *         description: Not authenticated
 */
router.get("/user", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
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
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout the current user
 *     description: Destroys the current session
 *     responses:
 *       200:
 *         description: Successfully logged out
 */
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Error during logout", message: err.message });
    }
    res.json({ message: "Successfully logged out" });
  });
});

/**
 * @swagger
 * /auth/unlink/{provider}:
 *   get:
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
 *       400:
 *         description: Cannot unlink the last provider
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Provider not found
 */
router.get("/unlink/:provider", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { provider } = req.params;

  // Validate provider
  if (!supportedProviders.includes(provider)) {
    return res.status(404).json({ error: "Provider not found" });
  }

  // Check if the provider is linked to this user
  const providerIndex = req.user.providers.findIndex(
    (p) => p.provider === provider
  );
  if (providerIndex === -1) {
    return res
      .status(404)
      .json({ error: `No ${provider} account linked to this user` });
  }

  // Ensure user has at least one other provider (prevent removing last login method)
  if (req.user.providers.length <= 1) {
    return res.status(400).json({
      error: "Cannot unlink the last provider",
      message: "You must have at least one login method",
    });
  }

  // Remove the provider and save
  req.user.providers.splice(providerIndex, 1);
  req.user
    .save()
    .then(() => {
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
    })
    .catch((error) => {
      res
        .status(500)
        .json({ error: "Error unlinking provider", message: error.message });
    });
});

/**
 * @swagger
 * /auth/link/{provider}:
 *   get:
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
 *       404:
 *         description: Provider not found or not configured
 */
router.get("/link/:provider", (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res
      .status(401)
      .json({ error: "Must be logged in to link accounts" });
  }

  const { provider } = req.params;

  // Validate provider
  if (!supportedProviders.includes(provider)) {
    return res.status(404).json({ error: "Provider not found" });
  }

  // Check if provider is configured
  if (
    !process.env[`${provider.toUpperCase()}_CLIENT_ID`] ||
    !process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]
  ) {
    return res.status(404).json({
      error: `The ${provider} authentication provider is not configured.`,
    });
  }

  // Use passport.authorize for linking (this preserves the existing login session)
  passport.authorize(provider, {
    scope: getProviderScope(provider),
    state: true,
  })(req, res, next);
});

/**
 * @swagger
 * /auth/providers:
 *   get:
 *     summary: Get list of configured providers
 *     description: Returns a list of OAuth providers that are configured and available
 *     responses:
 *       200:
 *         description: List of available providers
 */
router.get("/providers", (req, res) => {
  const enabledProviders = supportedProviders.filter((provider) => {
    return (
      process.env[`${provider.toUpperCase()}_CLIENT_ID`] &&
      process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]
    );
  });

  res.json({ providers: enabledProviders });
});

module.exports = router;
