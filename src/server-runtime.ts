export interface ServerReadonlyStringMap {
  get(name: string): string | null
}

export interface TalizenServerRequestRuntime {
  host: string
  ip: string
  method: string
  path: string
  url: string
  headers: ServerReadonlyStringMap
  cookies: ServerReadonlyStringMap
}

export interface ServerCookieSetOptions {
  path?: string
  domain?: string
  maxAge?: number
  secure?: boolean
  httpOnly?: boolean
  sameSite?: "lax" | "strict" | "none"
}

export interface TalizenServerCookieRuntime {
  get(name: string): string | null
  set(name: string, value: string, options?: ServerCookieSetOptions): { ok?: boolean }
  delete(name: string, options?: Pick<ServerCookieSetOptions, "path" | "domain">): {
    ok?: boolean
  }
}

export interface TalizenServerAuthRuntime<User = unknown> {
  currentUser(): User | null
  requireUser(): User
}

export interface TalizenServerFuncRuntime {
  invoke<T = unknown>(key: string, input?: unknown): T
}

export interface TalizenServerSideContext<User = unknown> {
  query: Record<string, string | string[]>
  searchParams: Record<string, string | string[]>
  params: Record<string, string>
  locale?: string
  locales?: string[]
  defaultLocale?: string
  request: TalizenServerRequestRuntime
  req: TalizenServerRequestRuntime
  cookies: TalizenServerCookieRuntime
  auth: TalizenServerAuthRuntime<User>
  func: TalizenServerFuncRuntime
}
