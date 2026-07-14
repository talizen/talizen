import * as React from "react"
import {
  getTalizenConfig,
  requestJson,
  subscribeTalizenConfig,
  TalizenHttpError,
  type TalizenRequestOptions,
} from "./core.js"

export interface AuthUser {
  id: string
  /**
   * Login identifier for this project user.
   * This does not need to be an email address or phone number.
   */
  account?: string
  /** Optional contact email/profile field, not the primary login identifier. */
  email?: string
  /** Optional contact phone/profile field, not the primary login identifier. */
  phone?: string
  name?: string
  avatar?: string
  status?: string
  profile?: AuthProfile
  email_verified_at?: string | null
  last_login_at?: string | null
  created_at?: string
  updated_at?: string
}

export type AuthProfile = Record<string, unknown>

export interface AuthPasswordInput {
  /**
   * Login identifier for register/login.
   * Do not substitute email or phone unless the user intentionally uses that
   * value as their account.
   */
  account: string
  password: string
}

export interface AuthRegisterInput extends AuthPasswordInput {
  email?: string
  phone?: string
  name?: string
  avatar?: string
  profile?: AuthProfile
}

export interface AuthProvider {
  key: string
  name: string
  scopes?: string
  status?: string
}

export interface AuthProviderListResponse {
  total?: number
  list?: AuthProvider[]
}

export interface AuthOAuthLoginURLOptions extends TalizenRequestOptions {
  redirectUrl?: string
}

export type User = AuthUser

export class TalizenAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TalizenAuthError"
  }
}

export async function register(
  input: AuthRegisterInput,
  options?: TalizenRequestOptions,
): Promise<AuthUser> {
  return requestJson<AuthUser>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    options,
  )
}

async function loginRequest(
  input: AuthPasswordInput,
  options?: TalizenRequestOptions,
): Promise<AuthUser> {
  return requestJson<AuthUser>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    options,
  )
}

export interface UseAuthResult {
  user: AuthUser | null
  /**
   * True until the first `/auth/me` fetch resolves — i.e. while the auth state
   * is still unknown. This includes the window before the fetch has even
   * started (first render, SSR), so `!loading && !user` reliably means
   * "genuinely signed out" and is safe to use for redirect guards.
   * Background refreshes never toggle this back to true.
   */
  loading: boolean
  error: unknown
  isAuthenticated: boolean
  /** True once the initial auth state has been resolved. Always `!loading`. */
  isInitialized: boolean
  refresh(): Promise<AuthUser | null>
  login(input: AuthPasswordInput): Promise<AuthUser>
  login(account: string, password: string): Promise<AuthUser>
  register(input: AuthRegisterInput): Promise<AuthUser>
  register(account: string, password: string, name?: string): Promise<AuthUser>
  logout(): Promise<void>
  updateProfile(profile: AuthProfile): Promise<AuthUser>
}

type AuthSnapshot = Pick<UseAuthResult, "user" | "loading" | "error" | "isAuthenticated" | "isInitialized">

const authListeners = new Set<() => void>()
let currentUserState: AuthUser | null = null
let authErrorState: unknown = null
let isAuthInitialized = false
let authSnapshot: AuthSnapshot = readAuthSnapshot()
let authRequestId = 0
let isAuthConfigSubscriptionStarted = false
let inflightRefresh: Promise<AuthUser | null> | null = null

function readAuthSnapshot(): AuthSnapshot {
  return {
    user: currentUserState,
    // `loading` is derived, not tracked: the auth state is "loading" exactly
    // until the first initialization resolves. Deriving it from
    // `isAuthInitialized` means the pre-initialization window (first render,
    // SSR, before useAuth's mount effect fires the bootstrap /auth/me) already
    // reports `loading: true` — so a consumer guard like `!loading && !user`
    // can never misread "state unknown" as "signed out" and redirect-loop.
    loading: !isAuthInitialized,
    error: authErrorState,
    isAuthenticated: !!currentUserState,
    isInitialized: isAuthInitialized,
  }
}

function isSameSnapshot(a: AuthSnapshot, b: AuthSnapshot): boolean {
  return (
    a.user === b.user &&
    a.loading === b.loading &&
    a.error === b.error &&
    a.isAuthenticated === b.isAuthenticated &&
    a.isInitialized === b.isInitialized
  )
}

function emitAuthChange() {
  const next = readAuthSnapshot()
  // Skip notifying subscribers when nothing actually changed. Background
  // refreshes that return the same user must not trigger re-renders, and this
  // keeps the `authSnapshot` reference stable for useSyncExternalStore.
  if (isSameSnapshot(authSnapshot, next)) return
  authSnapshot = next
  authListeners.forEach(listener => listener())
}

function subscribeAuth(listener: () => void): () => void {
  authListeners.add(listener)
  return () => {
    authListeners.delete(listener)
  }
}

function ensureAuthConfigSubscription() {
  if (isAuthConfigSubscriptionStarted) return
  isAuthConfigSubscriptionStarted = true
  subscribeTalizenConfig(() => {
    void refreshAuthState().catch(() => {})
  })
}

function normalizeLoginInput(input: AuthPasswordInput | string, password?: string): AuthPasswordInput {
  if (typeof input === "string") {
    return {
      account: input,
      password: password ?? "",
    }
  }
  return input
}

function normalizeRegisterInput(input: AuthRegisterInput | string, password?: string, name?: string): AuthRegisterInput {
  if (typeof input === "string") {
    return {
      account: input,
      email: input,
      password: password ?? "",
      name,
    }
  }
  return input
}

function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof TalizenHttpError && error.status === 401
}

// AuthUser is plain JSON response data, so serialize-compare is sufficient.
function isSameAuthUser(a: AuthUser | null, b: AuthUser | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

async function refreshAuthState(options?: TalizenRequestOptions): Promise<AuthUser | null> {
  // Coalesce concurrent refreshes. Multiple mounted consumers plus config
  // change notifications would otherwise each fire their own /auth/me; share
  // a single in-flight request instead.
  if (inflightRefresh) return inflightRefresh

  const requestId = authRequestId + 1
  authRequestId = requestId

  // `loading` is derived from `isAuthInitialized` (see readAuthSnapshot), so
  // the pre-initialization snapshot already reports `loading: true` — there is
  // nothing to toggle here. Background refreshes (mount of another consumer,
  // config change, manual refresh) must NOT surface a loading state, otherwise
  // a consumer that renders a spinner while `loading` is true unmounts and
  // remounts its whole subtree on every refresh — re-running mount effects and
  // re-fetching in a loop.
  if (!isAuthInitialized && authErrorState !== null) {
    authErrorState = null
    emitAuthChange()
  }

  let runPromise!: Promise<AuthUser | null>
  runPromise = (async () => {
    try {
      let user = await fetchCurrentUser(options)
      if (authRequestId === requestId) {
        // Keep the previous reference when the payload is unchanged so `user`
        // stays stable for React dependency arrays.
        if (isSameAuthUser(currentUserState, user)) {
          user = currentUserState
        }
        currentUserState = user
        authErrorState = null
        isAuthInitialized = true
        emitAuthChange()
      }
      return user
    } catch (error) {
      if (authRequestId === requestId) {
        currentUserState = null
        authErrorState = isUnauthenticatedError(error) ? null : error
        isAuthInitialized = true
        emitAuthChange()
      }
      if (isUnauthenticatedError(error)) {
        return null
      }
      throw error
    } finally {
      if (inflightRefresh === runPromise) inflightRefresh = null
    }
  })()

  inflightRefresh = runPromise
  return runPromise
}

function setAuthUser(user: AuthUser | null) {
  // Invalidate any in-flight refresh so its late result cannot overwrite the
  // authoritative login/logout/profile state.
  authRequestId += 1
  inflightRefresh = null
  if (!isSameAuthUser(currentUserState, user)) {
    currentUserState = user
  }
  authErrorState = null
  isAuthInitialized = true
  emitAuthChange()
}

/**
 * Subscribe to the current auth user.
 *
 * The hook reloads `/auth/me` whenever `setTalizenConfig()` changes runtime
 * config, which lets preview auth headers update the page without remounting.
 *
 * The returned object and its `user` keep stable references until the auth
 * state actually changes, so both are safe to use in React dependency arrays.
 */
export function useAuth(options?: TalizenRequestOptions): UseAuthResult {
  const snapshot = React.useSyncExternalStore(subscribeAuth, () => authSnapshot, () => authSnapshot)
  const optionsRef = React.useRef(options)

  React.useEffect(() => {
    optionsRef.current = options
  }, [options])

  const refresh = React.useCallback(async () => {
    return refreshAuthState(optionsRef.current)
  }, [])

  React.useEffect(() => {
    ensureAuthConfigSubscription()
    void refresh().catch(() => {})
  }, [refresh])

  const loginAndRefresh = React.useCallback(async (input: AuthPasswordInput | string, password?: string) => {
    const nextUser = await loginRequest(normalizeLoginInput(input, password), optionsRef.current)
    setAuthUser(nextUser)
    return nextUser
  }, [])

  const registerAndRefresh = React.useCallback(async (input: AuthRegisterInput | string, password?: string, name?: string) => {
    const nextUser = await register(normalizeRegisterInput(input, password, name), optionsRef.current)
    setAuthUser(nextUser)
    return nextUser
  }, [])

  const logoutAndRefresh = React.useCallback(async () => {
    await logoutRequest(optionsRef.current)
    setAuthUser(null)
  }, [])

  const updateProfileAndRefresh = React.useCallback(async (profile: AuthProfile) => {
    const nextUser = await updateProfile(profile, optionsRef.current)
    setAuthUser(nextUser)
    return nextUser
  }, [])

  return React.useMemo(
    () => ({
      ...snapshot,
      refresh,
      login: loginAndRefresh as UseAuthResult["login"],
      register: registerAndRefresh as UseAuthResult["register"],
      logout: logoutAndRefresh,
      updateProfile: updateProfileAndRefresh,
    }),
    [snapshot, refresh, loginAndRefresh, registerAndRefresh, logoutAndRefresh, updateProfileAndRefresh],
  )
}

async function logoutRequest(options?: TalizenRequestOptions): Promise<void> {
  await requestJson<{ ok: boolean }>(
    "/auth/logout",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    options,
  )
}

async function fetchCurrentUser(options?: TalizenRequestOptions): Promise<AuthUser | null> {
  return requestJson<AuthUser | null>("/auth/me", { method: "GET" }, options)
}

export async function updateProfile(
  profile: AuthProfile,
  options?: TalizenRequestOptions,
): Promise<AuthUser> {
  return requestJson<AuthUser>(
    "/auth/me/profile",
    {
      method: "PUT",
      body: JSON.stringify({ profile }),
    },
    options,
  )
}

export async function listAuthProviders(options?: TalizenRequestOptions): Promise<AuthProvider[]> {
  const response = await requestJson<AuthProviderListResponse>(
    "/auth/provider_list",
    { method: "GET" },
    options,
  )
  return response.list ?? []
}

export async function getOAuthLoginUrl(
  provider: string,
  options?: AuthOAuthLoginURLOptions,
): Promise<string> {
  const url = new URL("/auth/oauth/login_url", "https://talizen.local")
  url.searchParams.set("provider", provider)
  if (options?.redirectUrl) {
    url.searchParams.set("redirect_url", options.redirectUrl)
  }
  const response = await requestJson<{ url: string }>(
    url.pathname + url.search,
    { method: "GET" },
    options,
  )
  return response.url
}

export async function loginWithOAuth(
  provider: string,
  options?: AuthOAuthLoginURLOptions,
): Promise<void> {
  const target = await getOAuthLoginUrl(provider, options)
  if (typeof window === "undefined" || !window.location) {
    throw new TalizenAuthError("OAuth login requires a browser window.")
  }
  window.location.href = target
}
