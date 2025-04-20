const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const config = require("../config");
const packageJson = require("../../package.json");

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "PassportLink API Documentation",
      version: packageJson.version,
      description:
        "API documentation for PassportLink - an OAuth-based SSO solution with multiple provider support and account linking",
      contact: {
        name: packageJson.author,
        url: packageJson.homepage,
      },
      license: {
        name: packageJson.license,
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: config.urls.base,
        description: "API Server",
      },
    ],
    tags: [
      {
        name: "Authentication",
        description: "Authentication endpoints for OAuth providers",
      },
      {
        name: "User",
        description: "User management endpoints",
      },
    ],
    components: {
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "User ID",
            },
            name: {
              type: "string",
              description: "User display name",
            },
            email: {
              type: "string",
              description: "User email address",
            },
            emailVerified: {
              type: "boolean",
              description: "Whether the email has been verified",
            },
            providers: {
              type: "array",
              description: "List of linked OAuth providers",
              items: {
                type: "object",
                properties: {
                  provider: {
                    type: "string",
                    description: "Provider name (google, github, etc.)",
                    enum: [
                      "google",
                      "github",
                      "facebook",
                      "microsoft",
                      "linkedin",
                    ],
                  },
                  displayName: {
                    type: "string",
                    description: "Display name from the provider",
                  },
                  email: {
                    type: "string",
                    description: "Email from the provider",
                  },
                  profilePhoto: {
                    type: "string",
                    description: "URL to profile photo",
                  },
                  linkedAt: {
                    type: "string",
                    format: "date-time",
                    description: "When this provider was linked",
                  },
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Account creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Account last update timestamp",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error type",
            },
            message: {
              type: "string",
              description: "Error message details",
            },
          },
        },
      },
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: config.session.cookieName || "connect.sid",
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.js"],
};

// Initialize swagger-jsdoc
const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Swagger UI options
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    syntaxHighlight: {
      theme: "monokai",
    },
    docExpansion: "list",
    deepLinking: true,
  },
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "PassportLink API Documentation",
};

module.exports = {
  swaggerDocs,
  swaggerUi,
  swaggerUiOptions,
};
