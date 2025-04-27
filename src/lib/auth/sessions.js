/**
 * Session management utilities for authentication
 *
 * Provides functions to manage user sessions, including
 * creating sessions, destroying sessions, and refreshing tokens.
 */

const errors = require("./errors");

/**
 * Create a new user session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} user - User object to store in session
 */
const createSession = (req, res, user) => {
  try {
    // Store user in session
    req.session.user = user;

    // Set session cookie options
    req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours

    console.log(
      `Session created for user ${user.id || user._id}. Session ID: ${
        req.session.id
      }`
    );
    console.log(
      `Session cookie options: ${JSON.stringify(req.session.cookie)}`
    );

    // Force save session
    req.session.save((err) => {
      if (err) {
        console.error(`Error saving session: ${err.message}`);
      } else {
        console.log(`Session saved after creation`);
      }
    });
  } catch (error) {
    console.error("Failed to create session:", error);
    throw new Error("Session creation failed");
  }
};

/**
 * Destroy the current user session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const destroySession = (req, res) => {
  try {
    const sessionId = req.session.id;
    console.log(`Destroying session ${sessionId}`);

    // Remove user from session
    req.session.user = null;

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error(`Error destroying session: ${err.message}`);
      } else {
        console.log(`Session ${sessionId} destroyed successfully`);
      }

      // Clear session cookie
      res.clearCookie("connect.sid");
    });
  } catch (error) {
    console.error("Failed to destroy session:", error);
    throw new Error("Session destruction failed");
  }
};

/**
 * Update the user in the current session
 * @param {Object} req - Express request object
 * @param {Object} user - Updated user object
 * @param {Function} callback - Optional callback
 */
const updateSession = (req, user, callback = () => {}) => {
  try {
    if (!req.session.user) {
      return callback(
        errors.createError("No active session to update", null, 400)
      );
    }

    // Update user in session
    req.session.user = user;
    req.user = user;

    callback();
  } catch (err) {
    callback(errors.createError("Session update failed", err, 500));
  }
};

/**
 * Store a token in the session for a provider
 * @param {Object} req - Express request object
 * @param {string} provider - Provider name
 * @param {Object} tokens - Token data to store
 */
const storeTokens = (req, provider, tokens) => {
  if (!req.session.tokens) {
    req.session.tokens = {};
  }

  req.session.tokens[provider] = {
    ...tokens,
    createdAt: new Date().toISOString(),
  };

  console.log(`Tokens stored for ${provider}. Session ID: ${req.session.id}`);
  console.log(`Session cookie: ${JSON.stringify(req.cookies)}`);

  // Force save session
  req.session.save((err) => {
    if (err) {
      console.error(`Error saving session: ${err.message}`);
    } else {
      console.log(`Session saved after storing ${provider} tokens`);
    }
  });
};

/**
 * Retrieve tokens for a provider from the session
 * @param {Object} req - Express request object
 * @param {string} provider - Provider name
 * @returns {Object|null} Token data or null if not found
 */
const getTokens = (req, provider) => {
  if (!req.session.tokens || !req.session.tokens[provider]) {
    console.log(
      `No tokens found for ${provider}. Session ID: ${req.session.id}`
    );
    return null;
  }

  console.log(
    `Retrieved tokens for ${provider}. Session ID: ${req.session.id}`
  );
  return req.session.tokens[provider];
};

/**
 * Remove tokens for a provider from the session
 * @param {Object} req - Express request object
 * @param {string} provider - Provider name
 */
const removeTokens = (req, provider) => {
  if (req.session.tokens && req.session.tokens[provider]) {
    delete req.session.tokens[provider];
  }
};

module.exports = {
  createSession,
  destroySession,
  updateSession,
  storeTokens,
  getTokens,
  removeTokens,
};
