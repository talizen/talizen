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

export interface FuncAuthRuntime {
  currentUser(): AuthUser | null
  requireUser(): AuthUser
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
  assets: FuncAssetsRuntime
  cache: FuncCacheRuntime
  email: FuncEmailRuntime
  cookies: FuncCookieRuntime
  sse: FuncSSERuntime
}
