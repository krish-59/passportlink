const googleStrategy = require("./google");
const githubStrategy = require("./github");
const facebookStrategy = require("./facebook");
const linkedinStrategy = require("./linkedin");
const microsoftStrategy = require("./microsoft");

/**
 * Configure all supported OAuth strategies for Passport
 *
 * @param {Object} passport - Passport.js instance
 * @param {Object} config - Application configuration
 * @returns {Object} - Object containing all configured strategies
 */
module.exports = (passport) => {
  const strategies = {};

  // Only initialize strategies that have credentials configured
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    strategies.google = googleStrategy(passport);
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    strategies.github = githubStrategy(passport);
  }

  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    strategies.facebook = facebookStrategy(passport);
  }

  if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    strategies.linkedin = linkedinStrategy(passport);
  }

  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    strategies.microsoft = microsoftStrategy(passport);
  }

  return strategies;
};
