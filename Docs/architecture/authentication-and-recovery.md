# Authentication, Device Trust & Disaster Recovery Architecture

Last updated: 2026-09-14  
Status: Accepted & Implemented  

---

## 1. System Overview & Multi-Platform Architecture

Core-2 operates across three tightly integrated deployment surfaces:
1. **Web Dispatch Monolith (`apps/operations`)**: Internal dispatchers, operations managers, and administrators accessing the web application via browser sessions (Laravel Session Guard + Inertia.js React 19).
2. **REST API Gateway (`api/v1`)**: Secure RESTful interface for headless clients and field operations.
3. **Field Mobile Client (`packages/field-mobile`)**: React Native (Expo) application used by crane operators, riggers, and field technicians operating under variable cellular connectivity.

### Threat Model & Boundaries
- **Email OTP as Device Verification, Not Strong MFA**: Email-based one-time passcodes (OTP) provide an essential defense-in-depth layer against credential stuffing, stolen passwords, and unrecognized browser/device access. However, email is treated as an *additional verification mechanism* rather than cryptographic, hardware-backed multi-factor authentication (e.g. WebAuthn/FIDO2).
- **Mandatory Device Verification**: For enrolled active accounts with verified email addresses (`requiresDeviceVerification()`), authentication on unrecognized browsers or devices requires completing an email OTP challenge before any operational bearer token or web session is issued.
- **Legacy Client Boundary**: API clients attempting to bypass verification using legacy mobile headers (`X-Legacy-Client: true`) receive `HTTP 426 Upgrade Required` to enforce application modernization.

```
+-------------------------------------------------------------------------------+
|                            Client Entry Points                                |
|  [ Web Browser ]             [ Field Mobile App ]        [ API Integrations ] |
+--------+------------------------------+---------------------------+-----------+
         |                               |                          |
         | Cookie Session                | Bearer Token             | Bearer Token
         v                               v                          v
+-------------------------------------------------------------------------------+
|                        Authentication Boundary                                |
| - Credential validation (username/email + password)                           |
| - Account status verification (is_active, un-suspended, email_verified_at)     |
| - Device trust inspection (core2_device_trust cookie / X-Device-Trust header) |
+---------------------------------------+---------------------------------------+
                                        |
                 +----------------------+----------------------+
                 | Device Recognized?                          | Unrecognized Device?
                 v                                             v
        [ Issue Session / Token ]                     [ Issue OTP Challenge ]
                                                               |
                                                               v
                                                      [ 6-Digit Code to Email ]
                                                               |
                                                               v
                                                      [ Verify Code + Optional ]
                                                      [ 30-Day Device Trust   ]
```

---

## 2. Password Recovery Mechanics & Revocation Guarantees

### Email-Based Reset Links
Password recovery remains strictly email-based via signed, temporary reset tokens:
- **Neutral, Timing-Safe Responses**: Requesting a password reset returns a generic success notification regardless of whether the email address or username exists in the system, preventing account enumeration attacks.
- **Single-Use Signed Tokens**: Reset tokens expire after 60 minutes and are invalidated immediately upon use.

### Revocation Guarantees
When a user completes a password reset (`NewPasswordController`):
1. **Trusted Devices Revocation**: All active trusted device registrations (`trusted_devices`) for that user are immediately deleted.
2. **Web Session Termination**: All existing session records in the database (`sessions` table) are purged, instantly signing out all active browsers.
3. **API Bearer Tokens Revocation**: All personal access tokens (`personal_access_tokens`) issued to mobile devices or scripts are revoked.
4. **Active Challenge Invalidation**: Any pending verification codes (`email_one_time_codes`) are cancelled.
5. **No Auto-Login**: The user is redirected to the login page and must re-authenticate with their new password and complete device verification.
6. **Preserved Factors**: Enrolled verification settings (`email_otp_enabled`) are never disabled on password reset.

---

## 3. Email OTP Verification System

### Code Specifications & Cryptographic Security
- **Format**: 6-digit numeric string generated via CSPRNG (`random_int(100000, 999999)`).
- **Storage**: Codes are never stored in plaintext. They are hashed using HMAC-SHA256 keyed with the application secret:
  $$\text{code\_hash} = \text{hash\_hmac}('sha256', \text{code}, \text{config}('app.key'))$$
- **Verification**: Codes are verified using `hash_equals` to guarantee constant-time string comparison.
- **Validity Window**: Strict 5-minute (300 seconds) expiration from issuance.

### Throttling, Cooldowns & Exhaustion
- **Initial & Resend Cooldown**: A mandatory 45-second cooldown is enforced between code requests per user and purpose (`email-otp-cooldown:{userId}:{purpose}`).
- **Maximum Resends**: A single challenge flow allows a maximum of 5 code resends. Exceeding this requires restarting the authentication flow.
- **Attempt Lockout**: A challenge allows at most 5 incorrect verification attempts. Each incorrect attempt is atomically incremented directly in the database (`DB::table('email_one_time_codes')->increment('attempts')`). Upon reaching 5 attempts, the code is immediately invalidated.
- **Network Rate Limiting**:
  - IP Send Limit: Maximum 15 code generation requests per IP address per 5 minutes (`email-otp-send-ip:{ip}`).
  - IP Verify Limit: Maximum 25 code verification attempts per IP address per 5 minutes (`email-otp-verify-ip:{ip}`).
- **Atomic Consumption**: Successful verification marks the code as verified and atomically deletes prior unverified codes for that user/purpose within a database transaction.

---

## 4. Trusted Device Lifecycle & Token Management

### Trust Token Properties
- **Duration**: Fixed 30-day lifetime from the moment of verification.
- **No Rolling Extension**: Accessing the application updates `last_used_at` for administrative auditing, but **never** extends `expires_at`. When 30 days elapse, the user must verify again via OTP.
- **Cryptographic Generation**: A 64-character high-entropy token (`Str::random(64)`) is generated. Only the SHA-256 hash (`device_key_hash`) is stored in the database.
- **Client Storage**:
  - **Web**: Transmitted as an HTTP-only, Secure, SameSite=Lax cookie (`core2_device_trust`).
  - **Field Mobile**: Stored in the device hardware keychain/keystore via Expo `SecureStore` (`core2_device_trust_token`).

### User Management & Self-Service Revocation
From **Account Settings (`/account` -> Security tab)**, users can:
- View an inventory of recognized trusted devices (platform, browser/device label, IP address, last active date).
- Revoke individual devices (`DELETE /account/trusted-devices/{deviceId}`).
- Revoke all trusted devices simultaneously (`POST /account/trusted-devices/revoke-all`).
- Report a device lost (`POST /account/trusted-devices/{deviceId}/lost`), which atomically deletes the trust token, purges web sessions associated with that device, and revokes mobile bearer tokens.
- Choose "Sign out and forget this device" during logout to revoke both the current session/token and the device trust token.

### Enforced Verification Policy
System Administrators cannot disable mandatory email verification codes (`email_otp_enabled`) by organizational policy. Attempting to disable the setting returns `422 Unprocessable Entity`. For all internal personnel, device verification on unrecognized browsers or mobile installations is enforced whenever `email_otp_enabled` is enabled or the account has a verified email address (`requiresDeviceVerification()`), ensuring consistent verification without locking out accounts whose email readiness has not been established.

---

## 5. Bounded Mobile Offline Access

Field operators frequently operate in remote yards, construction sites, and subterranean zones without cellular service. Core-2 enables bounded offline continuation while protecting sensitive operations data.

```
+-------------------------------------------------------------------------------+
|                             Mobile Startup Check                              |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
                            [ Network Available? ]
                               /              \
                        YES   /                \   NO
                             v                  v
                    [ Verify Online ]   [ Inspect Offline Cache ]
                    [ Update Allowance]         |
                                                v
                                   [ Valid Stored Bearer Token? ]
                                                |
                                                v
                                  [ Anti-Tamper Clock Check:   ]
                                  [ now >= verifiedAt &&       ]
                                  [ now >= lastObservedTime?   ]
                                                |
                                                v
                                  [ Time Within 24 Hours:      ]
                                  [ (now - verifiedAt) <= 24h? ]
                                         /              \
                                  YES   /                \   NO
                                       v                  v
                              [ Allow Offline ]   [ Reject Access ]
                              [ Work Continuation][ Preserve Outbox ]
```

### Invariants
1. **Fresh Sign-in Requires Online Connectivity**: Users cannot perform initial credential authentication or device verification while offline.
2. **Bounded 24-Hour Allowance**: Offline work continuation is permitted only if the user was successfully authenticated online within the past 24 hours. The allowance is calculated strictly from `verifiedAt` (timestamp of the last successful server verification).
3. **Anti-Tampering & Monotonic Clock Protection**:
   - The client tracks `lastObservedTime` in secure storage, updating it monotonically as the app runs.
   - If the device clock is rolled backward (`Date.now() < session.verifiedAt || Date.now() < session.lastObservedTime`), offline access is immediately rejected.
4. **No Offline Extensions**: Failed server requests, offline launches, or local operations **never** extend the 24-hour expiration window.
5. **Outbox Preservation**: If the 24-hour offline window expires or the user signs out, local cached drafts and pending outbox mutations are preserved securely in encrypted storage until an authorized user re-authenticates.
6. **Staged Revocation on Offline Logout**: If an operator signs out while disconnected, local session credentials are wiped immediately, and a pending revocation marker (`core2_pending_token_revocation`) is staged so the bearer token is revoked with the server on the next connection.

---

## 6. Audited Administrator-Assisted Recovery Procedures

In the event that an employee loses access to their corporate email and all registered trusted devices, self-service recovery is impossible. Core-2 enforces an audited, dual-custody recovery protocol.

### Tier 1: Dual-Custody Administrator Recovery (Web UI)
1. **Identity Verification**: The affected user must present two independent identity proofs (e.g. government photo ID, in-person verification with their operations manager, or out-of-band call to an HR-registered phone number).
2. **Supervisor Authorization**: A System Administrator accesses **Operations Management (`/operations/users`)**.
3. **Action Execution**:
   - The administrator triggers an audited temporary recovery flow.
   - The action immediately revokes all existing sessions, trusted devices, and mobile tokens.
   - The administrator updates the user's registered corporate email or delivers a single-use break-glass activation link.
4. **Audit Logging**: The operation records an immutable audit record via `RecordAuditEvent`:
   - Event name: `user.admin_assisted_recovery`
   - Actor: Administrator ID
   - Target: User ID
   - Metadata: Verification method, justification, and client IP.

### Tier 2: Break-Glass Last-Administrator CLI Recovery
In the catastrophic event that all system administrators lose access or email services are completely unreachable, server operators with authenticated infrastructure shell access can use the artisan recovery command:

```bash
php artisan user:recover-admin [identifier] --password='<new-temporary-password>' --reset-factors
```

#### What the CLI Recovery Tool Does:
- Locates the user by username or email.
- Verifies or assigns the `system_administrator` role.
- Activates and marks the user's email as verified.
- Updates the password to a cryptographically secure hash.
- Purges all existing trusted devices, active database sessions, personal access tokens, and pending verification challenges.
- Outputs confirmation to stdout without printing plaintext passwords to logs.
- Enables the administrator to immediately sign in via browser, receive direct CLI output verification, and restore system access.
