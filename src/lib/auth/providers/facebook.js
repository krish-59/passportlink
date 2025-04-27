/**
 * Facebook OAuth Provider Implementation
 *
 * Implements authentication and authorization for Facebook,
 * including token exchange and profile retrieval via Facebook Graph API.
 */

const axios = require("axios");
const qs = require("querystring");
const config = require("../../../config");
const User = require("../../../models/User");
const errors = require("../errors");
const sessions = require("../sessions");

/**
 * Get the default scopes for Facebook authentication
 * @returns {Array<string>} Array of default scopes
 */
const getDefaultScopes = () => {
  return ["email", "public_profile"];
};

/**
 * Build Facebook authorization URL
 * @param {Object} options - Options for authorization
 * @returns {string} Authorization URL
 */
const buildAuthorizationUrl = (options = {}) => {
  // Initialize params with required values
  const params = {
    client_id: process.env.FACEBOOK_CLIENT_ID,
    redirect_uri: `${config.urls.base}/auth/facebook/callback`,
    response_type: "code",
  };

  // Only add scope if it's provided, otherwise use default
  if (options.scope) {
    // Make sure scope is a string, not an array
    params.scope = Array.isArray(options.scope)
      ? options.scope.join(",")
      : options.scope;
    console.log("Using provided scopes:", params.scope);
  } else {
    // Use default scopes as a string
    params.scope = getDefaultScopes().join(",");
    console.log("Using default scopes:", params.scope);
  }

  // Add state if provided
  if (options.state) {
    params.state = options.state;
  }

  // Build the full URL
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${qs.stringify(
    params
  )}`;

  console.log(
    "Generated Facebook auth URL (without state):",
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
    const tokenUrl = "https://graph.facebook.com/v19.0/oauth/access_token";

    // Make token request
    const response = await axios.get(
      `${tokenUrl}?${qs.stringify({
        client_id: process.env.FACEBOOK_CLIENT_ID,
        client_secret: process.env.FACEBOOK_CLIENT_SECRET,
        code,
        redirect_uri: `${config.urls.base}/auth/facebook/callback`,
      })}`
    );

    return response.data;
  } catch (error) {
    console.error("Facebook token exchange failed:", error.message);

    // Log response data if available
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Response data:", error.response.data);
    }

    throw errors.createError(
      "Failed to exchange Facebook authorization code for tokens",
      error,
      500
    );
  }
};

/**
 * Fetch user profile from Facebook Graph API
 * @param {string} accessToken - OAuth access token
 * @returns {Object} User profile data
 */
const fetchUserProfile = async (accessToken) => {
  try {
    console.log("Fetching user profile from Facebook Graph API...");
    const userInfoResponse = await axios.get(
      "https://graph.facebook.com/v19.0/me",
      {
        params: {
          fields: "id,name,email,picture",
          access_token: accessToken,
        },
      }
    );

    return userInfoResponse.data;
  } catch (err) {
    throw errors.handleProviderError(err, "facebook");
  }
};

/**
 * Normalize the profile data from Facebook
 * @param {Object} profile - Raw profile from Facebook
 * @param {Object} tokens - Token data
 * @returns {Object} Normalized profile data
 */
const normalizeProfile = (profile, tokens) => {
  const facebookId = profile.id;
  const email = profile.email;
  const name = profile.name || "Facebook User";
  const profilePhoto = profile.picture?.data?.url || null;

  return {
    providerId: facebookId,
    provider: "facebook",
    displayName: name,
    email: email,
    emailVerified: true, // Facebook verifies emails
    profilePhoto: profilePhoto,
    accessToken: tokens.access_token,
    refreshToken: null, // Facebook doesn't use refresh tokens in the same way
    expiresIn: tokens.expires_in || null,
    raw: profile,
  };
};

/**
 * Find or create a user based on Facebook profile
 * @param {Object} normalizedProfile - Normalized profile data
 * @returns {Object} User document
 */
const findOrCreateUser = async (normalizedProfile) => {
  try {
    // First, try to find an existing user with this Facebook account
    let user = await User.findOne({
      "providers.provider": "facebook",
      "providers.providerId": normalizedProfile.providerId,
    });

    // If user found, update their token and return
    if (user) {
      // Update the provider data with new tokens
      const providerIndex = user.providers.findIndex(
        (p) =>
          p.provider === "facebook" &&
          p.providerId === normalizedProfile.providerId
      );

      if (providerIndex !== -1) {
        user.providers[providerIndex].accessToken =
          normalizedProfile.accessToken;
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

      // If user with this email exists, link the Facebook account
      if (user) {
        user.providers.push({
          provider: "facebook",
          providerId: normalizedProfile.providerId,
          displayName: normalizedProfile.displayName,
          email: normalizedProfile.email,
          profilePhoto: normalizedProfile.profilePhoto,
          accessToken: normalizedProfile.accessToken,
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
        `user-${normalizedProfile.providerId}@facebook.account`,
      emailVerified: normalizedProfile.emailVerified,
      providers: [
        {
          provider: "facebook",
          providerId: normalizedProfile.providerId,
          displayName: normalizedProfile.displayName,
          email: normalizedProfile.email,
          profilePhoto: normalizedProfile.profilePhoto,
          accessToken: normalizedProfile.accessToken,
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
 * Main authentication function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @param {Object} options - Options for authentication
 */
const authenticate = async (req, res, next, options = {}) => {
  try {
    // Handle the initial authentication request
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

      // Redirect to Facebook for authentication
      const authUrl = buildAuthorizationUrl({
        ...options,
        state,
      });

      return res.redirect(authUrl);
    }

    // Handle the callback from Facebook
    // This is called when Facebook redirects back to our app
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
    sessions.storeTokens(req, "facebook", tokens);

    // Fetch the user profile
    const profile = await fetchUserProfile(tokens.access_token);

    // Normalize the profile data
    const normalizedProfile = normalizeProfile(profile, tokens);

    // Find or create a user
    const user = await findOrCreateUser(normalizedProfile);

    // Log the user in
    sessions.createSession(req, res, user);
    console.log("Facebook authentication successful");

    // Redirect to the success URL - prioritize options over session
    if (options.successRedirect) {
      return res.redirect(options.successRedirect);
    } else if (req.session.successRedirect) {
      const successRedirect = req.session.successRedirect;
      delete req.session.successRedirect;
      return res.redirect(successRedirect);
    } else {
      // Fallback to frontend URL if configured
      const frontendUrl = config.urls.frontend + "/auth/success";
      return res.redirect(frontendUrl);
    }
  } catch (err) {
    console.error("Facebook authentication error:", err);

    // Prioritize options over session for failure redirect
    if (options.failureRedirect) {
      return res.redirect(options.failureRedirect);
    } else if (req.session.failureRedirect) {
      const failureRedirect = req.session.failureRedirect;
      delete req.session.failureRedirect;
      return res.redirect(failureRedirect);
    } else {
      // Fallback to frontend failure URL
      return res.redirect(config.urls.frontend + "/auth/failure");
    }
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

      // Redirect to Facebook for authorization
      const authUrl = buildAuthorizationUrl({
        ...options,
        state,
      });

      return res.redirect(authUrl);
    }

    // Handle the callback from Facebook
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
    sessions.storeTokens(req, "facebook", tokens);

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
        p.provider === "facebook" &&
        p.providerId === normalizedProfile.providerId
    );

    if (existingProvider) {
      console.log("This Facebook account is already linked to the user");
      // Update the provider data
      existingProvider.accessToken = normalizedProfile.accessToken;
      existingProvider.profilePhoto = normalizedProfile.profilePhoto;
      existingProvider.displayName = normalizedProfile.displayName;
      await user.save();
    } else {
      // Check if this provider is linked to another user
      const existingUser = await User.findOne({
        "providers.provider": "facebook",
        "providers.providerId": normalizedProfile.providerId,
      });

      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        throw errors.createError(
          "This Facebook account is already linked to another user",
          null,
          400
        );
      }

      // Add the provider to the user's providers array
      user.providers.push({
        provider: "facebook",
        providerId: normalizedProfile.providerId,
        displayName: normalizedProfile.displayName,
        email: normalizedProfile.email,
        profilePhoto: normalizedProfile.profilePhoto,
        accessToken: normalizedProfile.accessToken,
        linkedAt: new Date(),
      });

      await user.save();
    }

    // Update the session with the updated user
    sessions.updateSession(req, user);

    // Redirect to the success URL
    if (options.successRedirect) {
      return res.redirect(options.successRedirect);
    } else if (req.session.successRedirect) {
      const successRedirect = req.session.successRedirect;
      delete req.session.successRedirect;
      return res.redirect(successRedirect);
    } else {
      // Fallback to frontend URL if configured
      const frontendUrl = config.urls.frontend + "/auth/success";
      return res.redirect(frontendUrl);
    }
  } catch (err) {
    console.error("Facebook authorization error:", err);

    // Prioritize options over session for failure redirect
    if (options.failureRedirect) {
      return res.redirect(options.failureRedirect);
    } else if (req.session.failureRedirect) {
      const failureRedirect = req.session.failureRedirect;
      delete req.session.failureRedirect;
      return res.redirect(failureRedirect);
    } else {
      // Fallback to frontend failure URL
      return res.redirect(config.urls.frontend + "/auth/failure");
    }
  }
};

module.exports = {
  authenticate,
  authorize,
  getDefaultScopes,
  normalizeProfile,
};
