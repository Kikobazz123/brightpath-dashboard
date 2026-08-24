/**
 * Shared between the middleware and the server session helpers.
 *
 * Its own file because middleware runs on the Edge runtime, where importing
 * `next/headers` is invalid — pulling this name out of `./session` would drag
 * that import into the middleware bundle for the sake of one string.
 */
export const SESSION_COOKIE = "brightpath_session"
