/**
 * Authentication error handling utilities
 *
 * Provides a consistent way to create, format, and handle
 * authentication-related errors across the application.
 */

/**
 * Create a standardized error object
 * @param {string} message - Main error message
 * @param {Error} originalError - Original error (if any)
 * @param {number} status - HTTP status code
 * @param {Object} details - Additional error details
 * @returns {Error} Formatted error object
 */
const createError = (
  message,
  originalError = null,
  status = 500,
  details = {}
) => {
  const error = new Error(message);
  error.status = status;
  error.details = details;

  if (originalError) {
    error.originalError = originalError;
    error.stack = originalError.stack;

    // If original error has status/details, use those if not provided
    if (!status && originalError.status) {
      error.status = originalError.status;
    }

    if (Object.keys(details).length === 0 && originalError.details) {
      error.details = originalError.details;
    }
  }

  return error;
};

/**
 * Handle authentication errors in routes
 * @param {Error} err - Error to handle
 * @param {Object} res - Express response object
 * @param {boolean} isDevelopment - Whether app is in development mode
 */
const handleAuthError = (
  err,
  res,
  isDevelopment = process.env.NODE_ENV === "development"
) => {
  console.error("Auth Error:", err);

  const statusCode = err.status || 500;
  const message = err.message || "Internal server error";
  const details = err.details || {};

  // Only include stack trace in development
  const errorResponse = {
    error: statusCode === 500 ? "Internal server error" : message,
    details: Object.keys(details).length > 0 ? details : undefined,
    message: isDevelopment ? err.stack : undefined,
  };

  res.status(statusCode).json(errorResponse);
};

/**
 * OAuth specific errors
 */
const OAUTH_ERRORS = {
  ACCESS_DENIED: "access_denied",
  INVALID_REQUEST: "invalid_request",
  UNAUTHORIZED_CLIENT: "unauthorized_client",
  UNSUPPORTED_RESPONSE_TYPE: "unsupported_response_type",
  INVALID_SCOPE: "invalid_scope",
  SERVER_ERROR: "server_error",
  TEMPORARILY_UNAVAILABLE: "temporarily_unavailable",
};

/**
 * Provider error handling with provider-specific logic
 * @param {Error} err - Error to handle
 * @param {string} provider - OAuth provider name
 * @returns {Error} Standardized error
 */
const handleProviderError = (err, provider) => {
  // LinkedIn specific error handling
  if (provider === "linkedin") {
    // Handle LinkedIn specific errors
    if (err.response && err.response.data) {
      const data = err.response.data;
      if (data.error === "invalid_request" && data.error_description) {
        return createError(data.error_description, err, 400);
      }
    }
  }

  // Microsoft specific error handling
  if (provider === "microsoft") {
    // Handle Microsoft specific errors
    if (err.response && err.response.data) {
      const data = err.response.data;
      if (data.error_description) {
        return createError(data.error_description, err, 400);
      }
    }
  }

  // Default error handling for all providers
  if (err.response && err.response.data) {
    const data = err.response.data;
    if (data.error_description) {
      return createError(data.error_description, err, 400);
    } else if (data.error) {
      return createError(`${provider} OAuth error: ${data.error}`, err, 400);
    }
  }

  // Generic error
  return createError(`Error during ${provider} authentication`, err, 500);
};

module.exports = {
  createError,
  handleAuthError,
  handleProviderError,
  OAUTH_ERRORS,
};
