import type { AuthUser } from "./auth.js"

export type DbOrderBy = string

export interface DbFilterCondition {
  /**
   * @deprecated The Func runtime binds `fieldId` only. A condition written with
   * `field_id` is dropped **silently**, which widens the query instead of failing.
   */
  field_id?: string
  fieldId?: string
  operator: "equal" | "not_equal" | "in"
  /** For `in`, pass the array here. */
  value?: unknown
  /**
   * @deprecated Not read by the Func runtime — it exists only on the agent tool
   * API. Pass the array as `value`.
   */
  values?: unknown[]
}

export interface DbFilter {
  /**
   * @deprecated Not honoured by the Func runtime: conditions are always AND-ed.
   * `"or"` is accepted and ignored. For OR, run two queries and merge.
   */
  match?: "and" | "or"
  conditions?: DbFilterCondition[]
}

export interface DbQuery {
  where?: Record<string, unknown>
  filter?: DbFilter
  /** Default 20, maximum 1000. A larger value is clamped silently. */
  limit?: number
  offset?: number
  /**
   * `<column> asc|desc`, comma separated. System columns are `id`, `sort`,
   * `user_id`, `created_at` and `updated_at`; business fields need the `body.`
   * prefix, e.g. `"body.startAt desc"`. Defaults to `sort desc, id desc`.
   */
  order_by?: DbOrderBy
  /**
   * @deprecated The Func runtime binds `order_by` only. `orderBy` is dropped
   * **silently**, leaving the query on its default ordering.
   */
  orderBy?: DbOrderBy
}

export type DbRecord<T extends Record<string, unknown> = Record<string, unknown>> = T & {
  id: string
}

export interface DbQueryResult<T extends Record<string, unknown> = Record<string, unknown>> {
  total: number
  list: Array<DbRecord<T>>
  /**
   * The page size that actually applied. A `limit` above the platform maximum is
   * clamped silently, so comparing this against what you asked for is the only
   * way to notice the result was truncated.
   */
  limit: number
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
 * Filters for `ctx.users.query`. Every field is optional: an empty query returns
 * the first page of the whole directory.
 */
export interface FuncUsersQueryInput {
  /** Substring match across account, email, phone and name. */
  search?: string
  /** Restricts to enabled or disabled accounts. Any other value is a 400. */
  status?: "enabled" | "disabled"
  /** Default 20, maximum 100. A larger value is clamped silently. */
  limit?: number
  offset?: number
  /**
   * `<column> asc|desc`, comma separated. Only `created_at`, `last_login_at` and
   * `id` may be named — anything else is a 400. Defaults to `created_at desc`.
   *
   * Unlike `ctx.db.query` there is no `body.` prefix here: profile fields are not
   * sortable.
   */
  order_by?: string
}

/**
 * A user as returned by `ctx.users.query`. `profile` is deliberately absent:
 * custom fields can hold back-office-only values, and a list result is the thing
 * most likely to be forwarded to the browser wholesale. Call `find` with the id
 * when you need one person's full record.
 */
export type FuncUsersQueryItem = Omit<AuthUser, "profile">

export interface FuncUsersQueryResult {
  total: number
  list: FuncUsersQueryItem[]
  /** The page size that actually applied; see {@link DbQueryResult.limit}. */
  limit: number
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
   * Pages through the directory. Unlike `find` this does not require knowing who
   * you are looking for, which makes it the one call that can read out the whole
   * customer list — so **every Func using it must implement its own access
   * check** (`requireUser()`, then your own admin rule). The platform enforces
   * project isolation and the page cap and nothing else: it has no notion of
   * roles, so it cannot make this decision for you.
   *
   * Returned users carry no `profile`; see {@link FuncUsersQueryItem}.
   */
  query(input?: FuncUsersQueryInput): FuncUsersQueryResult
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
  /**
   * Issues a session for an **existing** user — this is how a Func implements
   * login. Takes no password and no code: whether the sign-in is allowed is your
   * code's decision (check `ctx.users.checkPassword`, or verify an email code
   * first). The session cookie is minted by the platform; Func never sees the token.
   *
   * **The ref must come from a fact the server just verified** — the user returned
   * by `ctx.users.find` after a successful code check, or the account whose password
   * you just checked. Passing an address straight from the request body means
   * "whoever the browser claims to be", i.e. impersonation.
   *
   * Every session issued this way is recorded with the Func file that issued it,
   * and the site owner can read that history in the editor.
   *
   * Throws 404 when the user does not exist, 403 when the account is disabled.
   */
  login(ref: FuncAuthUserRef): AuthUser
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

/** The email methods, bound to one channel. */
export interface FuncEmailChannel {
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

/**
 * Email capability, available once an email integration is connected for the
 * project. The provider credential stays on the server: Func code never holds
 * or receives an API key.
 *
 * `via(tag)` picks a channel when the project has several email integrations —
 * tag by purpose (`otp`, `notify`), not by provider, so swapping providers stays a
 * configuration change. Calling without `via` is the same as `via("default")`, and
 * a tag no integration carries throws instead of falling back silently.
 *
 * Verification codes are stored per project, scene and recipient, without the
 * provider, so a code sent through `via("otp")` still verifies with a plain
 * `verifyCode`.
 */
export interface FuncEmailRuntime extends FuncEmailChannel {
  via(tag: string): FuncEmailChannel
}

export interface FuncAlipayPageURLInput {
  /**
   * Your own order id, up to 64 printable ASCII chars. The platform does not
   * generate it: it is both your order table's key and the idempotency key of the
   * notification, so store the row before redirecting the payer.
   */
  outTradeNo: string
  subject: string
  /** In yuan, at most 2 decimals. `"9.9"` is normalised to `"9.90"`. */
  amount: string
  /** Optional product description. */
  body?: string
  /**
   * Overrides the return address configured on the integration. Page experience
   * only — landing there is never a proof of payment.
   */
  returnUrl?: string
}

export interface FuncAlipayPageURL {
  /** Signed gateway URL; send the browser to it. */
  payUrl: string
  outTradeNo: string
  /** The normalised amount that was signed. */
  amount: string
  appId: string
  provider: string
}

/**
 * A verified async notification. Every field comes from the notification Alipay
 * signed; fields Alipay omits arrive as empty strings.
 */
export interface FuncAlipayNotification {
  outTradeNo: string
  /** Alipay's trade id. */
  tradeNo: string
  tradeStatus: string
  /** Amount actually paid; compare it with your own order. */
  totalAmount: string
  receiptAmount: string
  buyerId: string
  buyerLogonId: string
  subject: string
  gmtPayment: string
  /** Notification id, usable for de-duplication. */
  notifyId: string
  notifyTime: string
  appId: string
  sellerId: string
  /** True for TRADE_SUCCESS and TRADE_FINISHED, so you never compare strings yourself. */
  paid: boolean
  /** Every raw parameter, for fields like `passback_params`. */
  params: Record<string, string>
}

/** The Alipay methods, bound to one payment channel. */
export interface FuncAlipayChannel {
  /** Signs an Alipay PC website payment and returns the redirect URL. */
  pageUrl(input: FuncAlipayPageURLInput): FuncAlipayPageURL
  /**
   * Verifies an async notification: RSA2 signature over the raw form body, then
   * `app_id` and `seller_id` against this channel.
   *
   * Pass the **raw** body (`await ctx.request.text()`); parsing and re-serialising
   * it breaks the signature. Any failure **throws** rather than returning a value
   * you could mistake for falsy, so a forged notification never reaches your code.
   */
  verifyNotify(rawBody: string): FuncAlipayNotification
  /**
   * Calls another Alipay OpenAPI method (query, refund, close, …). The platform
   * signs the request and verifies the response against its raw text, then returns
   * the business node. A business code other than `10000` throws.
   *
   * `alipay.trade.page.pay` is a redirect flow — use `pageUrl` for it.
   */
  call<T = Record<string, unknown>>(method: string, bizContent?: Record<string, unknown>): T
}

/**
 * Alipay capability, available once an Alipay integration is connected for the
 * project. The app private key stays on the server: Func code never holds it, and
 * signing, notification verification and content encryption all happen server-side.
 *
 * `via(tag)` picks a payment channel when the project has several receiving
 * accounts. Unlike `ctx.email`, a tag matching several payment integrations
 * **throws** instead of picking one at random: an order signed with one account
 * only ever gets notifications carrying that account's `app_id`.
 */
export interface FuncAlipayRuntime extends FuncAlipayChannel {
  via(tag: string): FuncAlipayChannel
}

/**
 * Payment capabilities. This is a **namespace, not a unified interface**: each
 * provider keeps its own method shape, so a future `ctx.payment.stripe` will not
 * mirror `ctx.payment.alipay`. Payment providers are not isomorphic, and pretending
 * otherwise would only produce a leaky abstraction.
 *
 * The platform owns cryptography and credentials; your code owns money and goods —
 * amounts must come from a server-side product table, and the order table, amount
 * check and idempotent fulfilment stay in Func.
 */
export interface FuncPaymentRuntime {
  alipay: FuncAlipayRuntime
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
  payment: FuncPaymentRuntime
  cookies: FuncCookieRuntime
  sse: FuncSSERuntime
}
