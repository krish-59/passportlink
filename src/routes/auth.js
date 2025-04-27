const express = require("express");
// Remove Passport.js import as we're using custom auth
const config = require("../config");
// Add our custom auth framework
const customAuth = require("../lib/auth");

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
      try {
        const authOptions = {
          scope: getProviderScope(provider),
          state: true,
        };

        if (req.isAuthenticated()) {
          console.log(`Using custom framework for ${provider} authorization`);
          customAuth.authorize(provider, authOptions)(req, res, next);
        } else {
          console.log(`Using custom framework for ${provider} authentication`);
          customAuth.authenticate(provider, authOptions)(req, res, next);
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
        return "profile email openid User.Read"; // Return as space-separated string
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

        // Log session information for debugging
        console.log(
          `Callback received for ${provider}. Session ID: ${req.session.id}`
        );
        console.log(`Session cookie: ${JSON.stringify(req.cookies)}`);
        console.log(`Authenticated: ${req.isAuthenticated()}`);

        if (req.isAuthenticated()) {
          console.log(
            `Using custom framework for ${provider} auth callback (account linking)`
          );
          customAuth.authorize(provider, authOptions)(req, res, next);
        } else {
          console.log(
            `Using custom framework for ${provider} auth callback (authentication)`
          );
          customAuth.authenticate(provider, authOptions)(req, res, next);
        }
      } catch (err) {
        console.error(`${provider} callback error:`, err);

        // For critical security errors only, log out the user
        if (err.status === 401) {
          // Unauthorized
          customAuth.logout(req, res, () => {
            return res.redirect(
              authOptions.failureRedirect ||
                "/auth/failure?error=session_invalid"
            );
          });
        } else {
          // For other errors, keep user logged in but show error
          return res.redirect(
            authOptions.failureRedirect || `/auth/failure?error=${err.message}`
          );
        }
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

      // Log session information for debugging
      console.log(
        `POST callback received for Microsoft. Session ID: ${req.session.id}`
      );
      console.log(`Session cookie: ${JSON.stringify(req.cookies)}`);
      console.log(`Authenticated: ${req.isAuthenticated()}`);
      console.log(`Request body: ${JSON.stringify(req.body)}`);

      if (req.isAuthenticated()) {
        console.log(
          "Using custom framework for Microsoft auth callback (POST)"
        );
        customAuth.authorize("microsoft", authOptions)(req, res, next);
      } else {
        console.log(
          "Using custom framework for Microsoft auth callback (POST)"
        );
        customAuth.authenticate("microsoft", authOptions)(req, res, next);
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

    // Use our custom auth framework for logout
    customAuth.logout(req, res, (err) => {
      if (err) {
        console.error("Logout error:", err);
        return res
          .status(500)
          .json({ error: "Logout error", message: err.message });
      }

      return res.status(200).json({ message: "Logged out successfully" });
    });
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

    // Use our custom auth framework for authorization/linking
    console.log(`Using custom framework to link ${provider} account`);
    customAuth.authorize(provider, {
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
