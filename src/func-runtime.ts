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
  /**
   * Equality on top-level body fields. `id` matches the record id (the `id` every
   * returned row carries); write `body.id` for an id field you stored yourself.
   * The same goes for `fieldId: "id"` in `filter` (eq / neq / in only).
   */
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
  /**
   * Keyset paging by id, for reading a whole table: pass `""` for the first page,
   * then the previous page's `next_cursor`, until it comes back empty. Requires
   * `order_by: "id asc"`.
   */
  cursor?: string
}

export type DbRecord<T extends Record<string, unknown> = Record<string, unknown>> = T & {
  id: string
  /**
   * Set on insert when missing; filled from the record's system time on read.
   * UTC with milliseconds, same as `Date.toISOString()`.
   */
  created_at?: string
  /** Refreshed on every insert and update; filled from the system time on read. */
  updated_at?: string
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
  /**
   * Only when `cursor` was passed: hand it to the next call. Empty string once the
   * table is exhausted (this page was not full). `total` then counts the rows
   * from the cursor on.
   */
  next_cursor?: string
}

/** Same request as the `record_aggregate` API. */
export interface DbAggregateQuery {
  where?: Record<string, unknown>
  filter?: DbFilter
  /**
   * Body fields (or the system columns `created_at` / `updated_at`). A string is
   * `{ field }`; `trunc` buckets a time into day / week / month / year.
   */
  group_by?: Array<string | { field: string; trunc?: "day" | "week" | "month" | "year"; as?: string }>
  metrics?: Array<{
    op: "count" | "sum" | "avg" | "min" | "max" | "first" | "last"
    field?: string
    as?: string
    /** first / last only: which field orders the group. Defaults to created_at. */
    order_by?: string
  }>
  /** Over output columns, e.g. `"views desc"`. Defaults to the group-by fields. */
  order_by?: string
  limit?: number
  /** IANA name used for `trunc`, e.g. `"Asia/Shanghai"`. */
  timezone?: string
}

export interface DbAggregateResult<T extends Record<string, unknown> = Record<string, unknown>> {
  list: T[]
  limit: number
  /** True when the row count reached `limit`: narrow the filter or raise the limit. */
  truncated: boolean
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
  aggregate<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    query: DbAggregateQuery,
  ): DbAggregateResult<T>
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
 * Optional per-Func declaration, exported alongside your methods:
 *
 * ```ts
 * export const config: FuncConfig = { timeoutMs: 90000 }
 *
 * export async function generate(input, ctx) { ... }
 * ```
 *
 * How long a Func may run is a property of **the Func**, not of the request that
 * triggered it. A `timeoutMS` passed to `invoke()` ends up in the query string, so
 * any visitor can change it; a declaration lives in the source and ships with the
 * site version. When both are present the declaration wins, and without one a
 * caller can only ask for a modest ceiling.
 *
 * Only the module top level is evaluated to read this, so keep it a literal.
 */
export interface FuncConfig {
  /**
   * Wall-clock budget for one execution, in milliseconds. Covers waiting on
   * `fetch` and the database — it is not a CPU budget, which is enforced
   * separately and much lower.
   *
   * Must be a whole number greater than 0; a malformed value throws rather than
   * being ignored. The platform still caps it at its own maximum.
   */
  timeoutMs?: number
  /**
   * Keeps this Func open to everyone when the project has "Funcs for members
   * only" switched on — form webhooks and payment callbacks, which check their
   * own signature. Has no effect when the switch is off.
   */
  public?: boolean
}

export interface FuncStripeCheckoutSessionInput {
  /**
   * Your own order id, up to 200 chars of letters, digits, dash or underscore.
   * The platform does not generate it: it is your order table's key, the session's
   * `client_reference_id`, its `metadata.client_reference_id` and the default
   * idempotency key — so store the row before redirecting the payer.
   */
  clientReferenceId: string
  /**
   * An integer in the currency's **smallest unit**: `500` means $5.00.
   *
   * Deliberately not a decimal string — passing `"9.90"` throws instead of being
   * silently charged as 9 cents. (`ctx.payment.alipay` takes yuan strings because
   * Alipay's own API does; each provider matches its own upstream.)
   */
  amount: number
  /** Three-letter code such as `"usd"`. Falls back to the integration's default. */
  currency?: string
  /** Product name shown on the Stripe checkout page. */
  name: string
  /** Optional product description shown under the name. */
  description?: string
  /** Defaults to 1. */
  quantity?: number
  /**
   * Override the integration's default return addresses. `successUrl` may contain
   * `{CHECKOUT_SESSION_ID}`, which Stripe replaces with the real session id — pass
   * that back to `retrieveSession` to confirm the payment.
   */
  successUrl?: string
  cancelUrl?: string
  /** Pre-fills the email field on the checkout page. */
  customerEmail?: string
  /** Extra metadata, echoed back on the session and on webhook events. */
  metadata?: Record<string, string>
  /**
   * Session expiry, as a unix time in seconds or a Date. Stripe only accepts
   * between 30 minutes and 24 hours from now; omit it for Stripe's 24h default.
   */
  expiresAt?: number | Date
  /** Defaults to one derived from `clientReferenceId`. */
  idempotencyKey?: string
}

export interface FuncStripeCheckoutSession {
  /** Checkout Session id (`cs_...`). */
  id: string
  /** Stripe-hosted checkout URL; send the browser to it. */
  url: string
  clientReferenceId: string
  /** The amount Stripe recorded, in the smallest currency unit. */
  amountTotal: number
  currency: string
  /** Unix seconds. */
  expiresAt: number
  livemode: boolean
  provider: string
}

/** A Checkout Session read back from Stripe. */
export interface FuncStripeSession {
  id: string
  /** `open` | `complete` | `expired`. */
  status: string
  /** `paid` | `unpaid` | `no_payment_required`. */
  paymentStatus: string
  /** Compare it with your own order before fulfilling. */
  amountTotal: number
  currency: string
  /** The order id you passed to `checkoutSession`. */
  clientReferenceId: string
  /** What the buyer typed on the checkout page, else what you pre-filled. */
  customerEmail: string
  /** Store it: refund events are matched by payment intent. */
  paymentIntentId: string
  metadata: Record<string, string>
  /** Unix seconds. */
  expiresAt: number
  livemode: boolean
  /**
   * `status === "complete" && paymentStatus === "paid"`, computed by the platform
   * so you never check only one half of it.
   */
  paid: boolean
  /** The full Stripe object, for fields not listed above. */
  session: Record<string, unknown>
}

/** A webhook event whose signature has been verified. */
export interface FuncStripeEvent {
  /** Event id — use it as the key of your own de-duplication table. */
  id: string
  /** e.g. `checkout.session.completed`, `charge.refunded`. */
  type: string
  /** Unix seconds. */
  created: number
  apiVersion: string
  livemode: boolean
  /** `event.data.object` — what you read in almost every handler. */
  object: Record<string, unknown>
  /** The whole event, for `data.previous_attributes` and friends. */
  event: Record<string, unknown>
  /**
   * Normalised subscription view, present only on `invoice.*` and `customer.subscription.*`
   * events. Check it with `if (event.subscription)` to split subscription handling from
   * one-off payments.
   */
  subscription?: FuncStripeSubscriptionEvent
}

export interface FuncStripeSubscriptionSessionInput {
  /**
   * Your own subscription id, up to 200 chars of letters, digits, dash or underscore.
   *
   * The platform stamps it on **both** the Checkout Session and the subscription itself.
   * That second copy is the one that matters: a renewal invoice has no Checkout Session,
   * so without it the first charge maps to a user and every renewal after that maps to
   * nobody, silently.
   */
  clientReferenceId: string
  /**
   * A price created in the Stripe dashboard (`price_...`). Use this or the inline fields
   * below, never both. Dashboard prices let you change pricing, coupons and trials without
   * touching code; inline suits a site with a single fixed plan.
   */
  priceId?: string
  /** Inline price: an integer in the currency's smallest unit, as with one-off payments. */
  amount?: number
  currency?: string
  /** `day` | `week` | `month` | `year`. */
  interval?: string
  /** Defaults to 1, e.g. interval `month` with count 3 bills quarterly. */
  intervalCount?: number
  /** Product name shown on the checkout page. Required with an inline price. */
  name?: string
  quantity?: number
  customerEmail?: string
  /**
   * An existing Stripe customer (`cus_...`). Pass it on a repeat subscription, otherwise the
   * same person accumulates several customers and the billing portal and your reporting drift.
   * Mutually exclusive with `customerEmail`.
   */
  customerId?: string
  /** Echoed back on the session, the subscription, and every invoice event. */
  metadata?: Record<string, string>
  /** Free trial length in days. */
  trialDays?: number
  /** Show the promotion-code field on the checkout page. */
  allowPromotionCodes?: boolean
  successUrl?: string
  cancelUrl?: string
  idempotencyKey?: string
}

export interface FuncStripeSubscriptionSession {
  id: string
  /** Stripe-hosted checkout URL; send the browser to it. */
  url: string
  clientReferenceId: string
  livemode: boolean
  provider: string
}

/** A subscription read back from Stripe. */
export interface FuncStripeSubscription {
  id: string
  /** `active` | `trialing` | `past_due` | `canceled` | `unpaid` | `incomplete` | … */
  status: string
  customerId: string
  /**
   * `status` is `active` or `trialing`, computed by the platform. Trialing counts: leaving it
   * out makes a free trial broken from day one.
   */
  active: boolean
  clientReferenceId: string
  priceId: string
  quantity: number
  /** Unix seconds. */
  currentPeriodStart: number
  currentPeriodEnd: number
  cancelAtPeriodEnd: boolean
  /** Unix seconds, 0 when there is no trial. */
  trialEnd: number
  metadata: Record<string, string>
  livemode: boolean
  /** The full Stripe object. */
  subscription: Record<string, unknown>
}

/**
 * The subscription view of a verified webhook event, present only on `invoice.*` and
 * `customer.subscription.*` events and `undefined` on everything else.
 *
 * It exists because the raw paths are deep and have moved between API versions:
 * the renewal metadata lives at `invoice.parent.subscription_details.metadata`, the period at
 * `lines.data[0].period`, the price at `lines.data[0].pricing.price_details.price`. Reading
 * them wrong does not raise an error, it just yields empty strings that match no order.
 */
export interface FuncStripeSubscriptionEvent {
  subscriptionId: string
  customerId: string
  /** Your own id, recovered from the subscription metadata. This is what renewals match on. */
  clientReferenceId: string
  metadata: Record<string, string>
  status: string
  /**
   * Whether the subscription should grant access after this event. For invoice events it means
   * this period was actually paid, filtered by `billingReason` so a one-off invoice is not
   * mistaken for a billing cycle.
   */
  active: boolean
  priceId: string
  /** Unix seconds. */
  currentPeriodStart: number
  currentPeriodEnd: number
  cancelAtPeriodEnd: boolean
  /** Invoice events only. */
  invoiceId: string
  billingReason: string
  amountPaid: number
  currency: string
}

/** The Stripe methods, bound to one payment channel. */
export interface FuncStripeChannel {
  /**
   * Creates a one-off Checkout Session and returns its hosted URL.
   *
   * Subscriptions and dashboard-defined prices are not covered here — use `call`
   * for those; the secret key still never enters Func.
   */
  checkoutSession(input: FuncStripeCheckoutSessionInput): FuncStripeCheckoutSession
  /**
   * Reads a Checkout Session back from Stripe, checking that it really is one and
   * that its mode matches this integration.
   *
   * This is how you confirm a payment right after the buyer lands on `successUrl`:
   * the `session_id` in the query string is attacker-controlled, but a session
   * fetched with your secret key can only belong to your own account. You still
   * have to check that `clientReferenceId` is *this user's* order.
   */
  retrieveSession(sessionId: string): FuncStripeSession
  /**
   * Verifies a webhook: HMAC-SHA256 over the raw body, a 5-minute timestamp
   * tolerance, and the event's `livemode` against this integration.
   *
   * Pass the **raw** body (`await ctx.request.text()`); `JSON.stringify(input)`
   * breaks the signature. The `Stripe-Signature` header is read by the platform, so
   * you neither pass it nor get it wrong. Any failure **throws** rather than
   * returning a value you could mistake for falsy, so a forged event never reaches
   * your code — return a non-2xx and Stripe will retry.
   *
   * Events can arrive more than once and out of order: de-duplicate on `id` in
   * your own table.
   */
  verifyWebhook(rawBody: string): FuncStripeEvent
  /**
   * Creates a subscription Checkout Session.
   *
   * A separate method rather than a `mode` option on `checkoutSession`: changing the mode
   * changes the required parameters, the callback events and the whole reconciliation path,
   * which makes it another method, not another argument.
   */
  subscriptionSession(input: FuncStripeSubscriptionSessionInput): FuncStripeSubscriptionSession
  /** Reads a subscription back, with `active` computed for you. */
  retrieveSubscription(subscriptionId: string): FuncStripeSubscription
  /**
   * Opens a Stripe-hosted billing portal where the subscriber can change their card, read
   * invoices and cancel. Store `customerId` from the first subscription event to call it.
   */
  billingPortalSession(input: { customerId: string; returnUrl?: string }): { url: string }
  /**
   * Calls any other Stripe API (refunds, subscriptions, charges, …) with the
   * integration's secret key. Params are expanded Stripe-style, so nested objects
   * and arrays work: `{ a: { b: [1] } }` becomes `a[b][0]=1`.
   */
  call<T = Record<string, unknown>>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    params?: Record<string, unknown>,
    idempotencyKey?: string,
  ): T
}

/**
 * Stripe capability, available once a Stripe integration is connected for the
 * project. The secret key and the webhook signing secret stay on the server: Func
 * code never holds them, and signing and webhook verification happen server-side.
 *
 * `via(tag)` picks a payment channel when the project has several Stripe accounts.
 * As with Alipay, a tag matching several payment integrations **throws** instead of
 * picking one at random: webhook signing secrets are issued per endpoint, so an
 * event from one account can never verify against another account's secret.
 */
export interface FuncStripeRuntime extends FuncStripeChannel {
  via(tag: string): FuncStripeChannel
}

/**
 * Payment capabilities. This is a **namespace, not a unified interface**: each
 * provider keeps its own method shape. `ctx.payment.stripe` deliberately does not
 * mirror `ctx.payment.alipay` — one signs a form and waits for an async
 * notification, the other creates a Session and reconciles on return plus webhook.
 * Payment providers are not isomorphic, and pretending otherwise would only
 * produce a leaky abstraction.
 *
 * The platform owns cryptography and credentials; your code owns money and goods —
 * amounts must come from a server-side product table, and the order table, amount
 * check and idempotent fulfilment stay in Func.
 */
export interface FuncPaymentRuntime {
  alipay: FuncAlipayRuntime
  stripe: FuncStripeRuntime
}

/** One message in a chat request. */
export interface FuncAIMessage {
  role: "system" | "user" | "assistant" | "developer" | "tool" | (string & {})
  /** May be empty only on an assistant message that carries `toolCalls`. */
  content?: string
  /**
   * Required on a `tool` message: the id of the tool call being answered.
   * `toolCallId` is accepted too, since that is the spelling the result uses.
   */
  tool_call_id?: string
  toolCallId?: string
  /**
   * Only on an `assistant` message, replaying what the model asked for last
   * round. Without it the provider rejects the `tool` message that follows.
   */
  tool_calls?: unknown[]
  toolCalls?: unknown[]
  name?: string
}

/** An OpenAI-shaped tool definition, passed through to the upstream untouched. */
export interface FuncAITool {
  type: "function" | (string & {})
  function: {
    name: string
    description?: string
    /** JSON Schema for the arguments. */
    parameters?: Record<string, unknown>
    strict?: boolean
  }
  [key: string]: unknown
}

export type FuncAIToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; function: { name: string } }

export interface FuncAIChatParams {
  messages: FuncAIMessage[]
  /** Falls back to the model configured on the integration. */
  model?: string
  temperature?: number
  maxTokens?: number
  /**
   * Ask the platform to strip the markdown code fence the model loves to wrap
   * JSON in, then `JSON.parse` what is left into `data`. It **only** controls
   * parsing on our side: no `response_format` is added to the request, because
   * gateways differ on which fields they accept and one unknown field is a 400.
   * Getting the model to emit JSON is still the prompt's job.
   */
  json?: boolean
  /**
   * Tool definitions. The platform sends them upstream and hands `toolCalls`
   * back; it does **not** run the loop. Executing the tool, appending the result
   * to `messages` and calling again is your code — that part is an agent
   * runtime, with its own stopping rule and permission model.
   */
  tools?: FuncAITool[]
  toolChoice?: FuncAIToolChoice
  /**
   * Escape hatch: merged into the request body as-is (`top_p`, `seed`,
   * `response_format`, whatever the gateway takes). `messages` wins over it, so
   * `extra` can add any field but cannot break the message structure.
   */
  extra?: Record<string, unknown>
}

export interface FuncAIToolCall {
  id: string
  name: string
  /**
   * Already parsed. The raw OpenAI response carries `arguments` as a **JSON
   * string**, and the failure mode of forgetting `JSON.parse` is
   * `args.city === undefined` with no error anywhere, so the platform parses it
   * for you. When the model emits broken JSON this is `undefined` and the text
   * is still in `argumentsRaw`.
   */
  arguments?: Record<string, unknown>
  argumentsRaw: string
}

export interface FuncAIChatResult {
  /** Empty when the model answered with tool calls only. That is not an error. */
  content: string
  model: string
  finishReason: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** Set only when `json: true` was requested. */
  data?: Record<string, unknown>
  /** Set only when the model asked for a tool. */
  toolCalls?: FuncAIToolCall[]
}

export interface FuncAIImageParams {
  prompt: string
  /**
   * Defaults to `gpt-image-1`. It deliberately does **not** fall back to the
   * chat model configured on the integration: those are different things, and
   * sending a chat model here only earns an opaque 400.
   */
  model?: string
  /** e.g. `1024x1024`, `1536x1024`. */
  size?: string
  /** `low` | `medium` | `high` (gpt-image-1), `standard` | `hd` (dall-e-3). */
  quality?: string
  /** dall-e-3 only: `vivid` | `natural`. */
  style?: string
  /** gpt-image-1 only: `transparent` | `opaque` | `auto`. */
  background?: string
  /** How many images, 1 to 4. Each one costs money. */
  n?: number
  /**
   * Store the images in the project's own OSS and return permanent `fileUrl`s.
   * Recommended: otherwise a 1024x1024 PNG crosses the sandbox as a ~2MB base64
   * string, against the same heap and CPU budget your code runs in.
   */
  upload?: boolean
  /** Only used with `upload`. Defaults to a content hash; with n > 1 the second
   *  image onwards gets a numbered suffix so they cannot overwrite each other. */
  filename?: string
  /** Escape hatch, merged into the request body as-is. */
  extra?: Record<string, unknown>
}

export interface FuncAIImage {
  /** Set when `upload` was not requested. */
  imageBase64?: string
  /** Set when `upload: true`. A permanent URL, never an expiring one. */
  fileUrl?: string
  /** Sniffed from the actual bytes, not from the requested format. */
  mimeType: string
  bytes: number
  /** dall-e-3 rewrites the prompt and reports what it actually drew. */
  revisedPrompt?: string
}

export interface FuncAIImageResult {
  model: string
  images: FuncAIImage[]
}

/** The AI methods, bound to one channel. */
export interface FuncAIChannel {
  /**
   * One chat completion. Synchronous, no token streaming: a Func returns one
   * value, and `ctx.sse` is there if a site wants to stream something itself.
   */
  chat(params: FuncAIChatParams): FuncAIChatResult
  /**
   * Generate images. A bare string is accepted for the common case.
   *
   * The platform always asks the provider for image **bytes**, never a URL, and
   * hands back either a permanent OSS link (`upload: true`) or base64. This is
   * the whole reason the method exists: the URL OpenAI returns directly expires
   * after about an hour, so storing it in a database works in testing and then
   * turns every image into a 404 in production, with no error anywhere.
   *
   * Image generation takes tens of seconds. Raise the Func timeout with
   * `export const config = { timeoutMs: 120000 }`.
   */
  image(params: FuncAIImageParams | string): FuncAIImageResult
  /**
   * Escape hatch for everything that is not chat (`/embeddings`,
   * `/audio/transcriptions`…). The body goes up as-is and the upstream JSON
   * comes back as-is; the API key still never enters the sandbox.
   */
  call<T = any>(path: string, body?: Record<string, unknown>): T
}

/**
 * OpenAI-compatible chat, available once an OpenAI integration is connected.
 * The API key stays on the server and never reaches Func code; pointing the
 * integration's base URL at another compatible gateway switches provider
 * without touching site code.
 *
 * `via(tag)` picks a channel when the project has several AI integrations, e.g.
 * a cheap model for classification and a strong one for writing.
 */
export interface FuncOpenAIRuntime extends FuncAIChannel {
  via(tag: string): FuncAIChannel
}

/**
 * AI capabilities. Like `ctx.payment`, this is a **namespace, not a unified
 * interface**: the provider name stays in the path. A capability-level
 * `ctx.ai.chat` was considered and rejected, because `call("/embeddings")` is
 * already OpenAI-shaped, so the abstraction leaks the moment anyone uses it.
 */
export interface FuncAIRuntime {
  openai: FuncOpenAIRuntime
}

export interface FuncTTSSpeakParams {
  /**
   * Plain text, **not SSML**. The platform escapes it and builds the SSML,
   * because this text is usually user input and the consequence of not escaping
   * is not a crash but injection: `</voice><voice name='...'>` swaps the voice.
   */
  text: string
  /** Falls back to the voice configured on the integration. */
  voice?: string
  /** e.g. `audio-24khz-48kbitrate-mono-mp3`. */
  format?: string
  language?: string
  /** `+10%`, `-20%`, `1.2`, `slow`… validated against a whitelist. */
  rate?: string
  /** `+10%`, `-2st`… validated against a whitelist. */
  pitch?: string
  /** e.g. `cheerful`, `newscast-casual`. */
  style?: string
  styleDegree?: number | string
  /**
   * Store the audio in the project's own OSS and return `fileUrl`. Recommended:
   * without it the audio has to travel through the sandbox as base64 and be
   * uploaded again with `ctx.assets`.
   */
  upload?: boolean
  /** Only used with `upload`. Defaults to a content hash. */
  filename?: string
}

export interface FuncTTSSpeakResult {
  /** Set when `upload` was not requested. */
  audioBase64?: string
  /** Set when `upload: true`. */
  fileUrl?: string
  mimeType: string
  bytes: number
  voice: string
  format: string
  provider: string
}

/** The TTS methods, bound to one channel. */
export interface FuncTTSChannel {
  /** Synthesise speech. A bare string is accepted for the common case. */
  speak(params: FuncTTSSpeakParams | string): FuncTTSSpeakResult
}

/**
 * Azure (Microsoft) text to speech. The subscription key stays on the server.
 *
 * The platform does **not** cache or deduplicate: the same sentence twice costs
 * twice. Only the site knows what counts as "the same" (does the voice matter?
 * the rate?), so keep your own `text hash -> fileUrl` table if you need one.
 */
export interface FuncAzureTTSRuntime extends FuncTTSChannel {
  via(tag: string): FuncTTSChannel
}

/** Text-to-speech capabilities. A namespace, like `ctx.ai` and `ctx.payment`. */
export interface FuncTTSRuntime {
  azure: FuncAzureTTSRuntime
}

export interface FuncReadonlyStringMap {
  get(name: string): string | null
}

/** Read-only subset of `URLSearchParams`, parsed from `ctx.request.url`. */
export interface FuncRequestQuery {
  /** First value of the parameter, or `null` when absent. Values are already URL-decoded. */
  get(name: string): string | null
  /** Every value of the parameter, in order; an empty array when absent. */
  getAll(name: string): string[]
  has(name: string): boolean
}

export interface FuncRequestRuntime {
  host: string
  ip: string
  method: string
  /** Path only, without the query string, e.g. `/func/leads_hook`. */
  path: string
  /** Full request URL including the query string, like Fetch `Request.url`. */
  url: string
  /** Query parameters of `url`, e.g. `ctx.request.query.get("k")`. */
  query: FuncRequestQuery
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
  /**
   * Ignored: cookies set by a Func are always host-only. Free and preview site
   * domains share a root domain with the platform, so honoring `domain` would let
   * any site set cookies for every other site and for the platform itself.
   */
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

/**
 * A member of the creght project this site belongs to (the owner included),
 * signed in with their creght platform account at `/auth/member/login`.
 * Not the same people as `ctx.auth` users, who are the site's own visitors.
 */
export interface FuncMember {
  /** Platform user id, as a string: it does not fit in a JS number. */
  user_id: string
  name: string
  avatar?: string
  role: "owner" | "member"
}

export interface FuncMemberRuntime {
  /** Null when the visitor has not signed in as a member. */
  current(): FuncMember | null
  /**
   * Throws `member_login_required` (HTTP 401) when the visitor has not signed in;
   * send them to `/auth/member/login?redirect=<path>`. With `"owner"`, a member
   * who is not the owner gets HTTP 403.
   */
  require(role?: "owner"): FuncMember
}

/**
 * Calls a tool on the creght MCP server as the project owner, with the same name
 * and arguments as Shuttle's local `ctx.mcp`. Resolves to the tool's structured
 * result; a tool error rejects. Only `"creght"` exists, only read tools work, and
 * only when the visitor is the signed-in project owner.
 */
export type FuncMCPRuntime = (server: "creght", tool: string, args?: Record<string, unknown>) => Promise<any>

export interface FuncShuttleMachine {
  id: string
  name: string
  /** RFC3339 */
  connected_at: string
}

/**
 * Reaches Shuttle on the project owner's own computer (browser sessions, local
 * keys). Owner only: the visitor must be the project owner signed in at
 * `/auth/member/login`, or the owner previewing in the editor.
 */
export interface FuncShuttleRuntime {
  /**
   * Runs `fn` on the owner's most recently connected computer that has this
   * project open, and resolves to the value it returns. Rejects with an error
   * whose message starts with `shuttle_offline`, `shuttle_timeout` (Shuttle is
   * told to cancel), `shuttle_canceled`, `shuttle_error` (Shuttle's own failure)
   * or `shuttle_owner_required`. Nothing is queued when no computer is online.
   *
   * `timeoutMs` defaults to 60000 and caps at 300000; the Func's own
   * `config.timeoutMs` must leave room for it.
   *
   * Progress: Shuttle's `{ done, total, message }` updates go to `onProgress`
   * when given. Without it, and when the page called with
   * `invoke(..., { onEvent })` (a streaming run), each one is forwarded to the
   * page as an SSE event `progress` automatically. Progress can be dropped under
   * load; the result and error never are.
   */
  call<T = any>(
    fn: string,
    input?: unknown,
    options?: { timeoutMs?: number; onProgress?: (data: any) => void },
  ): Promise<T>
  /** The owner's computers that are online with this project open. */
  online(): { online: boolean; machines: FuncShuttleMachine[] }
}

export interface TalizenFuncContext {
  trace_id: string
  extra?: Record<string, unknown>
  request: FuncRequestRuntime
  response: FuncResponseRuntime
  db: FuncDbRuntime
  auth: FuncAuthRuntime
  /** The visitor as a member of this site's creght project. */
  member: FuncMemberRuntime
  mcp: FuncMCPRuntime
  shuttle: FuncShuttleRuntime
  users: FuncUsersRuntime
  verify: FuncVerifyRuntime
  assets: FuncAssetsRuntime
  cache: FuncCacheRuntime
  email: FuncEmailRuntime
  payment: FuncPaymentRuntime
  ai: FuncAIRuntime
  tts: FuncTTSRuntime
  cookies: FuncCookieRuntime
  sse: FuncSSERuntime
}
