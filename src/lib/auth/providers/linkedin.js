/**
 * LinkedIn OAuth Provider Implementation
 *
 * Implements authentication and authorization for LinkedIn,
 * including token exchange and profile retrieval.
 */

const axios = require("axios");
const qs = require("querystring");
const config = require("../../../config");
const User = require("../../../models/User");
const errors = require("../errors");
const sessions = require("../sessions");

/**
 * Get the default scopes for LinkedIn authentication
 * @returns {Array<string>} Array of default scopes
 */
const getDefaultScopes = () => {
  return ["openid", "profile", "email"];
};

/**
 * Build the LinkedIn authorization URL
 * @param {Object} options - Options including scope, state, etc.
 * @returns {string} Authorization URL
 */
const buildAuthorizationUrl = (options = {}) => {
  try {
    const baseUrl = "https://www.linkedin.com/oauth/v2/authorization";

    // Generate random state if not provided
    const state =
      options.state === true
        ? Math.random().toString(36).substring(2)
        : options.state || "";

    // Build URL parameters
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: `${config.urls.base}/auth/linkedin/callback`,
      state,
      scope: options.scope
        ? options.scope.join(" ")
        : getDefaultScopes().join(" "),
    });

    return `${baseUrl}?${params.toString()}`;
  } catch (err) {
    throw errors.createError(
      "Failed to build LinkedIn authorization URL",
      err,
      500
    );
  }
};

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code
 * @returns {Object} Token response data
 */
const exchangeCodeForToken = async (code) => {
  try {
    console.log("Exchanging code for token...");
    const tokenResponse = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      qs.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${config.urls.base}/auth/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return tokenResponse.data;
  } catch (err) {
    throw errors.handleProviderError(err, "linkedin");
  }
};

/**
 * Fetch user profile from LinkedIn API
 * @param {string} accessToken - OAuth access token
 * @returns {Object} User profile data
 */
const fetchUserProfile = async (accessToken) => {
  try {
    console.log("Fetching user profile from LinkedIn...");
    const userInfoResponse = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return userInfoResponse.data;
  } catch (err) {
    throw errors.handleProviderError(err, "linkedin");
  }
};

/**
 * Normalize the profile data from LinkedIn
 * @param {Object} profile - Raw profile from LinkedIn
 * @param {Object} tokens - Token data
 * @returns {Object} Normalized profile data
 */
const normalizeProfile = (profile, tokens) => {
  const linkedinId = profile.sub;
  const email = profile.email;
  const emailVerified = profile.email_verified || false;
  const name =
    profile.name ||
    `${profile.given_name || ""} ${profile.family_name || ""}`.trim() ||
    "LinkedIn User";
  const profilePhoto = profile.picture;

  return {
    providerId: linkedinId,
    provider: "linkedin",
    displayName: name,
    email: email,
    emailVerified: emailVerified,
    profilePhoto: profilePhoto,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresIn: tokens.expires_in || null,
    raw: profile,
  };
};

/**
 * Find or create a user based on LinkedIn profile
 * @param {Object} normalizedProfile - Normalized profile data
 * @returns {Object} User document
 */
const findOrCreateUser = async (normalizedProfile) => {
  try {
    // First, try to find an existing user with this LinkedIn account
    let user = await User.findOne({
      "providers.provider": "linkedin",
      "providers.providerId": normalizedProfile.providerId,
    });

    // If user found, update their token and return
    if (user) {
      // Update the provider data with new tokens
      const providerIndex = user.providers.findIndex(
        (p) =>
          p.provider === "linkedin" &&
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

      // If user with this email exists, link the LinkedIn account
      if (user) {
        user.providers.push({
          provider: "linkedin",
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
        `user-${normalizedProfile.providerId}@linkedin.account`,
      emailVerified: normalizedProfile.emailVerified,
      providers: [
        {
          provider: "linkedin",
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
 * Handle LinkedIn authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @param {Object} options - Authentication options
 */
const authenticate = async (req, res, next, options = {}) => {
  try {
    // Extract code from query if present
    const { code } = req.query;

    // If no code, redirect to LinkedIn for authorization
    if (!code) {
      const authUrl = buildAuthorizationUrl({
        scope: options.scope || getDefaultScopes(),
        state: options.state,
      });
      return res.redirect(authUrl);
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);
    console.log("Token received:", tokenData.access_token ? "YES" : "NO");

    // Get LinkedIn profile
    const profile = await fetchUserProfile(tokenData.access_token);
    console.log("Profile data received:", JSON.stringify(profile, null, 2));

    // Normalize the profile data
    const normalizedProfile = normalizeProfile(profile, tokenData);

    // Find or create user
    const user = await findOrCreateUser(normalizedProfile);

    // Store tokens in session
    sessions.storeTokens(req, "linkedin", tokenData);

    // Login the user
    req.session.user = user;
    req.user = user;

    // Redirect or continue
    if (options.successRedirect) {
      return res.redirect(options.successRedirect);
    }
    next();
  } catch (err) {
    console.error("LinkedIn authentication error:", err);

    // Redirect to failure page or pass error to next middleware
    if (options.failureRedirect) {
      return res.redirect(options.failureRedirect);
    }
    next(err);
  }
};

/**
 * Handle LinkedIn authorization (account linking)
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

    // If no code, redirect to LinkedIn for authorization
    if (!code) {
      const authUrl = buildAuthorizationUrl({
        scope: options.scope || getDefaultScopes(),
        state: options.state,
      });
      return res.redirect(authUrl);
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);

    // Get LinkedIn profile
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

    // Check if this LinkedIn account is already linked to another user
    const existingUser = await User.findOne({
      "providers.provider": "linkedin",
      "providers.providerId": normalizedProfile.providerId,
    });

    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      throw errors.createError(
        "This LinkedIn account is already linked to another user",
        null,
        400,
        { provider: "linkedin" }
      );
    }

    // Check if user already has this provider
    const existingProvider = user.providers.find(
      (p) =>
        p.provider === "linkedin" &&
        p.providerId === normalizedProfile.providerId
    );

    if (existingProvider) {
      console.log("This LinkedIn account is already linked to the user");
      // Update the provider data
      existingProvider.accessToken = normalizedProfile.accessToken;
      existingProvider.refreshToken = normalizedProfile.refreshToken;
      existingProvider.profilePhoto = normalizedProfile.profilePhoto;
      existingProvider.displayName = normalizedProfile.displayName;
      await user.save();
    } else {
      // Add the provider to user
      user.providers.push({
        provider: "linkedin",
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
    sessions.storeTokens(req, "linkedin", tokenData);

    // Update the session with the updated user
    sessions.updateSession(req, user);

    // Redirect or continue
    if (options.successRedirect) {
      return res.redirect(options.successRedirect);
    }
    next();
  } catch (err) {
    console.error("LinkedIn authorization error:", err);

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
