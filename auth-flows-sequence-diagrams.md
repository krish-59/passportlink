# PassportLink Authentication Flows - Sequence Diagrams

This document outlines the various authentication flows supported by PassportLink and their sequence diagrams.

## Initial Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant OAuth Provider

    User->>Frontend: Clicks "Sign in with [Provider]"
    Frontend->>Backend: GET /auth/{provider}
    Backend->>OAuth Provider: Redirect to provider authorization page
    OAuth Provider->>User: Display consent screen
    User->>OAuth Provider: Authorize application
    OAuth Provider->>Backend: Redirect to /auth/{provider}/callback with auth code
    Backend->>OAuth Provider: Exchange auth code for tokens
    OAuth Provider->>Backend: Return tokens and profile info
    Backend->>Backend: Create or find user account
    Backend->>Backend: Create session
    Backend->>Frontend: Redirect to /auth/success
    Frontend->>Backend: GET /auth/user
    Backend->>Frontend: Return user profile
    Frontend->>User: Display logged-in state
```

## Account Linking Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant OAuth Provider

    Note over User,Frontend: User already logged in
    User->>Frontend: Clicks "Link [Provider] account"
    Frontend->>Backend: GET /auth/link/{provider}
    Backend->>OAuth Provider: Redirect to provider authorization page
    OAuth Provider->>User: Display consent screen
    User->>OAuth Provider: Authorize application
    OAuth Provider->>Backend: Redirect to /auth/{provider}/callback with auth code
    Backend->>OAuth Provider: Exchange auth code for tokens
    OAuth Provider->>Backend: Return tokens and profile info
    Backend->>Backend: Link provider to existing user
    Backend->>Frontend: Redirect to /auth/success
    Frontend->>Backend: GET /auth/user
    Backend->>Frontend: Return updated user profile
    Frontend->>User: Display linked accounts
```

## Account Unlinking Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend

    Note over User,Frontend: User already logged in
    User->>Frontend: Clicks "Unlink [Provider] account"
    Frontend->>Backend: GET /auth/unlink/{provider}
    Backend->>Backend: Validate request
    Note over Backend: Ensure at least one provider remains
    Backend->>Backend: Remove provider from user account
    Backend->>Frontend: Return updated providers list
    Frontend->>User: Display updated linked accounts
```

## Logout Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend

    Note over User,Frontend: User already logged in
    User->>Frontend: Clicks "Logout"
    Frontend->>Backend: POST /auth/logout
    Backend->>Backend: Destroy session
    Backend->>Frontend: Return success message
    Frontend->>User: Display logged-out state
```

## Get User Information Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend

    Note over User,Frontend: User already logged in
    Frontend->>Backend: GET /auth/user
    Backend->>Backend: Validate authentication
    Backend->>Frontend: Return user profile
    Frontend->>User: Display user information
```

## Get Available Providers Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend

    User->>Frontend: Visits login page
    Frontend->>Backend: GET /auth/providers
    Backend->>Backend: Check configured providers
    Backend->>Frontend: Return list of available providers
    Frontend->>User: Display login options
```

## Error Handling Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant OAuth Provider

    User->>Frontend: Clicks "Sign in with [Provider]"
    Frontend->>Backend: GET /auth/{provider}
    Backend->>OAuth Provider: Redirect to provider authorization page
    OAuth Provider->>User: Display consent screen
    User->>OAuth Provider: Denies authorization
    OAuth Provider->>Backend: Redirect to callback with error
    Backend->>Frontend: Redirect to /auth/failure
    Frontend->>User: Display error message
```

## Token Refresh Flow (Implicit)

```mermaid
sequenceDiagram
    participant Frontend
    participant Backend
    participant OAuth Provider

    Note over Frontend,Backend: Session exists but token expired
    Frontend->>Backend: API request with session cookie
    Backend->>Backend: Detect expired token
    Backend->>OAuth Provider: Request new access token using refresh token
    OAuth Provider->>Backend: Return new access token
    Backend->>Backend: Update token in user record
    Backend->>Frontend: Return API response
``` 