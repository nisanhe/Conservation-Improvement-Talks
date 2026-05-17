# Security Specification - Digital Notebook

## Data Invariants
1. A user's application state (AppState) is private and can only be accessed by that specific user.
2. The user ID in the Firestore path must exactly match the authenticated user's UID.
3. The app state must contain a list of categories.
4. Timestamps (if added) must be server-validated.

## The Dirty Dozen Payloads (Negative Tests)
1. **Identity Spoofing**: Attempt to read `users/attacker_id/app/state` as `victim_id`.
2. **Access Without Auth**: Attempt to read any state without a token.
3. **Ghost Fields**: Attempt to write `isVerified: true` to the state.
4. **ID Poisoning**: Attempt to write to `users/very_long_junk_id_12345.../app/state`.
5. **Type Poisoning**: Attempt to set `categories` to a string instead of a list.
6. **Self-Promotion**: (N/A for this app, but checking for it) - Attempting to set `role: 'admin'`.
7. **Cross-User Injection**: Attempting to set `userId` field inside the state to a different user.
8. **Invalid ID Chars**: Using symbols like `$` or `%` in the userId path.
9. **Large Payload**: (Hard to test via JSON, but rule-enforced) - Payload exceeding size limits.
10. **Partial Update Gap**: Attempting to update only the `categories` field while bypassing validation for others.
11. **Malicious Link**: Injecting scripts into labels. (Handled by Sanitization in UI + Size limits in Rules).
12. **Orphaned Write**: Attempting to write a sub-resource without the parent existing (N/A here as it's a monolithic doc).

## Test Runner (Conceptual)
The tests will verify that all unauthorized access attempts result in `PERMISSION_DENIED`.
