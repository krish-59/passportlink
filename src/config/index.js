require("dotenv").config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || "development",
  },
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/passportlink",
  },
  session: {
    secret: process.env.SESSION_SECRET,
    cookieName: process.env.SESSION_COOKIE_NAME || "connect.sid",
    cookieSecure: process.env.SESSION_COOKIE_SECURE === "true",
    cookieSameSite: process.env.SESSION_COOKIE_SAMESITE || "lax",
  },
  urls: {
    base: process.env.BASE_URL || "http://localhost:3000",
    frontend: process.env.FRONTEND_URL || "http://localhost:8080",
  },
  oauth: {
    google: {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    facebook: {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    },
    azure: {
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    },
    linkedin: {
      clientID: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    },
  },
};

// Validate required configuration
if (!config.session.secret) {
  throw new Error("SESSION_SECRET is required in environment variables");
}

module.exports = config;
