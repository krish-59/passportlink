# PassportLink

[![npm version](https://img.shields.io/npm/v/passportlink.svg)](https://www.npmjs.com/package/passportlink)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A streamlined OAuth-based Single Sign-On (SSO) solution that wraps Passport.js to provide multi-provider authentication with account linking capabilities.

## Features

- **Multi-Provider OAuth SSO**: Support for Google, GitHub, Facebook, Microsoft, and LinkedIn
- **Account Linking**: Users can link multiple social accounts to a single profile
- **MongoDB Integration**: Stores user profiles and linked credentials
- **RESTful API**: Clean endpoints for authentication, user info, and account management
- **Secure Sessions**: Implements best practices for session and cookie management
- **Configurable**: Easily adjust settings via environment variables or initialization options
- **Extensible**: Add custom providers or extend user schema

## Installation

```bash
npm install passportlink
```

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
const { PassportLink } = require('passportlink');

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

// Initialize PassportLink
const passportLink = new PassportLink(app, {
  providers: ['google', 'github'], // Include only the providers you want to use
  callbackURL: `${process.env.BASE_URL}/auth/:provider/callback`,
  successRedirect: `${process.env.FRONTEND_URL}/dashboard`,
  failureRedirect: `${process.env.FRONTEND_URL}/login`
});

// Mount PassportLink routes
app.use(passportLink.routes());

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
<a href="/auth/facebook">Connect Facebook</a>
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

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `providers` | Array of enabled OAuth providers | All providers |
| `callbackURL` | OAuth callback URL template | `/auth/:provider/callback` |
| `successRedirect` | Redirect URL after successful authentication | `/` |
| `failureRedirect` | Redirect URL after failed authentication | `/login` |
| `sessionDuration` | Session lifetime in milliseconds | `null` (browser session) |
| `autoLinkByEmail` | Enable automatic account linking by email | `false` |
| `storeSessions` | Store sessions in MongoDB | `true` in production |

## Advanced Customization

### Adding Custom Providers

```javascript
passportLink.useProvider({
  name: 'twitter',
  strategy: require('passport-twitter').Strategy,
  credentials: {
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET
  },
  callbackURL: `${process.env.BASE_URL}/auth/twitter/callback`
});
```

### Extending User Schema

```javascript
passportLink.extendUserSchema({
  role: {
    type: String,
    default: 'user'
  },
  preferences: {
    type: Object,
    default: {}
  }
});
```

### Event Hooks

```javascript
passportLink.on('login', (user, provider) => {
  console.log(`User ${user.email} logged in via ${provider}`);
});

passportLink.on('link', (user, provider) => {
  // Send notification email about new linked account
});
```

## Security Considerations

- Always use HTTPS in production
- Set appropriate SameSite cookie policies
- Configure CORS for your frontend domain
- Implement rate limiting on authentication endpoints
- Keep OAuth credentials secure in environment variables

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 