import type { AuthUser } from "./auth.js"

export type DbOrderBy = string

export interface DbFilterCondition {
  field_id?: string
  fieldId?: string
  operator: "equal" | "not_equal" | "in"
  value?: unknown
  values?: unknown[]
}

export interface DbFilter {
  match?: "and" | "or"
  conditions?: DbFilterCondition[]
}

export interface DbQuery {
  where?: Record<string, unknown>
  filter?: DbFilter
  limit?: number
  offset?: number
  order_by?: DbOrderBy
  orderBy?: DbOrderBy
}

export type DbRecord<T extends Record<string, unknown> = Record<string, unknown>> = T & {
  id: string
}

export interface DbQueryResult<T extends Record<string, unknown> = Record<string, unknown>> {
  total: number
  list: Array<DbRecord<T>>
}

export interface FuncDbRuntime {
  get<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    id: string,
  ): DbRecord<T> | null
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    query?: DbQuery,
  ): DbQueryResult<T>
  insert<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    data: T,
  ): DbRecord<T>
  update<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    id: string,
    data: Partial<T>,
  ): { ok?: boolean; updated?: boolean } | DbRecord<T>
  delete(table: string, id: string): { ok?: boolean; deleted?: boolean }
}

export interface FuncAuthRegisterInput {
  account?: string
  email?: string
  phone?: string
  password?: string
  name?: string
  avatar?: string
  profile?: Record<string, unknown>
}

/**
 * Points at one existing user. Exactly one field may be given: they are three
 * different sources of uniqueness (id is unique, account has a unique index,
 * email has none), so allowing two would require answering "which one wins when
 * they disagree" — and getting that wrong here writes to somebody else's account.
 */
export interface FuncAuthUserRef {
  userId?: string
  email?: string
  account?: string
}

export interface FuncAuthSetPasswordInput extends FuncAuthUserRef {
  password: string
}

export interface FuncAuthCheckPasswordInput extends FuncAuthUserRef {
  password: string
}

/**
 * The project's user directory, reached as `ctx.users`. Scoped to the whole
 * project, NOT to the caller — that is why it is a separate top-level namespace
 * instead of sitting on `ctx.auth`, which is about whoever is calling.
 */
export interface FuncUsersRuntime {
  /** Returns null when there is no such user; it does not throw. */
  find(ref: FuncAuthUserRef): AuthUser | null
  /**
   * Checks a user's *current* password, for "confirm your old password before
   * changing it" flows. Returns false for a wrong password, for an unknown user,
   * and for accounts that only sign in through a third party.
   *
   * Failures count against **the same budget as `/auth/login`** (5 per
   * project+IP+account, one hour), so this cannot be used to brute-force around
   * the login lockout — once the budget is spent it throws 429 rather than
   * returning false.
   */
  checkPassword(input: FuncAuthCheckPasswordInput): boolean
  /**
   * Replaces the password and revokes **every session of that user** — including
   * the caller's own, so send them back to the login page afterwards.
   *
   * There is no code or proof parameter: whether the change is allowed is your
   * Func code's decision (verify a code first). Throws 404 when the user does not
   * exist or signs in only through a third party; never return that error to the
   * browser verbatim, it is an account-enumeration oracle.
   */
  setPassword(input: FuncAuthSetPasswordInput): AuthUser
}

export interface FuncAuthRuntime {
  /** Who is calling this request. Null when the request carries no session. */
  currentUser(): AuthUser | null
  requireUser(): AuthUser
  /**
   * Registers the visitor and issues their session. No code, ticket or
   * "already verified" flag: with `register_entry: "func"` the platform runs no
   * checks, so verify before you call this.
   */
  register(input: FuncAuthRegisterInput): AuthUser
}

export interface FuncVerificationInput {
  channel: "email" | "sms"
  to: string
  purpose: "register" | "login" | "reset" | "bind"
}

export interface FuncVerificationConfirmInput extends FuncVerificationInput {
  code: string
}

export interface FuncVerificationStarted {
  sent: boolean
  /** Seconds until the code expires. */
  expiresIn: number
}

/**
 * Verification codes in the platform's reserved scenes, used by registration.
 * Unlike `ctx.email.sendCode`, `start` also applies the project's registration
 * policy and the email-taken check. Inside Func, `confirm` only returns a
 * boolean — there is no ticket, because confirm and register run in one call.
 */
export interface FuncVerifyRuntime {
  start(input: FuncVerificationInput): FuncVerificationStarted
  confirm(input: FuncVerificationConfirmInput): boolean
}

export interface FuncAssetUploadInput {
  filename: string
  mimeType: string
  base64: string
}

export interface FuncUploadedAsset {
  fileUrl: string
  /** Compatibility alias of fileUrl. */
  url: string
  size: number
}

export interface FuncAssetsRuntime {
  upload(input: FuncAssetUploadInput): FuncUploadedAsset
}

export interface CacheSetOptions {
  ttl?: number
  ttlSeconds?: number
}

export interface FuncCacheRuntime {
  get<T = unknown>(key: string): T | null
  set(key: string, value: unknown, ttlSeconds?: number): { ok?: boolean }
  set(key: string, value: unknown, options?: CacheSetOptions): { ok?: boolean }
  del(key: string): { ok?: boolean; deleted?: boolean }
  incr(key: string, delta?: number): number
  expire(key: string, ttlSeconds: number): { ok?: boolean }
}

export interface FuncEmailSendInput {
  /** A single address or a list; at most 50 recipients per send. */
  to: string | string[]
  subject: string
  html?: string
  text?: string
  /** Defaults to the from address configured on the email integration. */
  from?: string
  /** Defaults to the reply-to address configured on the email integration. */
  replyTo?: string
}

export interface FuncSentEmail {
  /** Provider-side message id. */
  id: string
  /** Provider that delivered the message, e.g. "resend". */
  provider: string
}

export interface FuncEmailCodeInput {
  to: string
  /** Namespaces the code by purpose, e.g. "login" or "reset_password". */
  scene?: string
}

export interface FuncEmailCodeSent {
  sent: boolean
  /** Seconds until the code expires. */
  expiresIn: number
  provider: string
}

export interface FuncEmailVerifyCodeInput extends FuncEmailCodeInput {
  code: string
}

/**
 * Email capability, available once an email integration is connected for the
 * project. The provider credential stays on the server: Func code never holds
 * or receives an API key.
 */
export interface FuncEmailRuntime {
  send(input: FuncEmailSendInput): FuncSentEmail
  /**
   * Generates and sends a verification code. Code length, expiry, per-recipient
   * rate limiting and the wrong-attempt cap are enforced by the platform.
   */
  sendCode(input: FuncEmailCodeInput): FuncEmailCodeSent
  /** Checks a code; a matching code is consumed and cannot be reused. */
  verifyCode(input: FuncEmailVerifyCodeInput): boolean
  verifyCode(to: string, code: string): boolean
}

export interface FuncReadonlyStringMap {
  get(name: string): string | null
}

export interface FuncRequestRuntime {
  host: string
  ip: string
  method: string
  path: string
  headers: FuncReadonlyStringMap
  cookies: FuncReadonlyStringMap
  readonly bodyUsed: boolean
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface FuncResponseRuntime {
  status(code: number): void
}

/** Body types accepted by the Func runtime's global Response constructor. */
export type FuncHTTPResponseBody = string | ArrayBuffer | Uint8Array | null

export interface FuncHTTPResponseInit {
  status?: number
  statusText?: string
  headers?: Record<string, string>
}

/**
 * A Web-compatible HTTP response returned directly from a Func.
 * Returning it bypasses the normal `{ result: ... }` JSON envelope.
 */
export interface FuncHTTPResponse {
  readonly status: number
  readonly statusText: string
  readonly ok: boolean
  readonly headers: Pick<Headers, "get" | "forEach">
  readonly body: null
  readonly bodyUsed: boolean
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
  arrayBuffer(): Promise<ArrayBuffer>
}

/** Type of the Web-compatible global `Response` available inside Func. */
export interface FuncHTTPResponseConstructor {
  new (body?: FuncHTTPResponseBody, init?: FuncHTTPResponseInit): FuncHTTPResponse
}

/** Importable aliases for Func code that wants an explicit response type. */
export type Response = FuncHTTPResponse
export type ResponseInit = FuncHTTPResponseInit

export interface FuncCookieSetOptions {
  path?: string
  domain?: string
  maxAge?: number
  secure?: boolean
  httpOnly?: boolean
  sameSite?: "lax" | "strict" | "none"
}

export interface FuncCookieRuntime {
  get(name: string): string | null
  set(name: string, value: string, options?: FuncCookieSetOptions): { ok?: boolean }
  delete(name: string, options?: Pick<FuncCookieSetOptions, "path" | "domain">): {
    ok?: boolean
  }
}

export interface FuncSSESendOptions {
  id?: string
  retry?: number
}

export interface FuncSSEEvent<T = unknown> extends FuncSSESendOptions {
  event?: string
  data?: T
}

export interface FuncSSERuntime {
  send<T = unknown>(event: string, data?: T, options?: FuncSSESendOptions): { ok: boolean }
  send<T = unknown>(event: FuncSSEEvent<T>): { ok: boolean }
}

export interface TalizenFuncContext {
  trace_id: string
  extra?: Record<string, unknown>
  request: FuncRequestRuntime
  response: FuncResponseRuntime
  db: FuncDbRuntime
  auth: FuncAuthRuntime
  users: FuncUsersRuntime
  verify: FuncVerifyRuntime
  assets: FuncAssetsRuntime
  cache: FuncCacheRuntime
  email: FuncEmailRuntime
  cookies: FuncCookieRuntime
  sse: FuncSSERuntime
}
