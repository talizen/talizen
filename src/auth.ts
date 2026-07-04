import {
  requestJson,
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
  profile?: unknown
  email_verified_at?: string | null
  last_login_at?: string | null
  created_at?: string
  updated_at?: string
}

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
  profile?: unknown
}

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

export async function requireUser(options?: TalizenRequestOptions): Promise<AuthUser> {
  const user = await currentUser(options)
  if (!user) {
    throw new TalizenAuthError("Login required.")
  }
  return user
}
