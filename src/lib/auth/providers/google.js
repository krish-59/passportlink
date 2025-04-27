/**
 * Google OAuth Provider Implementation
 *
 * Implements authentication and authorization for Google,
 * including token exchange and profile retrieval via Google APIs.
 */

const axios = require("axios");
const qs = require("querystring");
const config = require("../../../config");
const User = require("../../../models/User");
const errors = require("../errors");
const sessions = require("../sessions");

/**
 * Get the default scopes for Google authentication
 * @returns {Array<string>} Array of default scopes
 */
const getDefaultScopes = () => {
  return ["profile", "email"];
};

/**
 * Build Google authorization URL
 * @param {Object} options - Options for authorization
 * @returns {string} Authorization URL
 */
const buildAuthorizationUrl = (options = {}) => {
  // Initialize params with required values
  const params = {
    client_id: process.env.GOOGLE_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${config.urls.base}/auth/google/callback`,
    access_type: "offline", // Request a refresh token
    prompt: "consent", // Force the consent screen for better UX
  };

  // Only add scope if it's provided, otherwise use default
  if (options.scope) {
    // Make sure scope is a string, not an array
    params.scope = Array.isArray(options.scope)
      ? options.scope.join(" ")
      : options.scope;
    console.log("Using provided scopes:", params.scope);
  } else {
    // Use default scopes as a string
    params.scope = getDefaultScopes().join(" ");
    console.log("Using default scopes:", params.scope);
  }

  // Add state if provided
  if (options.state) {
    params.state = options.state;
  }

  // Build the full URL
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${qs.stringify(
    params
  )}`;

  console.log(
    "Generated Google auth URL (without state):",
    authUrl.replace(/state=[^&]+/, "state=REDACTED")
  );

  return authUrl;
};

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code
 * @returns {Promise<Object>} Token response
 */
const exchangeCodeForToken = async (code) => {
  try {
    // Make token request
    const response = await axios.post(
      "https://oauth2.googleapis.com/token",
      qs.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: `${config.urls.base}/auth/google/callback`,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Google token exchange failed:", error.message);

    // Log response data if available
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Response data:", error.response.data);
    }

    throw errors.createError(
      "Failed to exchange Google authorization code for tokens",
      error,
      500
    );
  }
};

/**
 * Fetch user profile from Google API
 * @param {string} accessToken - OAuth access token
 * @returns {Object} User profile data
 */
const fetchUserProfile = async (accessToken) => {
  try {
    console.log("Fetching user profile from Google API...");
    const userInfoResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return userInfoResponse.data;
  } catch (err) {
    throw errors.handleProviderError(err, "google");
  }
};

/**
 * Normalize the profile data from Google
 * @param {Object} profile - Raw profile from Google
 * @param {Object} tokens - Token data
 * @returns {Object} Normalized profile data
 */
const normalizeProfile = (profile, tokens) => {
  const googleId = profile.sub;
  const email = profile.email;
  const name =
    profile.name ||
    `${profile.given_name || ""} ${profile.family_name || ""}`.trim() ||
    "Google User";
  const profilePhoto = profile.picture;

  return {
    providerId: googleId,
    provider: "google",
    displayName: name,
    email: email,
    emailVerified: profile.email_verified || false,
    profilePhoto: profilePhoto,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresIn: tokens.expires_in || null,
    idToken: tokens.id_token || null,
    raw: profile,
  };
};

/**
 * Find or create a user based on Google profile
 * @param {Object} normalizedProfile - Normalized profile data
 * @returns {Object} User document
 */
const findOrCreateUser = async (normalizedProfile) => {
  try {
    // First, try to find an existing user with this Google account
    let user = await User.findOne({
      "providers.provider": "google",
      "providers.providerId": normalizedProfile.providerId,
    });

    // If user found, update their token and return
    if (user) {
      // Update the provider data with new tokens
      const providerIndex = user.providers.findIndex(
        (p) =>
          p.provider === "google" &&
          p.providerId === normalizedProfile.providerId
      );

      if (providerIndex !== -1) {
        user.providers[providerIndex].accessToken =
          normalizedProfile.accessToken;
        user.providers[providerIndex].refreshToken =
          normalizedProfile.refreshToken;
        user.providers[providerIndex].profilePhoto =
          normalizedProfile.profilePhoto;
        user.providers[providerIndex].displayName =
          normalizedProfile.displayName;
        await user.save();
      }

      return user;
    }

    // If no user found but we have an email, check for user with that email
    if (normalizedProfile.email && normalizedProfile.emailVerified) {
      user = await User.findOne({ email: normalizedProfile.email });

      // If user with this email exists, link the Google account
      if (user) {
        user.providers.push({
          provider: "google",
          providerId: normalizedProfile.providerId,
          displayName: normalizedProfile.displayName,
          email: normalizedProfile.email,
          profilePhoto: normalizedProfile.profilePhoto,
          accessToken: normalizedProfile.accessToken,
          refreshToken: normalizedProfile.refreshToken,
          linkedAt: new Date(),
        });

        await user.save();
        return user;
      }
    }

    // No existing user found, create a new one
    const newUser = new User({
      name: normalizedProfile.displayName,
      email: normalizedProfile.email,
      emailVerified: normalizedProfile.emailVerified,
      providers: [
        {
          provider: "google",
          providerId: normalizedProfile.providerId,
          displayName: normalizedProfile.displayName,
          email: normalizedProfile.email,
          profilePhoto: normalizedProfile.profilePhoto,
          accessToken: normalizedProfile.accessToken,
          refreshToken: normalizedProfile.refreshToken,
          linkedAt: new Date(),
        },
      ],
    });

    await newUser.save();
    return newUser;
  } catch (err) {
    throw errors.createError("Failed to find or create user", err, 500);
  }
};

/**
 * Handle Google authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @param {Object} options - Authentication options
 */
const authenticate = async (req, res, next, options = {}) => {
  try {
    // Extract code from query if present
    const { code, error, error_description } = req.query;

    // Check for OAuth error in query
    if (error) {
      console.error(`Google OAuth error: ${error} - ${error_description}`);
      if (options.failureRedirect) {
        return res.redirect(options.failureRedirect);
      }
      throw new Error(`Google OAuth error: ${error_description || error}`);
    }

    // If no code, redirect to Google for authorization
    if (!code) {
      const authUrl = buildAuthorizationUrl({
        scope: options.scope, // Just pass the scope directly, don't override
        state: options.state,
      });
      console.log("Redirecting to Google authorization URL:", authUrl);
      return res.redirect(authUrl);
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);
    console.log(
      "Google token received:",
      tokenData.access_token ? "YES" : "NO"
    );

    // Get Google profile
    const profile = await fetchUserProfile(tokenData.access_token);
    console.log("Google profile data received");

    // Normalize the profile data
    const normalizedProfile = normalizeProfile(profile, tokenData);

    // Find or create user
    const user = await findOrCreateUser(normalizedProfile);

    // Store tokens in session
    sessions.storeTokens(req, "google", tokenData);

    // Login the user
    req.session.user = user;
    req.user = user;

    // Redirect or continue
    if (options.successRedirect) {
      return res.redirect(options.successRedirect);
    }
    next();
  } catch (err) {
    console.error("Google authentication error:", err);

    // Redirect to failure page or pass error to next middleware
    if (options.failureRedirect) {
      return res.redirect(options.failureRedirect);
    }
    next(err);
  }
};

/**
 * Handle Google authorization (account linking)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @param {Object} options - Authorization options
 */
const authorize = async (req, res, next, options = {}) => {
  try {
    // Ensure user is authenticated
    if (!req.isAuthenticated()) {
      throw errors.createError(
        "User must be authenticated to link accounts",
        null,
        401
      );
    }

    // Extract code from query if present
    const { code } = req.query;

    // If no code, redirect to Google for authorization
    if (!code) {
      const authUrl = buildAuthorizationUrl({
        scope: options.scope, // Just pass the scope directly, don't override
        state: options.state,
      });
      return res.redirect(authUrl);
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);

    // Get Google profile
    const profile = await fetchUserProfile(tokenData.access_token);

    // Normalize the profile data
    const normalizedProfile = normalizeProfile(profile, tokenData);

    // Get the current user ID from the session
    const userId = req.user._id || req.user.id;
    if (!userId) {
      throw errors.createError("User ID not found in session", null, 400);
    }

    // Fetch the user from the database to ensure we have a Mongoose document
    const user = await User.findById(userId);
    if (!user) {
      throw errors.createError("User not found in database", null, 404);
    }

    // Check if this Google account is already linked to another user
    const existingUser = await User.findOne({
      "providers.provider": "google",
      "providers.providerId": normalizedProfile.providerId,
    });

    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      throw errors.createError(
        "This Google account is already linked to another user",
        null,
        400,
        { provider: "google" }
      );
    }

    // Check if user already has this provider
    const existingProvider = user.providers.find(
      (p) =>
        p.provider === "google" && p.providerId === normalizedProfile.providerId
    );

    if (existingProvider) {
      console.log("This Google account is already linked to the user");
      // Update the provider data
      existingProvider.accessToken = normalizedProfile.accessToken;
      existingProvider.refreshToken = normalizedProfile.refreshToken;
      existingProvider.profilePhoto = normalizedProfile.profilePhoto;
      existingProvider.displayName = normalizedProfile.displayName;
      await user.save();
    } else {
      // Add the provider to user
      user.providers.push({
        provider: "google",
        providerId: normalizedProfile.providerId,
        displayName: normalizedProfile.displayName,
        email: normalizedProfile.email,
        profilePhoto: normalizedProfile.profilePhoto,
        accessToken: normalizedProfile.accessToken,
        refreshToken: normalizedProfile.refreshToken,
        linkedAt: new Date(),
      });

      await user.save();
    }

    // Store tokens in session
    sessions.storeTokens(req, "google", tokenData);

    // Update the session with the updated user
    sessions.updateSession(req, user);

    // Redirect or continue
    if (options.successRedirect) {
      return res.redirect(options.successRedirect);
    }
    next();
  } catch (err) {
    console.error("Google authorization error:", err);

    // Redirect to failure page or pass error to next middleware
    if (options.failureRedirect) {
      return res.redirect(options.failureRedirect);
    }
    next(err);
  }
};

module.exports = {
  authenticate,
  authorize,
  getDefaultScopes,
  normalizeProfile,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  fetchUserProfile,
};
