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

export interface TalizenFuncContext {
  trace_id: string
  extra?: Record<string, unknown>
  request: FuncRequestRuntime
  response: FuncResponseRuntime
  db: FuncDbRuntime
  auth: FuncAuthRuntime
  cache: FuncCacheRuntime
  cookies: FuncCookieRuntime
}
