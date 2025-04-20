const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const cors = require("cors");
const passport = require("./middleware/auth");
const config = require("./config");
const authRoutes = require("./routes/auth");
const { swaggerUi, swaggerDocs, swaggerUiOptions } = require("./utils/swagger");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(
  session({
    secret: config.session.secret,
    name: config.session.cookieName,
    cookie: {
      secure: config.session.cookieSecure,
      sameSite: config.session.cookieSameSite,
    },
    resave: false,
    saveUninitialized: false,
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
mongoose
  .connect(config.mongodb.uri)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Configure CORS for all routes
app.use(
  cors({
    origin: [config.urls.frontend, config.urls.base],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

// Register routes
app.use("/auth", authRoutes);

// Swagger documentation with custom options
const swaggerCustomOptions = {
  ...swaggerUiOptions,
  swaggerOptions: {
    ...swaggerUiOptions.swaggerOptions,
    url: `${config.urls.base}/api-docs/swagger.json`,
  },
};

// Serve Swagger documentation
app.get("/api-docs/swagger.json", (req, res) => {
  res.json(swaggerDocs);
});
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocs, swaggerCustomOptions)
);

// Basic route for testing
app.get("/", (req, res) => {
  res.json({ message: "PassportLink API is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: config.server.env === "development" ? err.message : undefined,
  });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${config.server.env}`);
  console.log(`API documentation available at: ${config.urls.base}/api-docs`);
});

module.exports = app;
