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

export interface FuncDbRuntime {
  get<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    id: string,
  ): DbRecord<T> | null
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    query?: DbQuery,
  ): Array<DbRecord<T>>
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

function unavailable(): never {
  throw new Error("talizen/func-runtime is only available inside Talizen Func runtime.")
}

export const db: FuncDbRuntime = {
  get: unavailable,
  query: unavailable,
  insert: unavailable,
  update: unavailable,
  delete: unavailable,
}

export const auth: FuncAuthRuntime = {
  currentUser: unavailable,
  requireUser: unavailable,
}

export const cache: FuncCacheRuntime = {
  get: unavailable,
  set: unavailable,
  del: unavailable,
  incr: unavailable,
  expire: unavailable,
}
