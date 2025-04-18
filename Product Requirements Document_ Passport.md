# **Product Requirements Document: Passport.js SSO Wrapper NPM Package**

## **Introduction and Overview**

This document outlines the requirements for an **NPM package** that wraps Passport.js to provide a streamlined **OAuth-based Single Sign-On (SSO)** solution. The package will support multiple social login providers and allow users to **link multiple social accounts** (Google, GitHub, Facebook, Microsoft, LinkedIn) to a single application user profile. It leverages **MongoDB** as the database for storing user information and linked accounts. The goal is to deliver a plug-and-play backend module that **simplifies integration with any frontend framework** (React, Vue, Angular, etc.) by exposing clear RESTful APIs and callback endpoints. This will let front-end applications easily initiate OAuth logins, handle provider callbacks, retrieve user info, and log users out, without having to handle Passport.js internals.

The product is targeted at **backend developers** who want to add social login/SSO functionality to their Node.js applications with minimal effort. By encapsulating common logic (Passport strategy setup, session management, account linking, etc.), the package aims to reduce boilerplate and ensure best practices in security and user experience.

## **Core Features and Goals**

* **Multi-Provider OAuth SSO:** Out-of-the-box support for popular OAuth providers – Google, GitHub, Facebook, Microsoft, and LinkedIn. Developers can easily enable/disable providers via configuration. The package uses Passport.js strategies under the hood for each provider.

* **Single User, Multiple Accounts:** Ability to **link multiple social logins to one user account** in the application. Users can sign in with any of their linked providers and still access the same account. (This is recommended so that if a user stops using one provider, they can still access their account via another ([Documentation: Facebook](https://www.passportjs.org/concepts/authentication/facebook/#:~:text=Linking%20social%20accounts%20to%20a,independent%20of%20their%20Facebook%20account)).)

* **MongoDB User Store:** Uses MongoDB to store user profiles and their linked OAuth credentials. Includes a predefined schema (with flexibility for customization) to accommodate multiple providers per user.

* **Easy Frontend Integration:** Provides clear HTTP endpoints (APIs) for frontends to initiate login with a provider, handle the OAuth callback, get the current user's info, link/unlink accounts, and log out. Frontend apps can be single-page applications or server-rendered – the integration should be framework-agnostic.

* **Passport.js Abstraction:** Hides Passport.js's complex configuration. Developers do not need to manually configure strategies or serialization. The package initializes Passport with all configured providers, session management, and necessary middleware.

* **Secure Session Management:** Implements session and cookie handling for maintaining login state between requests. Uses secure cookies and follows best practices to prevent common security issues (CSRF, XSS, session hijacking, etc.).

* **Configurable and Extensible:** Easily configurable via environment variables or an init config object (for OAuth credentials, callback URLs, etc.). Designed to be extensible – e.g. adding new OAuth providers or custom user fields – without modifying core code.

* **Minimal Setup:** The package aims for a developer-friendly setup – e.g. after installing, a developer might just supply credentials and mount the provided routes, then have fully functional SSO. The complexity of OAuth flows and account linking is handled internally.

* **Robust Error Handling:** Clear error scenarios and messages for cases like OAuth failures, account linking conflicts, missing information (like no email from provider), etc., to help developers handle edge cases gracefully in their frontends.

## **User Stories and Use Cases**

To clarify how the package will be used, below are detailed **user stories and scenarios**, including normal flows and edge cases:

* **New User Sign-Up via Social Login:** As a *new user*, I can click "Sign in with Google" (or any provider) on the frontend. The frontend will redirect me to the provider's OAuth page via the backend's API. Upon consent, I am redirected back and automatically registered in the application. A new user record is created in MongoDB with my basic profile info (name, email, provider ID). I end up logged into the app.

* **Returning User Login via Any Linked Provider:** As a *returning user*, I want to log in with any of my linked social accounts. For example, I initially signed up with Google, but I can later use the "Login with GitHub" button. After OAuth with GitHub, the system recognizes my email or linked account and logs me into the same unified profile. I don't accidentally create a duplicate account.

* **Linking an Additional Social Account (While Logged In):** As a *logged-in user*, I want to connect an additional provider to my account. For instance, I signed up with Facebook and am currently logged in; I can go to a "Connect another account" screen and click "Connect Google." The frontend begins the Google OAuth flow (using the same login endpoint, or a dedicated link endpoint). After successful OAuth callback, my Google account is now linked to my existing user profile. Next time, I can log in with either Facebook or Google.

* **Unlinking a Social Account:** As a *user*, I can unlink a provider from my account if I no longer want to use it for login. For example, if I have Google and GitHub linked, I might choose to unlink GitHub. The system will require that I still have at least one login method linked (prevent removing all login methods). After unlinking, I can no longer use GitHub to sign in, but my account remains accessible via Google.

* **Logout:** As a *user*, I can log out from the application. On the frontend, triggering logout will call the provided `/logout` API. My session is destroyed server-side and cookies are cleared so that no authenticated state remains. Any subsequent attempt to fetch protected user info without logging in again will fail (redirect to login or 401 response).

* **Auto-Link on First Login by Email (Optional Scenario):** As a *user*, if I sign in with a provider that shares an email address already in use by an existing account, the system can automatically link the new login method to that account. For example, I registered with GitHub (which gave email `alice@example.com`). Later, I click "Login with Microsoft" using the same email `alice@example.com`. Instead of creating a new user, the package could detect the matching verified email and merge this Microsoft login into my existing profile. I then remain logged in as the original user. *(This behavior might be configurable to require manual linking vs. auto-link.)*

* **Edge Case – Unverified Email from Provider:** As a *user*, if my OAuth provider account doesn't provide a verified email, the system handles it gracefully. For instance, if LinkedIn returns an email that is not verified or a provider doesn't supply email at all, the package might treat that login as a new separate account (to avoid wrongly merging two different people). It could flag the user record as requiring email verification or prompt me (via the application) to confirm an email address. The PRD should ensure no silent account linking occurs solely on an unverified email match.

* **Edge Case – Switching Providers with Different Emails:** As a *user*, I might use different emails for different providers (e.g., Google account with personal email vs. GitHub with work email). In this case, if I log in via a second provider and the email does not match any existing account, a new user profile will be created. Later, I may realize I have two accounts and use a "merge accounts" feature (not in MVP scope) or just link them manually by adding the other email as an alternate contact on one account. The system should record the email from each provider and allow the user/developers to reconcile if needed.

* **Edge Case – Account Already Linked Conflict:** As a *user*, I should be prevented from linking a social account that is already linked to another user in the system. For example, if I have two separate app accounts and each is linked to a different Google account, I shouldn't be able to link Google from account A if that Google ID is already associated with account B. The API should handle this by rejecting the link attempt with a clear error (so the frontend can inform the user or prompt to merge accounts via a different process).

* **Developer Use Case – Integration:** As a *developer*, I want to integrate this package in my Express backend with minimal code. I should be able to configure the OAuth credentials for each provider, provide my MongoDB connection string, and mount the package's routes. Then on the frontend, I simply create buttons or links pointing to the appropriate login URLs (e.g., `/auth/google`) and handle redirects. The package will provide callbacks and session management, so I can call an endpoint like `/auth/user` to check if a user is logged in and get their profile data for display.

* **Developer Use Case – Customizing User Data:** As a *developer*, I may want to store additional information in the user profile (such as roles, preferences, or profile details beyond what the OAuth providers give). The package should allow extending the user schema or adding custom fields easily, so that when a user is created or fetched, I can have those custom fields present. I might also want to hook into events (like on new user creation) to, say, send a welcome email or perform other business logic.

* **Failure Scenario – OAuth Denial:** As a *user*, if I cancel or deny the OAuth permission on the provider side, I should be returned to the application gracefully. The package should handle provider errors or denials by redirecting back to a specified failure URL or sending an error response to the frontend (e.g., redirect to `/login` page with an error message). This ensures a good UX even when OAuth isn't completed.

* **Failure Scenario – Missing Provider Config:** As a *developer*, if I forgot to configure a provider or set it up incorrectly, the package should fail clearly at startup or when the route is hit (for example, throwing an error if client ID/secret is missing for a provider that's enabled). This will help me catch configuration issues early. Possibly, the package can also disable routes for providers that aren't configured to avoid broken links.

* **Session Expiration:** As a *user*, if my session expires (e.g., I remained idle or the server restarted), I should be prompted to log in again. The package will ensure that protected calls like `/auth/user` return an unauthorized status when no valid session is present, so the frontend can redirect to login. Session expiration or renewal might be configurable (e.g., session duration).

These scenarios cover the primary ways the SSO wrapper will be used and the important edge cases the package must handle.

## **User Account Linking Logic**

A core feature is linking multiple OAuth identities to a single user record. The package's logic flow for account linking will work as follows:

* **Initial Login / Account Creation:** When a user first logs in with any provider (say Google), the system checks if there's an existing user with the same provider **ID** or email:

  * If no matching user exists, a **new user** is created in MongoDB. The user document will include the Google account info (Google ID, email, name, etc.) as the first linked provider.

  * If a user already exists with that provider's unique ID (unlikely on first login) or the same email (and we trust the email), the system may either **link** to that user or treat it as a conflict based on configuration. By default, to avoid accidental merges, the safer approach is to create a new account if the email is not yet known to the system. However, configuration may allow auto-linking by email if the email is verified.

* **Subsequent Login (No Active Session):** When a user attempts to log in via a provider and they are **not currently logged in** (no session):

  * The package (Passport strategy) will identify the user based on the provider's credentials. If a user with the provider's ID is found in the database, that existing user is logged in (session established).

  * If no user with that provider ID is found, the system then checks for a user with a matching email address.

    * If a single user with that email exists (and ideally the email from the provider is verified), the package will **link this new provider to that user**. In practice, this means updating the user's record to add the new provider's details under their linked accounts. The user is then logged in as that existing account. This avoids duplicate accounts for the same email identity.

    * If no user with that email exists, a new user is created (as in initial sign-up).

    * If the email exists but is associated with another account that already has a different provider login, then the system has essentially auto-merged the accounts via email. (This behavior should be carefully controlled to prevent linking two unrelated accounts that just happen to share an email; hence, some apps might disable auto-link by email and require explicit linking.)

    * **Unverified Email Caution:** If the provider's email is unverified or not provided, the package will *not* auto-link on email alone. It will create a new account (or require a manual merge) to avoid security issues.

* **Linking While Logged In (Add Account):** If the user is **already logged in** to our application (has an active session) and wants to connect another social account:

  * The frontend can direct the user to the same OAuth initiation endpoint (e.g., `/auth/linkedin`). The package will detect an existing `req.user` session. In this case, instead of treating it as a fresh login, it will treat it as an **account linking authorization**. (Under the hood, Passport allows this via `passport.authorize()` vs `passport.authenticate()`.)

  * The user goes through the OAuth flow with the new provider. Upon callback, the package sees that there was a logged-in user, and thus links the new third-party account to the current user's profile. The result: the current user's document in MongoDB is updated to include LinkedIn as a linked provider (with the LinkedIn ID, etc.).

  * The session remains for the same user (now augmented with an additional login method). The frontend might update the UI to show that another account is connected.

  * If the new provider's identity is already linked to a different user in the DB (conflict scenario), the package should abort linking and return an error (for example, respond with a 409 Conflict or similar), since one social account cannot be linked to two application users.

* **Unlinking a Provider:** The package will support an **unlink** operation. When a user (with an active session) hits an unlink endpoint (e.g., `/auth/unlink/google`):

  * The system will verify the user is authenticated and that the specified provider is currently linked to their account.

  * It will then remove the provider's credentials from the user's record in MongoDB.

  * Business rule: A user must always have at least one active login method. The package will enforce that you cannot unlink the last remaining provider. If a user tries to unlink their only linked account, the API will return an error or no-op (unless a future feature allows converting to a local email/password login as a fallback).

  * On successful unlink, the backend can return a status and the updated list of linked accounts. The frontend should reflect that the account is disconnected. The user's session can remain (they're still logged in via whatever method they originally used this session, or we consider the session still valid but now missing one linked identity).

* **Profile Merge Considerations:** In case the system auto-creates two separate user profiles for the same person (e.g., user logged in with different emails on different providers), merging those accounts would be a complex operation possibly involving user confirmation. This PRD does not cover automatic merging beyond the email linking logic. However, the presence of account linking means a user or admin could manually link accounts by choosing a primary account and adding the secondary's provider to it (then possibly deleting the secondary account). This manual merge would be essentially facilitated by the linking feature when used carefully.

* **Data Consistency:** When linking accounts, the package will ensure that key unique fields (like email or provider IDs) maintain consistency:

  * If two linked providers return different emails for the user, the system might store both emails (one as primary, others as secondary) to avoid losing information. The primary email on the user profile could remain the one from the first sign-up or be updated if we consider one email verified and preferable.

  * Provider-specific unique identifiers (like Google's sub ID, GitHub ID) will be stored in an array or sub-document structure, ensuring quick lookups. We will ensure no two users store the same provider ID.

* **Login Session After Linking:** If a user linked a new account during an existing session, they continue in the same session. If a user logs in via a different provider (with same email) and gets linked to an existing account, the new login will start a session for that existing account (effectively logging them in as that user). From the frontend perspective, it's a seamless login— they may not even realize that behind the scenes an account was linked.

* **Passport.js Implementation Detail:** Internally, the package will use Passport's mechanisms:

  * `passport.authenticate(provider)` for normal login attempts (which will call our verify callback to handle account creation or finding).

  * `passport.authorize(provider)` for linking when a user is already logged in. This ensures that the primary login session (`req.user`) isn't replaced; instead, Passport provides the new account info in `req.account` so it can be attached to the existing user.

  * The custom verification callback for each strategy will handle both scenarios by checking `req.user` (if present, link accounts; if not, find or create user) – this pattern is based on known Passport account linking approaches ([Linking multiple logins · Issue \#81 · jaredhanson/passport · GitHub](https://github.com/jaredhanson/passport/issues/81#:~:text=if%28%20%21req.user%20%29%7B%20%2F,)) ([Linking multiple logins · Issue \#81 · jaredhanson/passport · GitHub](https://github.com/jaredhanson/passport/issues/81#:~:text=module.exports%20%3D%20,else)).

* **Error Handling in Linking Logic:**

  * If linking fails (e.g., database error, or account conflict), the callback endpoint should not log the user out or corrupt the session. It should return an error message that the frontend can display. The user remains logged in (with their original account unaffected).

  * If auto-link by email is disabled and a user tries to login with another provider that has the same email, the package might either create a new account or refuse login with a message that the email is already in use (depending on desired policy). For MVP, simpler is to allow a new account to be created to avoid blocking login – the user then could manually merge if needed.

  * The logic will avoid races and duplicates by using proper database queries (for example, when creating a user or linking, use atomic operations or checks to ensure no two parallel requests create two accounts for the same provider ID).

## **Backend API Endpoints**

To facilitate the frontend integration, the package will expose a set of RESTful API endpoints (Express routes) that cover the entire authentication flow and account management. All endpoints will be documented clearly for developers. Below is a list of expected endpoints and their behaviors:

* **`GET /auth/:provider`** – **Initiate OAuth Login.** This endpoint starts the OAuth flow with the given provider. For example, `/auth/google` will redirect the user to Google's OAuth consent screen. The `:provider` path parameter can be `google`, `github`, `facebook`, `microsoft`, or `linkedin` (or any configured provider). The endpoint will invoke `passport.authenticate(provider)` with appropriate scopes. The frontend can use this by redirecting the user's browser to this URL (or opening it in a popup window). There is typically no JSON response (since it redirects); any errors in immediate request (like unknown provider) will result in an error page or JSON error.

  * *Optional details:* This endpoint could accept a query param (e.g., `?callbackUrl=/dashboard`) if the developer wants to specify a custom redirect target after login, but generally the final redirect is configured centrally.

  * The route should be protected against being called in non-browser contexts if needed (since it's meant to redirect to external site).

* **`GET /auth/:provider/callback`** – **OAuth Callback/Redirect URI.** This endpoint is the redirect target that OAuth providers will call after the user authenticates on their side. For example, after Google login, it will redirect back to our server at `/auth/google/callback` with an auth code. The package will handle this by calling `passport.authenticate(provider, { failureRedirect, successRedirect })`.

  * On success: It establishes a session for the user (if login or linking was successful) and then redirects the user to a front-end page. The **success redirect URL** should be configurable (for instance, the developer can set it to their frontend's dashboard or a generic landing page). Often, for SPAs, this might redirect to something like `https://myapp.com/auth/success` which the SPA knows to handle (e.g., maybe just a blank page that triggers a client-side check).

  * On failure: It redirects to a configurable failure page or returns an error. FailureRedirect could be set to the front-end's login page (with perhaps an error message in session or query string).

  * During this callback, the package's verify logic will handle user creation or linking as described in the linking logic section. After that, the user info is stored in session.

  * **Note:** The exact path for callbacks might differ per provider (some might require unique URLs). The package will document what redirect URI to register for each provider (likely `BASE_URL/auth/{provider}/callback`).

* **`GET /auth/user`** (or `/auth/profile` or similar) – **Get Current User Info.** This endpoint returns the authenticated user's profile information in JSON. Frontend apps can call this (e.g., on page load) to check if the user is logged in (session active) and retrieve their details.

  * If the session is valid, respond with user data: typically user ID, name, primary email, and a list of linked providers (and possibly any profile photos or usernames from each).

  * If no active session, respond with an unauthorized status (HTTP 401\) or a JSON `{error: "Not authenticated"}`. This tells the frontend to treat the user as logged out.

  * This endpoint helps decouple the front-end from having to store JWTs or other tokens; it can rely on the session cookie set by the login process.

  * The data returned will not include sensitive info like raw tokens or secrets – mostly profile and an identifier.

* **`POST /auth/logout`** – **Log Out.** This endpoint logs the user out of the application. It requires an active session (cookie) to identify the session. On call, it will:

  * Destroy the server-side session (removing the session from store).

  * Clear the authentication cookie (by setting it to expire or an empty value).

  * Return a success status (e.g., 204 No Content or a JSON message) or redirect the user to a logged-out page.

  * The frontend can call this via an AJAX request or by navigating to it (since it's idempotent and has no side effects beyond clearing session, GET could also be allowed for simplicity). Using POST for logout is slightly more secure to prevent CSRF logout, but either can be implemented with proper CSRF protection.

* **`GET /auth/unlink/:provider`** – **Unlink a Provider.** This endpoint removes a linked social login from the user's account. It must be called while the user is logged in (so we have a user context).

  * Example: `GET /auth/unlink/google` – will remove the Google account link from the currently authenticated user.

  * The route will verify that the user has at least one other provider linked (if not, it will return an error to prevent leaving the account with no login method).

  * On success, it updates the user's MongoDB document (removing the provider info) and returns a JSON confirmation (possibly the updated user profile or list of remaining linked accounts).

  * This could also be implemented as `DELETE /auth/provider/:provider` to be more RESTful. The PRD specifies functionality, and exact routing style can be decided (but will be documented).

* **`GET /auth/link/:provider`** – **(Optional) Explicit Link Endpoint.** Depending on implementation, the package might use the same `GET /auth/:provider` route to both login and link accounts (detecting session). Alternatively, it could provide separate endpoints for clarity:

  * For instance, `GET /auth/link/google` could behave just like `/auth/google` but is semantically for linking. In practice, it might just call `passport.authorize('google')` internally.

  * This separation might help front-end to use different UI flows (e.g., in account settings use `/auth/link/...` so that it knows to not log the user out on completion).

  * In either case, the functionality overlaps with the login endpoint. The PRD leaves it to implementation whether a unified or separate route is used, but the capability is required.

* **Other Endpoints/Utilities:**

  * The package might provide an endpoint to list available providers or configuration (for example, a `GET /auth/providers` could return which providers are enabled in this deployment, so the front-end can dynamically show the appropriate login options).

  * If needed, an endpoint to refresh the user session or check session validity (though `/auth/user` essentially covers that).

  * Health check endpoint (not specific to auth, but often a small API has a ping route; not a requirement here unless needed for deployment).

  * Webhook endpoints are not in scope (the providers call our callback, which we handle as above).

**Callback URL Handling:** The success and failure redirect URLs (where the user is sent after the OAuth flow) will be configurable. Often for SPAs, the backend will redirect to a known front-end route (like `/auth/callback`) on the same domain or a specific domain configured. For example, a configuration could specify `FRONTEND_URL=https://myapp.com` and the package will redirect to `${FRONTEND_URL}/oauth-success` on success (perhaps setting a short-lived cookie or including a flag that login succeeded). On failure, it might redirect to `${FRONTEND_URL}/login?error=...`. This ensures the user ends up in the frontend context after authentication.

**Usage Example:** A typical login flow using these endpoints:

1. User clicks "Login with GitHub" in the React app. The app either does `window.location = '/auth/github'` or opens a new window pointing to that URL.

2. The user is redirected to GitHub, authorizes the app, and GitHub calls back to `/auth/github/callback?code=...` on our server.

3. The package processes the callback, links/creates user as needed, establishes session, and then redirects the user to the front-end (e.g., `https://myapp.com/home`).

4. The front-end now, on its `home` route, likely calls `/auth/user` to get the user's data (since the session cookie is now set in the browser). The endpoint returns JSON with the user profile, which the front-end uses to display the user's name, etc.

5. If at some later point the user chooses to connect another account, say from their profile page they click "Connect Facebook", the app hits `/auth/facebook` (with the user already logged in). The flow is similar: go to Facebook, callback to `/auth/facebook/callback`, package links accounts, and perhaps this time instead of redirecting to home, it could redirect back to the profile page or return to the SPA with a message (configurable success redirect).

6. If the user clicks "Logout", the app calls `/auth/logout`, which clears the session. The app can then update state to show logged-out view (and optionally redirect to a public page).

All endpoints will enforce proper security (checking sessions where needed, validating input parameters like `:provider` to be one of the allowed providers, etc.). The documentation generated with the package will enumerate these routes and how to use them from the frontend.

## **MongoDB Schema Design**

The package will use MongoDB to persist user information. A single **User collection** will be used to store user profiles along with their linked social accounts. Below is a proposed schema (in a Mongo/Mongoose-like notation):

**Collection:** `users`

**User Document Fields:**

* **\_id:** ObjectId (MongoDB's primary key for the user).

* **name:** String – The user's display name. This could be pulled from the first OAuth profile (e.g., Google name). It might be updated if the user links another account with a different name, but generally one name is stored (or optionally separate fields per provider if needed).

* **email:** String – The user's primary email address. Ideally, this is a verified email from one of the providers. If multiple providers have different emails, one is chosen as primary (possibly the first one used to register, or the one the user confirms). We may also store additional emails in the linked accounts array (see below) or in a separate field like `emails: [String]` for reference.

* **emailVerified:** Boolean – Indicates if the primary email is verified. For social logins, typically the email from a major provider is verified (Google, Microsoft, LinkedIn usually provide verified emails; Facebook can provide an email which is usually verified by Facebook, GitHub can have unverified emails if not confirmed). This flag can be set true if we trust the provider's verification or if the app itself verifies email separately.

* **providers:** Array of subdocuments – **Linked Accounts.** Each subdocument represents a social login linked to this user. Fields in each subdocument:

  * **provider:** String – the provider name (e.g., `"google"`, `"github"`, `"facebook"`, `"microsoft"`, `"linkedin"`). This also serves to identify which Passport strategy to use for this account.

  * **providerId:** String – the unique user ID from that provider. For example, Google's sub ID, GitHub user ID, Facebook ID, etc. This, combined with provider, is unique in our system (we will enforce that no two users have the same provider+providerId pair).

  * **displayName:** String – (optional) the display name from that provider (for reference, could be used if needed).

  * **email:** String – (optional) email address as reported by that provider (this may be the same as the main email or different; storing it can help in account linking decisions or contacting the user via any of their emails).

  * **profilePhoto:** String – (optional) URL of the profile picture or avatar from that provider, if available. Could be useful for UI (e.g., showing the user's Google avatar).

  * **accessToken:** String – (optional, sensitive) OAuth access token granted by the provider. Storing this is not strictly required for login purposes (once the session is established, we don't need the token). But if the application plans to use the token to call provider APIs on behalf of the user (e.g., to fetch additional data or post something), this could be stored. **Security consideration:** If stored, tokens should be encrypted or at least very well protected. Some apps might choose not to store the access token at all, or only store refresh tokens if long-term API access is needed.

  * **refreshToken:** String – (optional, sensitive) OAuth refresh token, if provided by the strategy and if the app wants to maintain long-term access. Similarly protected as accessToken.

  * **linkedAt:** Date – timestamp of when this provider was linked to the account (useful for auditing and display "Linked on Jan 5, 2025").

  * (Any other provider-specific profile fields deemed useful can be stored, or a generic `profile` object to hold raw provider profile as needed. But minimally, we need provider and providerId, plus maybe email.)

* **createdAt:** Date – when the user record was created.

* **updatedAt:** Date – when the user record was last updated (could update on each login or linking).

* **lastLogin:** Date – (optional) track the last time the user logged in successfully, for auditing.

* **sessions:** \[optional collection or reference\] – We might not store sessions in the user document, but if using an external session store, session IDs might reference userId. Usually not embedded here; session management is separate (like in-memory or another collection).

* **customFields:** Mixed – (optional/extensible) If developers want to add extra fields, the schema could allow arbitrary additional fields. For example, a developer may add `role: String` or `preferences: {...}` to the schema. If using Mongoose, we can allow the schema to be extended or we provide a plugin mechanism.

**Indexes & Constraints:**

* Unique index on `providers.provider` \+ `providers.providerId` to ensure no duplicate social account across users. Alternatively, we could structure it as separate records, but assuming one user doc contains multiple providers, ensuring uniqueness might require a manual check or a compound index on array elements (which MongoDB can do with a partial index or using each element's fields).

* Index on `email`: quick lookup by email. If auto-link by email is used or for any internal check, looking up by email should be fast. `email` can be unique if we decide one email \= one user policy (though linking challenges that if different emails per provider for one user, but we store one primary email).

* Perhaps an index on each provider field for querying: e.g. a compound index on `providers.provider` and `providers.providerId` (as above).

* The schema should be designed such that it's easy to query by either the provider ID (to find the user logging in) or by email, and to update by adding a provider subdocument.

**Alternate Schema Approaches Considered:**

* We could use two collections: `users` and `accounts` (or `credentials`). For example, each linked login could be a separate document in an `accounts` collection referencing the user. (This is akin to having a `federated_credentials` table as in Passport's example ([Documentation: Facebook](https://www.passportjs.org/concepts/authentication/facebook/#:~:text=%2F%2F%20The%20Facebook%20account%20has,return%20cb%28err%29%3B)) ([Documentation: Facebook](https://www.passportjs.org/concepts/authentication/facebook/#:~:text=Facebook%20account%20belongs,relation%20to%20the%20Facebook%20account)).) The simpler approach for this PRD is embedding them in the user document, but if scalability or normalization becomes an issue, a second collection could be introduced. In that case, each account record contains userId, provider, providerId, tokens, etc. The user record contains general profile info. This approach can make certain queries easier (like uniqueness checks) but adds complexity in joins. For now, embedding is fine given the likely moderate number of linked accounts per user (rarely more than 5-10).

* No password field is present in the user schema, since authentication is purely via OAuth providers (SSO). If in the future we want to allow a local email/password as an option, that field (hashed password) could be added and treated as another credential type.

* The schema will be implemented likely using Mongoose models in the package for convenience, but it will not force the application to use Mongoose if not desired (the package can handle connection internally).

**Example User Document:**

```json
{  
  "\_id": "60f7ae8f... (ObjectId)",  
  "name": "Alice Doe",  
  "email": "alice@example.com",  
  "emailVerified": true,  
  "providers": \[  
    {  
      "provider": "google",  
      "providerId": "113284723648237648723",  
      "displayName": "Alice Doe",  
      "email": "alice@example.com",  
      "profilePhoto": "https://lh3.googleusercontent.com/....jpg",  
      "accessToken": "\<encrypted\_or\_jwt\_token\>",  
      "refreshToken": "\<encrypted\_token\>",  
      "linkedAt": ISODate("2025-01-10T10:12:30Z")  
    },  
    {  
      "provider": "github",  
      "providerId": "4182736",  
      "displayName": "alice123",  
      "email": "alice@githubemail.com",  
      "profilePhoto": "https://avatars.githubusercontent.com/u/4182736?v=4",  
      "accessToken": "\<encrypted\_token\>",  
      "refreshToken": "\<encrypted\_token\>",  
      "linkedAt": ISODate("2025-02-15T14:05:00Z")  
    }  
  \],  
  "createdAt": ISODate("2025-01-10T10:12:30Z"),  
  "updatedAt": ISODate("2025-02-15T14:05:00Z"),  
  "lastLogin": ISODate("2025-02-20T09:18:44Z"),  
  "role": "user",  // (custom field example)  
  "preferences": { "newsletter": true }  // (custom field example)  
}
```

This example shows a user who initially signed up with Google and then linked GitHub. The primary email is from Google (alice@example.com), but the GitHub-provided email is also stored in the providers array. The `role` and `preferences` fields illustrate custom fields that a developer might add via extensibility features.

## **Configuration and Environment**

The package will be **configurable** to adapt to different deployment environments and developer needs. Configuration can be provided via environment variables or through an options object passed to an initialization function. Key configuration aspects include:

* **OAuth Provider Credentials:** For each supported provider, the app will require OAuth 2.0 credentials (client ID and client secret) and authorized callback URLs.

  * Example environment variables:

    * `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

    * `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`

    * `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`

    * `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`

    * `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`

  * These credentials are obtained by registering the application on each provider's developer portal. The PRD will include documentation for developers on how to obtain these and what callback URL to set (likely the URL of the app plus the `/auth/provider/callback` route).

  * The package should validate that required credentials are provided for any provider that is enabled. Missing credentials for an enabled provider should throw an error on startup to avoid runtime failures.

* **Enabling/Disabling Providers:** A configuration option to specify which providers are active. This could be derived by presence of the above credentials or explicit flags (e.g., `ENABLE_FACEBOOK=true/false`). If a provider is not enabled, the package will not mount its routes and will ignore any calls to that provider's endpoints (or return 404). This lets developers include the package but perhaps only use Google/GitHub, etc.

* **Callback URLs and Domains:** The OAuth flow requires specifying callback URLs. The package can construct these if given a base URL:

  * For example, a config `BASE_URL` (the running domain of the backend) could be used. If `BASE_URL = "http://localhost:3000"` in development or `"https://api.myapp.com"` in production, the package can register each strategy's callback as `${BASE_URL}/auth/google/callback`, etc.

  * Alternatively, allow overriding callback URL per provider if needed (but generally base \+ path is fine).

  * The **frontend redirect URLs** after login success/failure should also be configurable:

    * E.g., `FRONTEND_SUCCESS_REDIRECT = "http://localhost:8080/app"` (for dev) and a different one for prod.

    * Possibly `SUCCESS_REDIRECT` and `FAILURE_REDIRECT` can be set for unified handling. If not set, the package may default to sending a JSON response with user info instead of redirect, but redirect is more typical for OAuth.

* **MongoDB Connection:** The package needs to connect to MongoDB to read/write user data. This can be configured via:

  * A Mongo connection URI (e.g., `MONGODB_URI=mongodb://user:pass@host:port/dbname`).

  * Or separate config for host, db name, etc., but URI is common.

  * The package will either establish its own connection or use an existing connection provided by the host app. If using Mongoose, the developer could pass a Mongoose instance or connection to reuse. Otherwise, the package can manage a connection internally (ensuring to handle errors, retries, etc.).

  * Credentials for the DB should be stored securely (env variables).

* **Session Settings:** Several configuration points for session management:

  * `SESSION_SECRET` – a secret key to sign cookies (and possibly encrypt session data if using certain stores). This must be provided (the package can generate a temporary one in dev if not, but warns to set in production).

  * `SESSION_COOKIE_NAME` – name of the cookie (default maybe `sid` or something like `connect.sid`). Usually fine to use default.

  * `SESSION_COOKIE_DOMAIN` – domain for the cookie. If the API and frontend share a root domain, you might set `.myapp.com` so that the cookie is usable across subdomains. If left blank, it defaults to the API host domain.

  * `SESSION_COOKIE_SECURE` – boolean or based on environment. In production (HTTPS), this should be `true` (only send cookie over HTTPS). In development (maybe http on localhost), set `false`. The package can allow a config or automatically detect based on a `NODE_ENV` or a `SESSION_SECURE` env.

  * `SESSION_COOKIE_SAMESITE` – can be `lax`, `strict`, or `none`. If the front-end is on a different domain than the backend, we must set `SameSite=None` and `Secure=true` for the cookie to be sent in cross-site requests. If front-end and back-end are same site, `Lax` can be used to mitigate CSRF. This should be configurable but defaulted based on typical usage (e.g., `none` for cross-domain support).

  * `SESSION_DURATION` – optionally a max age for the session cookie (e.g., 7 days or 1 day). If not set, sessions are session cookies (no explicit expiration, ends on browser close). Developer might want to configure remember-me length.

  * `SESSION_STORE` – configuration for session store. By default, if not set, the package can use an in-memory store (not recommended for production). The package could integrate with `connect-mongo` to store sessions in MongoDB. In config, developer could provide `SESSION_STORE=mongo` (then use the same MongoDB for sessions) or `redis` etc. For MVP, we can default to memory in dev and encourage using Mongo for production. If the package has built-in support for connect-mongo, it can automatically use the provided Mongo connection to store sessions.

* **CORS Configuration:** Since many front-end apps will be served on a different origin than the API (especially during development, e.g., React dev server on localhost:3000 and Node API on 3001), the package should allow configuring CORS and making sure cookies can be used:

  * `ALLOWED_ORIGINS` – list of domains allowed for CORS. Or a single `FRONTEND_URL` as mentioned which can double as allowed origin.

  * It will enable CORS for the specified origin(s) and allow credentials (so that the browser can send the session cookie on XHR/fetch requests).

  * The package might internally use `cors` middleware with `credentials: true` and `origin: [the front-end URL]`.

  * In production, if the front-end is served from the same domain, CORS might not be needed except maybe for specific cases. But likely, if front-end and back-end are different subdomains, we still need CORS and correct cookie domain.

* **Provider-Specific Settings:** Optionally allow extra settings:

  * OAuth Scopes: By default, the package will use a minimal scope to get basic profile and email from each provider (e.g., `scope: ['email','profile']` for Google, or specific ones for each). Developers might want to request additional scopes (like access to repo for GitHub, or contacts for Google). Config could allow specifying scopes per provider, e.g., `GOOGLE_SCOPE="profile email https://www.googleapis.com/auth/drive.readonly"` if they want more. The package would merge or override defaults.

  * Custom provider strategy options: e.g., Facebook Graph API version, or enabling `state` (Passport uses state by default if we set it – see Security section for state).

  * Callback URL override: possibly if someone wants a custom path.

* **Logging and Debugging:** A config flag like `DEBUG=true` could enable verbose logging from the package (such as logging when a user is created, or when a link is made, or errors). This helps during integration, and it should be off in production or use a proper logger that can be configured.

* **Environment Profiles:** The package should support at least two modes: development and production.

  * In development, it might allow http, have less strict cookie policies (because of no HTTPS), and possibly use simpler setups (like memory DB for quick testing).

  * In production, it should enforce secure cookies, require proper session secrets, and have more robust error handling.

  * Possibly a config `NODE_ENV=production` or a specific flag like `APP_ENV` can trigger these differences.

**Usage of Config:** The developer will either:

* Set environment variables and simply import the package, which will read those envs internally.

* Or call something like `authPackage.initialize(app, configObject)` where `configObject` contains all the necessary info (perhaps loaded from a config file or env).

* The PRD ensures that all necessary configuration is documented clearly (for example, instructions on setting up OAuth apps for each provider, where to put the credentials, and what values to use for callback URLs).

By centralizing configuration, the package makes it easy to manage credentials and environment differences without modifying code. Security-sensitive config (client secrets, session secret, DB passwords) will be documented to use environment variables (never hard-coded in code or committed to repo).

## **Session and Cookie Management**

Maintaining user sessions securely is critical. The package will utilize **Express session** middleware to handle login sessions after OAuth authentication:

* **Session Middleware Integration:** The package will use `express-session` (or a compatible interface) to create sessions. When a user successfully authenticates via a provider, Passport will serialize the user info into the session (using `req.login()` internally). A session ID is then stored in a cookie on the client side.

  * The `passport.serializeUser` function will likely store a user identifier (e.g., the user's Mongo \_id) in the session. `passport.deserializeUser` will retrieve the full user from the DB on each request as needed. This keeps the session light (only storing an ID, not the whole profile in the cookie).

  * The session cookie is by default named `connect.sid` (can be changed via config as mentioned).

* **Cookie Settings:**

  * **HttpOnly:** The session cookie will be HttpOnly, meaning it's not accessible via JavaScript in the browser. This protects against XSS attacks stealing the cookie.

  * **Secure:** In production (when using HTTPS), the cookie will be marked Secure, so it will not be sent over plaintext HTTP. This prevents exposure of the session ID on insecure connections.

  * **SameSite:** By default, to support typical OAuth front-end flows (which involve cross-site redirects), we might set `SameSite=None` on the auth callback response cookie, because the OAuth provider's site (e.g., accounts.google.com) will redirect back and we want the cookie to be accepted. If front-end and back-end are on different domains and the front-end triggers the flow, `SameSite=None` is necessary so that the cookie is included when the browser is sent back.

    * If the front-end and back-end are on the same domain (or cookie domain is set broad), we could use `Lax` to allow GET redirects to carry cookies (OAuth redirect is a GET). Many OAuth flows still work with SameSite=Lax. We will document this and possibly allow it to be configured or auto-set it based on environment (e.g., development on localhost might use None because of port differences).

    * Using `SameSite=strict` would typically break cross-site login flows and is not suitable here.

  * **Domain:** If the API runs on a subdomain (api.example.com) and the front-end on another (app.example.com), we can set the cookie domain to `.example.com` so both subdomains have access to it. If they are on completely different domains (e.g., localhost vs a remote domain), sharing cookies is not possible, and the pattern would be different (maybe use tokens instead, but we'll assume common domain scenario for simplicity). Domain can be configured.

  * **Expiration:** The session cookie can be configured for a certain lifetime (e.g., session vs persistent). The package might default to session cookies (no `maxAge`) meaning it ends when browser closes. Developers can configure `maxAge` (e.g., 7 days) if "Remember me" functionality is desired. Under the hood, `express-session` can take a `cookie: { maxAge: ... }` parameter.

* **Session Store:** By default, `express-session` uses a memory store which is not suitable for production (it doesn't scale and loses sessions on server restart). The package will encourage or include a production-ready session store:

  * Likely use **MongoDB as a session store** via `connect-mongo`, since Mongo is already in use. This avoids introducing a new dependency like Redis (though Redis could be an option if the developer configures it separately).

  * If the developer provides a Mongo URI, the package can set up `connect-mongo` to store session data in a collection (e.g., `sessions`). This ensures sessions persist across restarts and can be shared across multiple server instances if pointing to same DB.

  * If not configured, and if `NODE_ENV=development`, using the memory store is acceptable for dev/test. But if `NODE_ENV=production` and no session store is configured, the package might log a warning or throw an error to remind the developer to configure persistent storage.

  * Each session entry will typically contain the user id and any Passport data. We don't need to design that schema here, as `connect-mongo` or similar will handle it.

* **Session ID Regeneration:** As a security practice, on a successful login (after OAuth callback), the package should regenerate the session ID. This prevents Session Fixation attacks (where an attacker could trick a user to use a known session ID). Express-session provides `req.session.regenerate` for this. So in the callback handler, after linking/creating user and before sending response, the package can regenerate the session and re-set `req.user`. This ensures the old (unauthenticated) session ID (if any) is not reused.

* **CSRF Considerations for Session:** If the front-end will be making state-changing requests (like POST /logout or any future POST actions) using the session cookie, we should protect against CSRF. Many OAuth flows themselves are not directly vulnerable to CSRF because the initial login is a GET initiated by the legitimate user, and the final callback is a GET from a trusted domain (the provider) with a code. However, general practice for web apps with sessions is to include CSRF tokens for form submissions or use SameSite cookies.

  * Because we plan to use `SameSite=Lax` or `None` for cross-domain, CSRF tokens become relevant. The package can optionally integrate csurf protection for endpoints like unlink or logout if they are POST. If logout is GET, it's technically a state-changing GET which is not ideal from CSRF perspective. To be safe, we might implement logout as a POST and require a CSRF token or at least check the Origin header.

  * Since implementing CSRF tokens might complicate front-end integration, an easier measure is to ensure that any sensitive operations (unlink, etc.) are protected by checking `req.get('Origin')` and ensuring it's our known front-end domain when in production. This isn't foolproof but helps.

  * The OAuth callback is already protected by the **`state` param** mechanism (each OAuth request will include a random state value stored in session and validated on callback to prevent forgery ([How to implement OAuth 2.0 with Passport.js | Axon](https://www.axon.dev/blog/how-to-implement-oauth-2-0-with-passport-js#:~:text=use%20a%20state%20parameter%20to,look%20at%20the%20initialization%20process))).

* **State Parameter in OAuth:** By enabling `state: true` in Passport strategy configs (for OAuth2), the package ensures CSRF protection on the OAuth authorization flow. Passport will generate a cryptographically random state, store it (in session by default), and verify it when the provider redirects back with that state ([How to implement OAuth 2.0 with Passport.js | Axon](https://www.axon.dev/blog/how-to-implement-oauth-2-0-with-passport-js#:~:text=use%20a%20state%20parameter%20to,look%20at%20the%20initialization%20process)). This prevents malicious actors from initiating logins and redirecting users to our callback without authorization. We will enable this by default for all OAuth2 providers.

* **Cookie Encryption:** By default, `express-session` cookies are not encrypted (only signed). If additional security is needed, the package could integrate something like encrypted cookies, but it's uncommon. More common is to use HTTPS and HttpOnly flags which suffice. We rely on the session store to keep actual data safe server-side.

* **Scaling Considerations:** With session data possibly stored in Mongo (or memory), horizontal scaling (multiple Node instances) requires a shared session store (which Mongo provides if all instances connect to same DB). This will be noted in deployment considerations.

* **Stateless Option:** Some developers might prefer a stateless JWT approach for SPAs. While the core of this package is session-based (since Passport works seamlessly with sessions), we might mention extensibility for JWT in the future:

  * For example, instead of using express-session, the package could be configured to issue a signed JWT to the client on login, which the client then stores and sends on each request. That requires different handling (Passport has `passport-jwt` strategy to parse the token instead of session). This is not in the primary scope but can be considered for extensibility. The default will remain sessions for simplicity and security (cookies are httpOnly and not accessible to JS, whereas storing JWT in localStorage can be riskier).

* **Session Refresh / Prolonging:** If we set a fixed expiration (say 1 hour), we might want to refresh it on activity. This is not automatically handled by express-session. We could document that if `rolling: true` option is set, it refreshes cookie expiration on each response. The package could allow that setting via config.

* **Logout Implementation:** On logout, besides destroying session, if we wanted to be thorough, we could also attempt to revoke the OAuth tokens at the provider (via their revoke endpoints) so that if someone hijacked the token it wouldn't be usable. However, revocation is optional and often not done on logout of app because the user might still want the grant to exist (so next login doesn't prompt again). This is left out for simplicity.

In summary, the package will manage user sessions via secure cookies and server-side session storage, ensuring that once logged in via SSO, the user stays authenticated for the duration of the session across API calls. Proper flags and state mechanisms will guard the session from common attacks (XSS, CSRF, fixation).

## **Deployment Considerations**

Deploying an application using this SSO package involves configuring external OAuth providers and ensuring the environment is set up securely. Key deployment considerations include:

* **OAuth Provider App Setup:** For each social login provider, the application must be registered in the provider's developer console:

  * Developers will need to create OAuth client IDs/secrets on Google, GitHub, Facebook, Microsoft Azure AD (for Microsoft accounts), and LinkedIn. The PRD will provide guidance (or references) for doing this.

  * During registration, they must specify the **Authorized Redirect URI** or callback URL for each. This should match the route handled by our package. For example: `https://api.myapp.com/auth/google/callback` (for Google) or a similar URL for others. If the domain changes (e.g., moving from staging to production), those URLs need updating in the provider settings.

  * Often providers allow multiple callbacks (for dev and prod). We might suggest using environment-specific client IDs if the domains differ (to avoid confusion).

* **Environment Variables Security:** Secrets like client secrets and the session secret should be provided via environment variables in production. Ensure these are not logged or exposed. Deployment scripts should set these securely (for example, in Docker secrets, or CI/CD secret stores).

  * Never commit secrets to the repository. The documentation for the package will emphasize this practice.

* **Domain and DNS:** Ensure that the domain for the API is appropriately configured with SSL (HTTPS) since OAuth callbacks often require HTTPS (some providers like Google won't allow http in production). If frontend is on a different domain, configure DNS and possibly subdomains for cookies if needed.

  * If using subdomains, set a common parent domain in cookie settings as described so that the front-end can receive the session cookie if needed. Alternatively, consider serving the front-end from the same domain (perhaps by hosting a static build on the same server or using a reverse proxy).

* **CORS and Frontend Domain:** In a cross-domain setup (front-end and back-end separate), you must enable CORS on the back-end for the front-end domain and allow credentials:

  * E.g., if frontend is served at `https://app.myapp.com` and backend API at `https://api.myapp.com`, configure the package (or underlying Express app) to allow origin `app.myapp.com` and `credentials: true`. The package can include this if provided the allowed origin (via config).

  * Also ensure the session cookie domain is set to `.myapp.com` so that it is sent to the API when the front-end (app.myapp.com) makes requests. On the flip side, if the API sets the cookie on `api.myapp.com` only, then front-end JS (fetch) needs `withCredentials: true` to include it, and the browser will include it since the request is to api.myapp.com itself (provided CORS allows it).

  * If the front-end is on a completely different domain (e.g., no shared parent), sharing cookies is not possible. In such a case, one strategy is to handle the OAuth callback differently: for instance, after successful login, the back-end could redirect to the front-end and include a token in the URL fragment which the front-end then uses to authenticate (this is a more complex flow and typically not needed if we can share a common domain). Our package will assume either same domain or subdomain scenarios for simplicity.

* **Production vs Development:**

  * In development, developers often run on localhost with different ports. The package should allow http for localhost and skip secure cookie requirement there. Providers like Google allow redirect URIs with http for `localhost` (they consider localhost as a special case), so testing should be fine.

  * Provide sample configuration for development (like a `.env.example` showing using `http://localhost:3000` as base URL, etc.).

  * Provide instructions on testing each provider (some providers allow test accounts or have different client IDs for dev).

* **Deployment Environment Setup:**

  * Document any required system-level dependencies. (Passport and OAuth strategies are purely Node libraries, so no special OS packages needed except Node itself).

  * If using secure cookies, behind proxies: if deploying behind a reverse proxy (like Nginx or Heroku's routing), ensure to set `app.set('trust proxy', 1)` in Express so that `secure` cookies can be set when proxy terminates SSL. The package might handle this or instruct the developer to set it.

  * Ensure the environment clock is correct (OAuth tokens and state may rely on time).

* **Scaling and Load Balancing:** If the app is scaled to multiple instances:

  * Use a centralized session store (like Mongo or Redis) so that a user can hit any instance and still retrieve their session.

  * Sticky sessions are another approach, but not required if using a central store.

  * The account linking logic should be robust in concurrent scenarios (e.g., two parallel login attempts for the same new user should not create two separate users – this is a rare case but could happen if a user double-clicks or something; handle by ensuring one write wins and maybe using user's email as a unique key).

  * Passport is stateless between requests, so scaling doesn't affect it except the session part.

* **Error Logging and Monitoring:**

  * In production, integration with logging (winston, etc.) for errors (like failed logins or exceptions in callbacks) is useful. The package should use a logging mechanism that can be hooked or overridden (or simply use console in dev).

  * Monitor for unusual activity, e.g., many failed logins could indicate an issue.

  * The package itself doesn't include rate limiting, but the host app should implement rate limiting on the /auth routes to mitigate abuse (e.g., someone hitting /auth/google repeatedly could cause excessive redirects or DoS on the provider or our site). We'll suggest using an Express rate-limit middleware in front of these routes if necessary.

* **SEO / SSR Consideration:** If some frontends are server-rendered, the redirects still work similarly. Just ensure that the server-rendered app can handle the return redirect if needed. Usually, that's not an issue as it's client-side behavior mostly.

* **Testing in Staging:** It's advisable to test the integration in a staging environment with the actual OAuth flows (using perhaps separate staging OAuth credentials) before production, to ensure all callbacks and cookies work with real domains and HTTPS.

* **Privacy and Compliance:** Storing user data (even just names, emails from social providers) means the app should be mindful of privacy laws (GDPR, etc.). The PRD can note that one might need a way for users to delete their account (which means deleting from Mongo) and maybe revoking tokens. While not a direct feature of the package, the data schema and linking should facilitate deletion (delete user doc \-\> all linked provider data is gone) and not leave orphan tokens.

## **Security Best Practices**

Security is paramount for an authentication system. The package will implement and encourage several security best practices:

* **OAuth State Parameter for CSRF:** The package will use the OAuth2 `state` parameter in all authorization requests. Passport can generate and validate this automatically to prevent CSRF attacks on the OAuth flow ([How to implement OAuth 2.0 with Passport.js | Axon](https://www.axon.dev/blog/how-to-implement-oauth-2-0-with-passport-js#:~:text=use%20a%20state%20parameter%20to,look%20at%20the%20initialization%20process)). This ensures that the callback received is tied to an auth request initiated by our app, preventing malicious redirections with stolen codes.

* **HTTPS and Secure Cookies:** We strongly recommend deploying the app over HTTPS. In production, the package's cookies will have `Secure` flag enabled so they are only sent over HTTPS. This prevents session hijacking via network sniffing. Additionally, using HTTPS prevents man-in-the-middle attacks where an attacker could intercept auth codes or tokens in transit.

* **HttpOnly Cookies (XSS Mitigation):** The session cookie is HttpOnly. This mitigates the risk that an XSS vulnerability in the front-end could steal the user's session token, as JavaScript cannot read the cookie. Even though our package is backend, we encourage front-end developers to sanitize any data and not introduce XSS. Using libraries like Helmet on the Express app can set helpful headers (Content-Security-Policy, etc.) to reduce XSS risk.

* **SameSite and CSRF:** By setting `SameSite=Lax` (or `None` with careful origin checks), we mitigate some CSRF risk. For sensitive endpoints (like unlink or any future POST), the package can require a CSRF token or at least validate the origin header. We will document that if the front-end makes POST requests, implementing CSRF tokens (with a library like csurf) is recommended. If possible, the package might integrate a simple CSRF protection for logout/unlink (like checking a token in the request body/header that was provided in the user info response).

* **Session Fixation Prevention:** The package will regenerate session IDs on login as noted. This means if an attacker somehow obtained a pre-login session ID (or set one), it becomes useless once the user logs in, because the ID changes.

* **Passport.js Configuration:** Passport by itself is just an authentication middleware. We will ensure it's configured correctly:

  * Use `passport.initialize()` and `passport.session()` in the correct order.

  * Use `passReqToCallback: true` in strategy config to allow linking (so the verify callback can see `req.user`).

  * Handle errors in the verify callback properly (call done with error or false as needed).

  * Use updated versions of all Passport strategies to include latest security patches. Keep dependencies updated to avoid known vulnerabilities.

* **No Credential Secrets in Client:** The OAuth client secrets are kept in the backend config. The frontend only ever sees the public client ID (if at all, sometimes even that is only used server-side). The package should not expose any secrets or tokens to the client. For example, if storing access tokens for future use, do not send them to the frontend in the `/auth/user` response. The frontend should only know that the user is authenticated, and maybe which providers are linked.

* **Input Validation:** Although the package doesn't take a lot of direct user input (mostly data from OAuth providers), it should still validate and sanitize data:

  * Provider names in the URL should be validated against a whitelist of supported providers to avoid open redirect or injection (e.g., a request to `/auth/evilsite` should return 404, not attempt some unknown strategy).

  * Data from providers (names, emails) might be used or displayed; ensure they are stored as plain text and if ever embedded in HTML by the app, that's on the app to escape. The package will not directly render any UI with that data except maybe in a debug log.

  * If we construct any URLs (like redirect to front-end), ensure they are whitelisted or come from config to prevent open redirect vulnerabilities (we wouldn't want an attacker to trick our app into redirecting a user to a phishing site after login by manipulating a return URL).

* **Storing Tokens Securely:** If the design stores refresh tokens or access tokens in the database, treat them like passwords:

  * Consider encrypting them in the database (using a symmetric key or using Mongo's field-level encryption if available). At minimum, do not log them or expose them via API.

  * Provide an option for the developer to disable storing tokens if not needed, or to provide an encryption key.

  * If tokens are stored, limit their scope to only what's needed (our default scopes are minimal).

* **Least Privilege with OAuth Scopes:** By default, request only the user's basic profile and email from providers. Do not request sensitive scopes (like writing data or accessing contacts) unless the application specifically needs it and developer configures it. This reduces the impact if an app token is compromised and also aligns with user expectations (they see we only ask minimal permissions).

* **Session Expiration and Logout:** The package will allow session expiration settings so that a user doesn't stay logged in indefinitely. For security, it might be good to default to a reasonable timeout (e.g., 24h) and allow configuration. Logging out explicitly will invalidate the session immediately. The package should ensure that on logout, the session is fully destroyed server-side (not just forgetting to set a cookie).

* **Brute-force and Abuse Protection:** Although OAuth largely offloads credential entry to the providers (so brute forcing passwords is not happening on our side), an attacker might try to spam our endpoints (like triggering many OAuth flows or trying to hit callback with random codes). We recommend:

  * Rate limiting login attempts per IP or per session (the package may not implement it internally, but documentation can suggest using an Express rate-limit middleware).

  * The `state` param as mentioned will prevent reuse of codes or CSRF, and code reuse is anyway prevented by providers (once exchanged it's invalid).

* **Logging and Monitoring:** Keep track of important security events:

  * The package can emit logs for events like "User X logged in via Google" or "Linked GitHub to user Y" at info level. If an unusual event happens (like linking failed due to conflict), log a warning. These logs can be monitored.

  * Monitor for multiple accounts with same email (which might indicate a missed link or malicious attempt) – possibly flag for admin review.

  * If feasible, allow hooks for developers to implement additional checks – e.g., maybe they want to approve new accounts manually or ensure the email domain is allowed (for enterprise cases). While not built-in, the extensibility could allow hooking into the verify callback or user creation process.

* **Testing Security:** Encourage developers to test the auth flow under various scenarios, including trying to manipulate things (like use an expired code, or access /auth/user from a different origin) to ensure the protections are effective. We will have unit/integration tests in the package for our flows.

By adhering to these practices, the package will provide a secure foundation for authentication. We cite the Passport documentation's emphasis on account linking precisely because it enhances security by providing alternative login methods (so users aren't locked out if one provider is lost) ([Documentation: Facebook](https://www.passportjs.org/concepts/authentication/facebook/#:~:text=Linking%20social%20accounts%20to%20a,independent%20of%20their%20Facebook%20account)). We also leverage Passport/Express features like state and cookies which are known to be secure when used correctly.

## **Extensibility and Customization**

While the package comes with a fixed set of features out-of-the-box, it should be designed for **extensibility** to accommodate future needs:

* **Adding New OAuth Providers:** Developers may want to use providers beyond Google/GitHub/Facebook/Microsoft/LinkedIn (for example, Twitter, Instagram, Auth0, Apple, or enterprise SAML/OIDC providers).

  * The package should allow **plugging in additional Passport strategies**. This could be done by exposing a hook or configuration to register extra providers.

  * For instance, if a developer wants Twitter login (which uses OAuth 1.1), they could install `passport-twitter` and then call something like `authPackage.useProvider(twitterStrategyConfig)`. The package would then internally set up the routes and linking logic for that provider as well.

Alternatively, the package might accept a config like:

```js
 additionalProviders: [  
  {   
    name: "twitter",   
    strategy: require('passport-twitter').Strategy,   
    credentials: { consumerKey, consumerSecret },  
    callbackURL: "..."   
  }  
]
```

*  and it will integrate that. The specifics can be determined in implementation, but the PRD requirement is that we *don't hardcode only those five providers forever*. There should be a path to extend.

  * We will ensure that any new provider can integrate into the same account linking system. For example, a new provider would simply add another entry in the `providers` array in the user schema.

  * If a provider has unique requirements (like Twitter doesn't give email by default), the package or developer might need to handle that (maybe asking user for email after login if needed). The design should not break if a provider yields no email – it can still create an account with perhaps a null email or ask later.

* **Custom User Fields and Schema Extensions:** Many applications have user profiles with more than just name and email (e.g., roles, profile info, preferences, etc.). The package should allow adding such fields:

  * If using an ORM/ODM like Mongoose, we could expose the user schema for extension or allow the developer to pass in a schema that extends our base schema. For example, the package could provide a base UserSchema and the developer can add fields to it before it's compiled into a model.

  * If not using Mongoose, we might allow storing a blob of additional info. For instance, a field `user.metadata` or `user.custom` could be a freeform object. The developer could then put whatever key-values they want in there (like `{ theme: "dark", locale: "en" }` or `isAdmin: true`). The package would store and retrieve it transparently. This gives flexibility without needing to change the core.

  * Another approach: allow hook functions. E.g., a hook `onUserCreate(profile, provider)` where the application can return extra data to attach to the new user. The package, when creating a user, would call this hook to get any extra fields to save.

  * Regardless of method, documentation will provide guidance on how to include extra fields. The default responses (like `/auth/user`) should also include those custom fields if present so front-end can use them.

* **Hook/Callback Functions for Business Logic:** Extensibility can also mean providing callbacks for certain events:

  * e.g., `onLogin(user, provider)` called on every successful login (could be used for logging or analytics),

  * `onLink(user, provider)` when a new account is linked,

  * `onUnlink(user, provider)` when removed,

  * `onRegister(user, provider)` on first account creation.

  * These could be passed in config or simply the package could emit events that the host app can listen to.

  * This way, developers can plug in things like sending a welcome email on first registration, or notifying the user that a new account was linked for security awareness.

* **Alternative Frontend Patterns:** While the package is primarily for RESTful integration, some might want to use it in a server-side rendered scenario or with Next.js (which has its own NextAuth library but assume not using that). Our design is flexible enough for SSR since it's just Express middleware.

  * For pure JSON API usage, we may consider a mode where instead of performing redirects on callback, the package can respond with JSON containing user data and perhaps a JWT. But that's a different flow and typically not needed if you can handle a redirect. Still, we can note that as a potential extension (especially for mobile apps, where a deep link might be used instead of a browser redirect).

  * At least ensure that the success redirect can be configured to a custom scheme (for mobile, e.g., `myapp://auth-callback`) if needed, making it possible to use the same backend for mobile OAuth.

* **Local Authentication Option:** Even though not requested, a future extensibility could be adding a local username/password login as an option. Many apps combine social logins with an email/password alternative. The package could be extended to support that by adding a strategy for local auth, storing password hash in the user schema, etc. This PRD doesn't include it, but our account linking architecture is compatible with that (they'd just be another provider type "local"). So we mention it as a possible extension (not implemented initially).

* **Enterprise Providers (SAML/OIDC):** Similar to adding custom providers, some applications might want SAML or OpenID Connect integration (for corporate SSO like Okta, Azure AD in enterprise mode, etc.). If Passport strategies exist for those (passport-saml, etc.), they could also be integrated in a similar way. We should design our config to not assume only OAuth2 but also allow these, though likely out-of-scope for v1.

* **Modular Components:** If developers want to use only parts of the package, consider making things modular:

  * For example, maybe someone only wants the account linking logic but with their own routes. They could use our functions from a submodule. Or maybe they want to use the schema but with their own controllers. Having a modular design (with clear separation of concerns) makes it easier to adapt.

  * However, primary usage is as a whole package that just works by mounting routes.

* **Versioning and Updates:** The package should be maintained to update provider strategy versions and to add new providers over time. In PRD context, ensure the design doesn't paint us into a corner that makes adding a new provider very hard. Ideally adding a provider is as easy as adding a new strategy config and routes, which if our code loops through configured providers, it's straightforward.

* **Documentation & Examples:** Extensibility is also aided by good documentation. We will include examples in the docs for:

  * How to add a custom provider (like an example integrating Twitter).

  * How to add custom fields (maybe an example of adding a role to the user).

  * How to handle any custom logic post-auth (via hooks or events).

* **Non-Node Frontends:** Emphasize that any front-end that can handle redirects and HTTP requests can use this. For example, an Angular app or even a pure mobile app with webview. The package doesn't assume a specific front-end, thus it's inherently extensible to different client technologies.

* **Testing Extensibility:** We should ensure that writing unit tests or integration tests is possible. Perhaps allow an option to use a memory DB (for tests) or to easily reset state. Extensibility in testing ensures the library can be validated in different scenarios by developers.

In summary, the package will serve most needs out-of-the-box but is flexible enough to be customized. This extensibility ensures it can grow with the application's requirements (new providers, new profile fields, etc.) without forcing a complete re-write. The design's modularity (Passport strategies, configuration-driven routes, and a malleable schema) is the key to this flexibility.

---

**Sources:**

* Passport.js Documentation on social login and account linking ([Documentation: Facebook](https://www.passportjs.org/concepts/authentication/facebook/#:~:text=Linking%20social%20accounts%20to%20a,independent%20of%20their%20Facebook%20account)) – emphasizes the importance of linking multiple providers to one user for flexibility.

* Security practices for OAuth (using state param to prevent CSRF) ([How to implement OAuth 2.0 with Passport.js | Axon](https://www.axon.dev/blog/how-to-implement-oauth-2-0-with-passport-js#:~:text=use%20a%20state%20parameter%20to,look%20at%20the%20initialization%20process)) – ensures safe OAuth flow in the implementation.

## **API Documentation (Swagger)**

The package will include comprehensive API documentation using the Swagger (OpenAPI) specification to facilitate easy integration for frontend developers and provide interactive testing capabilities. This documentation is critical for developer experience and adoption of the package.

### **Documentation Requirements:**

* **Complete OpenAPI Documentation:** All API endpoints will be fully documented using OpenAPI 3.0 specification via JSDoc annotations or similar tooling, detailing:
  
  * Endpoint paths, HTTP methods, and purposes
  * Request parameters (path, query, header, cookie)
  * Request bodies and expected formats
  * Response schemas for successful responses
  * Error response schemas and status codes
  * Authentication requirements
  * Examples for requests and responses

* **Interactive Swagger UI:** The package will expose a Swagger UI endpoint (e.g., `/api-docs`) that provides:
  
  * Interactive documentation for exploring the API
  * Try-it-out functionality for testing endpoints directly from the browser
  * Clear visualization of the request/response flow
  * Authentication flow demonstration

* **OAuth Flow Documentation:** Special attention will be given to documenting the OAuth flows:
  
  * Step-by-step explanation of the authentication process
  * Sequence diagrams or flowcharts visualizing the redirect flows
  * Clear explanation of the session cookie handling
  * Documentation of the account linking process

* **Error Documentation:** Comprehensive documentation of all possible error responses:
  
  * Standard error format
  * Error codes and messages
  * Troubleshooting guidance

### **Implementation Strategy:**

* The package will use **swagger-jsdoc** to generate OpenAPI documentation from JSDoc comments in the code, and **swagger-ui-express** to serve the interactive UI.

* Annotations will be added directly to route handlers to ensure documentation stays in sync with implementation.

* The Swagger UI will be configured to be available in development environments by default, but with options to enable/disable in production.

* Authentication for the Swagger UI itself will be configurable to prevent unauthorized access in production environments.

### **Benefits of Swagger Documentation:**

* **Testing Without Frontend:** Developers can test the authentication flows directly from the Swagger UI without building a frontend.

* **Client Generation:** The OpenAPI specification can be used to generate client libraries in various languages.

* **Onboarding:** New developers can quickly understand the API structure and capabilities.

* **Validation:** The OpenAPI specification serves as a contract that helps validate both the implementation and client usage.

* **Consistency:** Ensures consistent API behavior and response formats across all endpoints.

This comprehensive documentation approach ensures that integrating the PassportLink package into any application will be straightforward, with clear guidance on how to utilize each endpoint and handle the various authentication flows.

