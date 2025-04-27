/**
 * Main authentication framework export
 *
 * This module provides a custom authentication framework
 * to replace Passport.js while maintaining the same API endpoints.
 */

const sessions = require("./sessions");
const providers = require("./providers");
const errors = require("./errors");

/**
 * Authentication framework initialization middleware
 * Sets up user session and authentication helpers
 */
const initialize = () => (req, res, next) => {
  try {
    // Set authentication helpers on request object
    req.isAuthenticated = () => {
      return !!req.session.user;
    };

    // Add user to request if authenticated
    if (req.session.user) {
      req.user = req.session.user;
    }

    next();
  } catch (err) {
    next(errors.createError("Authentication initialization failed", err, 500));
  }
};

/**
 * Authenticate a user (when not already logged in)
 * @param {string} provider - The authentication provider to use
 * @param {Object} options - Authentication options
 */
const authenticate =
  (provider, options = {}) =>
  async (req, res, next) => {
    try {
      if (!providers[provider]) {
        throw errors.createError(
          `Provider ${provider} not implemented`,
          null,
          404
        );
      }

      return providers[provider].authenticate(req, res, next, options);
    } catch (err) {
      next(
        errors.createError(
          `Authentication with ${provider} failed`,
          err,
          err.status || 500
        )
      );
    }
  };

/**
 * Authorize a user (link a new provider to an existing account)
 * @param {string} provider - The authentication provider to use
 * @param {Object} options - Authentication options
 */
const authorize =
  (provider, options = {}) =>
  async (req, res, next) => {
    try {
      if (!providers[provider]) {
        throw errors.createError(
          `Provider ${provider} not implemented`,
          null,
          404
        );
      }

      if (!req.isAuthenticated()) {
        throw errors.createError(
          "User must be authenticated to link accounts",
          null,
          401
        );
      }

      return providers[provider].authorize(req, res, next, options);
    } catch (err) {
      next(
        errors.createError(
          `Authorization with ${provider} failed`,
          err,
          err.status || 500
        )
      );
    }
  };

/**
 * Log in a user (create a session)
 * @param {Object} req - Express request object
 * @param {Object} user - User object to store in session
 * @param {Function} cb - Optional callback
 */
const login = (req, user, cb = () => {}) => {
  try {
    // Store user in session
    req.session.user = user;
    req.user = user;

    // Run callback when done
    cb();
  } catch (err) {
    cb(errors.createError("Login failed", err, 500));
  }
};

/**
 * Log out a user (destroy session)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object (required to clear cookies)
 * @param {Function} cb - Optional callback
 */
const logout = (req, res, cb = () => {}) => {
  try {
    // Remove user from session first (fallback for old sessions)
    delete req.session.user;
    delete req.user;

    // Now actually destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return cb(
          errors.createError(
            "Logout failed - session destruction error",
            err,
            500
          )
        );
      }

      // Clear the cookie if we have a response object
      if (res && typeof res.clearCookie === "function") {
        res.clearCookie("connect.sid", { path: "/" });
      }

      // Run callback when done
      cb();
    });
  } catch (err) {
    cb(errors.createError("Logout failed", err, 500));
  }
};

module.exports = {
  initialize,
  authenticate,
  authorize,
  login,
  logout,
  providers,
};
