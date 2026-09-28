/**
 * Account types, kept apart from `types.ts`.
 *
 * `types.ts` is the *domain* — vocabulary, scheduling, progress. It is
 * deliberately UI-agnostic and knows nothing about React. These types describe
 * an identity, which is a different axis: a real backend would replace the
 * whole account module, and separating the types keeps that swap from touching
 * the domain model.
 */

export interface AccountRecord {
  id: string;
  /** Normalised to lower case at the boundary; the stored form is canonical. */
  email: string;
  displayName: string;
  /** PBKDF2-HMAC-SHA256 of the password, base64. Never the password itself. */
  hash: string;
  /** Per-account random salt, base64. */
  salt: string;
  /** Stored per record so the work factor can be raised without invalidating accounts. */
  iterations: number;
  createdAt: string;
}

export interface AccountSession {
  accountId: string;
  email: string;
  displayName: string;
  signedInAt: string;
}

/** Which control an error belongs to, so the form can place it. */
export type AuthField = "email" | "password" | "displayName" | "form";

export interface AuthError {
  field: AuthField;
  message: string;
}

/**
 * A discriminated result rather than a thrown error: a wrong password is an
 * expected outcome of a form, not an exception, and the caller always has to
 * handle it.
 */
export type AuthResult =
  | { ok: true; session: AccountSession }
  | { ok: false; error: AuthError };
