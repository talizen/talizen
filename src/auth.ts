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

export async function login(
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
  loading: boolean
  error: unknown
  isAuthenticated: boolean
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
let isAuthLoading = false
let authSnapshot: AuthSnapshot = readAuthSnapshot()
let authRequestId = 0
let isAuthConfigSubscriptionStarted = false

function readAuthSnapshot(): AuthSnapshot {
  return {
    user: currentUserState,
    loading: isAuthLoading,
    error: authErrorState,
    isAuthenticated: !!currentUserState,
    isInitialized: isAuthInitialized,
  }
}

function emitAuthChange() {
  authSnapshot = readAuthSnapshot()
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

async function refreshAuthState(options?: TalizenRequestOptions): Promise<AuthUser | null> {
  const requestId = authRequestId + 1
  authRequestId = requestId
  isAuthLoading = true
  authErrorState = null
  emitAuthChange()
  try {
    const user = await currentUser(options)
    if (authRequestId === requestId) {
      currentUserState = user
      authErrorState = null
      isAuthInitialized = true
      isAuthLoading = false
      emitAuthChange()
    }
    return user
  } catch (error) {
    if (authRequestId === requestId) {
      currentUserState = null
      authErrorState = isUnauthenticatedError(error) ? null : error
      isAuthInitialized = true
      isAuthLoading = false
      emitAuthChange()
    }
    if (isUnauthenticatedError(error)) {
      return null
    }
    throw error
  }
}

function setAuthUser(user: AuthUser | null) {
  authRequestId += 1
  currentUserState = user
  authErrorState = null
  isAuthInitialized = true
  isAuthLoading = false
  emitAuthChange()
}

/**
 * Subscribe to the current auth user.
 *
 * The hook reloads `/auth/me` whenever `setTalizenConfig()` changes runtime
 * config, which lets preview auth headers update the page without remounting.
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
    const nextUser = await login(normalizeLoginInput(input, password), optionsRef.current)
    setAuthUser(nextUser)
    return nextUser
  }, [])

  const registerAndRefresh = React.useCallback(async (input: AuthRegisterInput | string, password?: string, name?: string) => {
    const nextUser = await register(normalizeRegisterInput(input, password, name), optionsRef.current)
    setAuthUser(nextUser)
    return nextUser
  }, [])

  const logoutAndRefresh = React.useCallback(async () => {
    await logout(optionsRef.current)
    setAuthUser(null)
  }, [])

  const updateProfileAndRefresh = React.useCallback(async (profile: AuthProfile) => {
    const nextUser = await updateProfile(profile, optionsRef.current)
    setAuthUser(nextUser)
    return nextUser
  }, [])

  return {
    ...snapshot,
    refresh,
    login: loginAndRefresh as UseAuthResult["login"],
    register: registerAndRefresh as UseAuthResult["register"],
    logout: logoutAndRefresh,
    updateProfile: updateProfileAndRefresh,
  }
}

export async function logout(options?: TalizenRequestOptions): Promise<void> {
  await requestJson<{ ok: boolean }>(
    "/auth/logout",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    options,
  )
}

export async function currentUser(options?: TalizenRequestOptions): Promise<AuthUser | null> {
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

export async function requireUser(options?: TalizenRequestOptions): Promise<AuthUser> {
  const user = await currentUser(options)
  if (!user) {
    throw new TalizenAuthError("Login required.")
  }
  return user
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
