# PassportLink

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A streamlined OAuth-based Single Sign-On (SSO) solution with a custom authentication framework that provides multi-provider authentication with account linking capabilities.

## Features

- **Multi-Provider OAuth SSO**: Support for Google, GitHub, Facebook, Microsoft, and LinkedIn
- **Account Linking**: Users can link multiple social accounts to a single profile
- **MongoDB Integration**: Stores user profiles and linked credentials
- **RESTful API**: Clean endpoints for authentication, user info, and account management
- **Secure Sessions**: Implements best practices for session and cookie management
- **Configurable**: Easily adjust settings via environment variables or initialization options
- **Extensible**: Add custom providers or extend user schema

## Quick Start

### 1. Install dependencies

```bash
npm install express mongoose express-session
```

### 2. Configure your environment variables

Create a `.env` file:

```
# OAuth Provider Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
FACEBOOK_CLIENT_ID=your_facebook_client_id
FACEBOOK_CLIENT_SECRET=your_facebook_client_secret
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/myapp

# Session Configuration
SESSION_SECRET=your_session_secret
BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:8080
```

### 3. Integrate with Express

```javascript
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const customAuth = require('./lib/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Initialize custom auth framework
app.use(customAuth.initialize());

// Mount auth routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// Your other routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Frontend Integration

### Login Buttons

Direct users to the appropriate OAuth provider:

```html
<a href="/auth/google">Login with Google</a>
<a href="/auth/github">Login with GitHub</a>
```

### Getting User Info

After authentication, fetch the current user's profile:

```javascript
async function getUserProfile() {
  const response = await fetch('/auth/user', {
    credentials: 'include'  // Important for sending cookies
  });
  
  if (response.ok) {
    const user = await response.json();
    return user;
  }
  
  return null; // Not authenticated
}
```

### Account Linking

When a user is already logged in, they can link additional accounts:

```html
<a href="/auth/link/facebook">Connect Facebook</a>
```

### Unlinking Accounts

Remove a linked provider (as long as at least one remains):

```javascript
async function unlinkProvider(provider) {
  const response = await fetch(`/auth/unlink/${provider}`, {
    credentials: 'include'
  });
  
  return response.ok;
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/:provider` | GET | Initiates OAuth flow with the specified provider |
| `/auth/:provider/callback` | GET | OAuth callback endpoint |
| `/auth/user` | GET | Returns the authenticated user's profile |
| `/auth/logout` | POST | Logs out the current user |
| `/auth/unlink/:provider` | GET | Unlinks the specified provider from the user's account |
| `/auth/link/:provider` | GET | Initiates linking a new provider to the current user |
| `/auth/providers` | GET | Returns a list of configured providers |

## Security Considerations

- Always use HTTPS in production
- Set appropriate SameSite cookie policies
- Configure CORS for your frontend domain
- Implement rate limiting on authentication endpoints
- Keep OAuth credentials secure in environment variables

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## How to Run the Project

### Prerequisites
- Node.js (v18.17.0 or higher)
- MongoDB running locally or accessible via connection string

### Setup

1. Clone the repository:
```bash
git clone https://github.com/username/auth-project.git
cd auth-project
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy the `.env.example` file to `.env` (or create a new `.env` file)
   - Update the values in `.env` with your configuration:
     - Set the MongoDB connection string
     - Configure session secrets
     - Add OAuth credentials for the providers you want to use

```
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/authdb

# Session Configuration
SESSION_SECRET=your_session_secret_here
SESSION_COOKIE_NAME=connect.sid
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAMESITE=lax

# Base URLs
BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:8080

# OAuth Provider Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
# Add more provider credentials as needed
```

4. Start the server:

**Production:**
```bash
npm start
```

**Development (with auto-reload):**
```bash
npm run dev
```

### Testing the API

Once the server is running:

1. Access the API documentation at: `http://localhost:3000/api-docs`
2. Test authentication flows with the available endpoints:
   - `/auth/providers` - Get a list of configured providers
   - `/auth/{provider}` - Initiate login with a provider
   - `/auth/user` - Get the current user's profile
   - `/auth/logout` - Log out the current user

### Setting Up OAuth Providers

For each OAuth provider you wish to use:

1. Create a developer account/application with the provider
2. Configure the callback URLs in the provider's dashboard:
   - Google: `http://localhost:3000/auth/google/callback`
   - GitHub: `http://localhost:3000/auth/github/callback`
   - Facebook: `http://localhost:3000/auth/facebook/callback`
   - Microsoft: `http://localhost:3000/auth/microsoft/callback`
   - LinkedIn: `http://localhost:3000/auth/linkedin/callback`
3. Add the client ID and secret to your `.env` file 