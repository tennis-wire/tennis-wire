// Classification of renewal failures.
//
// oidc-client-ts raises one event for all of them, but they mean opposite
// things: a rejected refresh token is a dead session, while a failed fetch is a
// laptop that woke up before its Wi-Fi did.

import { ErrorResponse } from 'oidc-client-ts'

/**
 * True when the identity provider has answered and refused. Anything else — a
 * network failure, a timeout, a thrown TypeError — leaves the session's fate
 * unknown, and the next request will settle it.
 */
export function isDeadSession(error: unknown): boolean {
    return error instanceof ErrorResponse && error.error === 'invalid_grant'
}
