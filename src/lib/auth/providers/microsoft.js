/**
 * Microsoft OAuth Provider Implementation
 *
 * Implements authentication and authorization for Microsoft,
 * including token exchange and profile retrieval via Microsoft Graph API.
 */

const axios = require("axios");
const qs = require("querystring");
const config = require("../../../config");
const User = require("../../../models/User");
const errors = require("../errors");
const sessions = require("../sessions");

/**
 * Get the default scopes for Microsoft authentication
 * @returns {Array<string>} Array of default scopes
 */
const getDefaultScopes = () => {
  return ["profile", "email", "openid", "User.Read"];
};

/**
 * Build Microsoft authorization URL
 * @param {Object} options - Options for authorization
 * @returns {string} Authorization URL
 */
const buildAuthorizationUrl = (options = {}) => {
  // Initialize params with required values
  const params = {
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${config.urls.base}/auth/microsoft/callback`,
    response_mode: "query",
  };

  // Only add scope if it's provided, otherwise use default
  // Don't add scope if options already contains it to prevent duplication
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
  const authUrl = `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${qs.stringify(
    params
  )}`;

  console.log(
    "Generated Microsoft auth URL (without state):",
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
    const tokenUrl =
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

    // Make token request
    const response = await axios.post(
      tokenUrl,
      qs.stringify({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri: `${config.urls.base}/auth/microsoft/callback`,
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
    console.error("Microsoft token exchange failed:", error.message);

    // Log response data if available
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Response data:", error.response.data);
    }

    throw errors.createError(
      "Failed to exchange Microsoft authorization code for tokens",
      error,
      500
    );
  }
};

/**
 * Fetch user profile from Microsoft Graph API
 * @param {string} accessToken - OAuth access token
 * @returns {Object} User profile data
 */
const fetchUserProfile = async (accessToken) => {
  try {
    console.log("Fetching user profile from Microsoft Graph API...");
    const userInfoResponse = await axios.get(
      "https://graph.microsoft.com/v1.0/me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return userInfoResponse.data;
  } catch (err) {
    throw errors.handleProviderError(err, "microsoft");
  }
};

/**
 * Normalize the profile data from Microsoft
 * @param {Object} profile - Raw profile from Microsoft
 * @param {Object} tokens - Token data
 * @returns {Object} Normalized profile data
 */
const normalizeProfile = (profile, tokens) => {
  const microsoftId = profile.id;
  const email = profile.mail || profile.userPrincipalName;
  const name =
    profile.displayName ||
    `${profile.givenName || ""} ${profile.surname || ""}`.trim() ||
    "Microsoft User";
  const profilePhoto = null; // Microsoft Graph API requires additional calls for photos

  return {
    providerId: microsoftId,
    provider: "microsoft",
    displayName: name,
    email: email,
    emailVerified: true, // Microsoft accounts generally have verified emails
    profilePhoto: profilePhoto,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresIn: tokens.expires_in || null,
    idToken: tokens.id_token || null,
    raw: profile,
  };
};

/**
 * Find or create a user based on Microsoft profile
 * @param {Object} normalizedProfile - Normalized profile data
 * @returns {Object} User document
 */
const findOrCreateUser = async (normalizedProfile) => {
  try {
    // First, try to find an existing user with this Microsoft account
    let user = await User.findOne({
      "providers.provider": "microsoft",
      "providers.providerId": normalizedProfile.providerId,
    });

    // If user found, update their token and return
    if (user) {
      // Update the provider data with new tokens
      const providerIndex = user.providers.findIndex(
        (p) =>
          p.provider === "microsoft" &&
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
    if (normalizedProfile.email) {
      user = await User.findOne({ email: normalizedProfile.email });

      // If user with this email exists, link the Microsoft account
      if (user) {
        user.providers.push({
          provider: "microsoft",
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
      email:
        normalizedProfile.email ||
        `user-${normalizedProfile.providerId}@microsoft.account`,
      emailVerified: normalizedProfile.emailVerified,
      providers: [
        {
          provider: "microsoft",
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
 * Handle Microsoft authentication
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
      console.error(`Microsoft OAuth error: ${error} - ${error_description}`);
      if (options.failureRedirect) {
        return res.redirect(options.failureRedirect);
      }
      throw new Error(`Microsoft OAuth error: ${error_description || error}`);
    }

    // If no code, redirect to Microsoft for authorization
    if (!code) {
      const authUrl = buildAuthorizationUrl({
        scope: options.scope, // Just pass the scope directly, don't override
        state: options.state,
      });
      console.log("Redirecting to Microsoft authorization URL:", authUrl);
      return res.redirect(authUrl);
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);
    console.log(
      "Microsoft token received:",
      tokenData.access_token ? "YES" : "NO"
    );

    // Get Microsoft profile
    const profile = await fetchUserProfile(tokenData.access_token);
    console.log("Microsoft profile data received");

    // Normalize the profile data
    const normalizedProfile = normalizeProfile(profile, tokenData);

    // Find or create user
    const user = await findOrCreateUser(normalizedProfile);

    // Store tokens in session
    sessions.storeTokens(req, "microsoft", tokenData);

    // Login the user
    req.session.user = user;
    req.user = user;

    // Redirect or continue
    if (options.successRedirect) {
      return res.redirect(options.successRedirect);
    }
    next();
  } catch (err) {
    console.error("Microsoft authentication error:", err);

    // Redirect to failure page or pass error to next middleware
    if (options.failureRedirect) {
      return res.redirect(options.failureRedirect);
    }
    next(err);
  }
};

/**
 * Main authorization function for account linking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @param {Object} options - Options for authorization
 */
const authorize = async (req, res, next, options = {}) => {
  try {
    // Handle the initial authorization request
    if (!req.query.code) {
      // Generate a random state for CSRF protection
      const state = Math.random().toString(36).substring(2, 15);
      req.session.oauthState = state;

      // Store the success and failure redirects in the session
      if (options.successRedirect) {
        req.session.successRedirect = options.successRedirect;
      }
      if (options.failureRedirect) {
        req.session.failureRedirect = options.failureRedirect;
      }

      // Redirect to Microsoft for authorization
      const authUrl = buildAuthorizationUrl({
        ...options,
        state,
      });

      return res.redirect(authUrl);
    }

    // Handle the callback from Microsoft
    const { code, state } = req.query;
    const storedState = req.session.oauthState;

    // Verify the state parameter to prevent CSRF
    if (state !== storedState) {
      throw errors.createError(
        "Invalid state parameter",
        { expected: storedState, received: state },
        400
      );
    }

    // Exchange the authorization code for tokens
    const tokens = await exchangeCodeForToken(code);

    // Store tokens in session
    sessions.storeTokens(req, "microsoft", tokens);

    // Fetch the user profile
    const profile = await fetchUserProfile(tokens.access_token);

    // Normalize the profile data
    const normalizedProfile = normalizeProfile(profile, tokens);

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

    // Check if this provider is already linked to the user
    const existingProvider = user.providers.find(
      (p) =>
        p.provider === "microsoft" &&
        p.providerId === normalizedProfile.providerId
    );

    if (existingProvider) {
      console.log("This Microsoft account is already linked to the user");
      // Update the provider data
      existingProvider.accessToken = normalizedProfile.accessToken;
      existingProvider.refreshToken = normalizedProfile.refreshToken;
      existingProvider.profilePhoto = normalizedProfile.profilePhoto;
      existingProvider.displayName = normalizedProfile.displayName;
      await user.save();
    } else {
      // Check if this provider is linked to another user
      const existingUser = await User.findOne({
        "providers.provider": "microsoft",
        "providers.providerId": normalizedProfile.providerId,
      });

      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        throw errors.createError(
          "This Microsoft account is already linked to another user",
          null,
          400
        );
      }

      // Add the provider to the user's providers array
      user.providers.push({
        provider: "microsoft",
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

    // Update the session with the updated user
    sessions.updateSession(req, user);

    // Redirect to the success URL
    if (req.session.successRedirect) {
      const successRedirect = req.session.successRedirect;
      delete req.session.successRedirect;
      return res.redirect(successRedirect);
    }

    // If no success redirect is specified, just continue
    next();
  } catch (err) {
    console.error("Microsoft authorization error:", err);

    // Redirect to the failure URL
    if (req.session.failureRedirect) {
      const failureRedirect = req.session.failureRedirect;
      delete req.session.failureRedirect;
      return res.redirect(failureRedirect);
    }

    // If no failure redirect is specified, pass the error to the next middleware
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
