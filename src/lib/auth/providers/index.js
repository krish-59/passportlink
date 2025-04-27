/**
 * OAuth Provider Registry
 *
 * Centralizes access to all supported OAuth providers.
 * Each provider implements a standard interface for
 * authentication and authorization.
 */

// Import providers as they're implemented
const linkedin = require("./linkedin");
const microsoft = require("./microsoft");
const google = require("./google");
const github = require("./github");
const facebook = require("./facebook");

/**
 * Check if the environment variables for a provider are configured
 * @param {string} provider - Provider name
 * @returns {boolean} Whether the provider is configured
 */
const isProviderConfigured = (provider) => {
  const upperProvider = provider.toUpperCase();
  return !!(
    process.env[`${upperProvider}_CLIENT_ID`] &&
    process.env[`${upperProvider}_CLIENT_SECRET`]
  );
};

/**
 * Get all configured providers
 * @returns {Array<string>} List of provider names that are configured
 */
const getConfiguredProviders = () => {
  const allProviders = [
    "linkedin",
    "microsoft",
    "google",
    "github",
    "facebook",
  ];
  return allProviders.filter((provider) => isProviderConfigured(provider));
};

/**
 * Standard provider interface that each provider must implement
 */
const providerInterface = {
  /**
   * Authenticate a user with this provider
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   * @param {Object} options - Authentication options
   */
  authenticate: async (req, res, next, options) => {
    throw new Error("Provider authentication not implemented");
  },

  /**
   * Authorize a user (link a new provider to an existing account)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   * @param {Object} options - Authorization options
   */
  authorize: async (req, res, next, options) => {
    throw new Error("Provider authorization not implemented");
  },

  /**
   * Get the appropriate scope for this provider
   * @returns {Array<string>} List of scopes to request
   */
  getDefaultScopes: () => {
    return ["profile", "email"];
  },

  /**
   * Build a standardized user profile from provider-specific data
   * @param {Object} rawProfile - Raw profile data from provider
   * @param {Object} tokens - Token information
   * @returns {Object} Normalized user profile
   */
  normalizeProfile: (rawProfile, tokens) => {
    throw new Error("Profile normalization not implemented");
  },
};

// Initialize provider registry
// As providers are implemented, add them to this object
const providers = {
  linkedin,
  microsoft,
  google,
  github,
  facebook,
};

// Export provider registry and helper functions
module.exports = {
  ...providers,
  isProviderConfigured,
  getConfiguredProviders,
  providerInterface,
};
