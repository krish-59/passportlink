/**
 * GitHub OAuth Provider Implementation
 *
 * Implements authentication and authorization for GitHub,
 * including token exchange and profile retrieval via GitHub API.
 */

const axios = require("axios");
const qs = require("querystring");
const config = require("../../../config");
const User = require("../../../models/User");
const errors = require("../errors");
const sessions = require("../sessions");

/**
 * Get the default scopes for GitHub authentication
 * @returns {Array<string>} Array of default scopes
 */
const getDefaultScopes = () => {
  return ["user:email"]; // We need at least user:email scope to get email
};

/**
 * Build GitHub authorization URL
 * @param {Object} options - Options for authorization
 * @returns {string} Authorization URL
 */
const buildAuthorizationUrl = (options = {}) => {
  // Initialize params with required values
  const params = {
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${config.urls.base}/auth/github/callback`,
    allow_signup: true, // Allow users to sign up via OAuth
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
  const authUrl = `https://github.com/login/oauth/authorize?${qs.stringify(
    params
  )}`;

  console.log(
    "Generated GitHub auth URL (without state):",
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
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${config.urls.base}/auth/github/callback`,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("GitHub token exchange failed:", error.message);

    // Log response data if available
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Response data:", error.response.data);
    }

    throw errors.createError(
      "Failed to exchange GitHub authorization code for tokens",
      error,
      500
    );
  }
};

/**
 * Fetch user profile from GitHub API
 * @param {string} accessToken - OAuth access token
 * @returns {Object} User profile data
 */
const fetchUserProfile = async (accessToken) => {
  try {
    console.log("Fetching user profile from GitHub API...");
    // First get the main user info
    const userInfoResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    // Then get user emails because they might not be in the main profile
    const emailsResponse = await axios.get(
      "https://api.github.com/user/emails",
      {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    // Combine the profile with email information
    const userInfo = userInfoResponse.data;
    const emails = emailsResponse.data;

    // Find the primary email or the first verified one
    const primaryEmail =
      emails.find((email) => email.primary && email.verified) ||
      emails.find((email) => email.verified) ||
      emails[0];

    if (primaryEmail) {
      userInfo.email = primaryEmail.email;
      userInfo.email_verified = primaryEmail.verified;
    }

    return userInfo;
  } catch (err) {
    throw errors.handleProviderError(err, "github");
  }
};

/**
 * Normalize the profile data from GitHub
 * @param {Object} profile - Raw profile from GitHub
 * @param {Object} tokens - Token data
 * @returns {Object} Normalized profile data
 */
const normalizeProfile = (profile, tokens) => {
  const githubId = profile.id.toString();
  const email = profile.email;
  const name = profile.name || profile.login || "GitHub User";
  const profilePhoto = profile.avatar_url;

  return {
    providerId: githubId,
    provider: "github",
    displayName: name,
    email: email,
    emailVerified: profile.email_verified || false,
    profilePhoto: profilePhoto,
    accessToken: tokens.access_token,
    refreshToken: null, // GitHub does not provide refresh tokens
    expiresIn: null, // GitHub tokens don't have an expiration by default
    raw: profile,
  };
};

/**
 * Find or create a user based on GitHub profile
 * @param {Object} normalizedProfile - Normalized profile data
 * @returns {Object} User document
 */
const findOrCreateUser = async (normalizedProfile) => {
  try {
    // First, try to find an existing user with this GitHub account
    let user = await User.findOne({
      "providers.provider": "github",
      "providers.providerId": normalizedProfile.providerId,
    });

    // If user found, update their token and return
    if (user) {
      // Update the provider data with new tokens
      const providerIndex = user.providers.findIndex(
        (p) =>
          p.provider === "github" &&
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
    if (normalizedProfile.email && normalizedProfile.emailVerified) {
      user = await User.findOne({ email: normalizedProfile.email });

      // If user with this email exists, link the GitHub account
      if (user) {
        user.providers.push({
          provider: "github",
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
      email: normalizedProfile.email,
      emailVerified: normalizedProfile.emailVerified,
      providers: [
        {
          provider: "github",
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
 * Handle GitHub authentication
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
      console.error(`GitHub OAuth error: ${error} - ${error_description}`);
      if (options.failureRedirect) {
        return res.redirect(options.failureRedirect);
      }
      throw new Error(`GitHub OAuth error: ${error_description || error}`);
    }

    // If no code, redirect to GitHub for authorization
    if (!code) {
      const authUrl = buildAuthorizationUrl({
        scope: options.scope, // Just pass the scope directly, don't override
        state: options.state,
      });
      console.log("Redirecting to GitHub authorization URL:", authUrl);
      return res.redirect(authUrl);
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);
    console.log(
      "GitHub token received:",
      tokenData.access_token ? "YES" : "NO"
    );

    // Get GitHub profile
    const profile = await fetchUserProfile(tokenData.access_token);
    console.log("GitHub profile data received");

    // Normalize the profile data
    const normalizedProfile = normalizeProfile(profile, tokenData);

    // Find or create user
    const user = await findOrCreateUser(normalizedProfile);

    // Store tokens in session
    sessions.storeTokens(req, "github", tokenData);

    // Login the user
    req.session.user = user;
    req.user = user;

    // Redirect or continue
    if (options.successRedirect) {
      return res.redirect(options.successRedirect);
    }
    next();
  } catch (err) {
    console.error("GitHub authentication error:", err);

    // Redirect to failure page or pass error to next middleware
    if (options.failureRedirect) {
      return res.redirect(options.failureRedirect);
    }
    next(err);
  }
};

/**
 * Handle GitHub authorization (account linking)
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

    // If no code, redirect to GitHub for authorization
    if (!code) {
      const authUrl = buildAuthorizationUrl({
        scope: options.scope, // Just pass the scope directly, don't override
        state: options.state,
      });
      return res.redirect(authUrl);
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);

    // Get GitHub profile
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

    // Check if this GitHub account is already linked to another user
    const existingUser = await User.findOne({
      "providers.provider": "github",
      "providers.providerId": normalizedProfile.providerId,
    });

    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      throw errors.createError(
        "This GitHub account is already linked to another user",
        null,
        400,
        { provider: "github" }
      );
    }

    // Check if user already has this provider
    const existingProvider = user.providers.find(
      (p) =>
        p.provider === "github" && p.providerId === normalizedProfile.providerId
    );

    if (existingProvider) {
      console.log("This GitHub account is already linked to the user");
      // Update the provider data
      existingProvider.accessToken = normalizedProfile.accessToken;
      existingProvider.profilePhoto = normalizedProfile.profilePhoto;
      existingProvider.displayName = normalizedProfile.displayName;
      await user.save();
    } else {
      // Add the provider to user
      user.providers.push({
        provider: "github",
        providerId: normalizedProfile.providerId,
        displayName: normalizedProfile.displayName,
        email: normalizedProfile.email,
        profilePhoto: normalizedProfile.profilePhoto,
        accessToken: normalizedProfile.accessToken,
        linkedAt: new Date(),
      });

      await user.save();
    }

    // Store tokens in session
    sessions.storeTokens(req, "github", tokenData);

    // Update the session with the updated user
    sessions.updateSession(req, user);

    // Redirect or continue
    if (options.successRedirect) {
      return res.redirect(options.successRedirect);
    }
    next();
  } catch (err) {
    console.error("GitHub authorization error:", err);

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
