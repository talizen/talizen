import {
  requestJson,
  type TalizenRequestOptions,
} from "./core.js"

export interface FuncLogEntry {
  level: string
  text: string
}

export interface FuncRunResponse<T = unknown> {
  ok: boolean
  result?: T
  logs?: FuncLogEntry[]
  error?: string
}

export class TalizenFuncError extends Error {
  readonly key: string
  readonly method: string
  readonly logs: FuncLogEntry[]

  constructor(key: string, method: string, message: string, logs?: FuncLogEntry[]) {
    super(message)
    this.name = "TalizenFuncError"
    this.key = key
    this.method = method
    this.logs = logs ?? []
  }
}

export async function invoke<T = unknown>(
  name: string,
  input?: unknown,
  options?: TalizenRequestOptions,
): Promise<T> {
  const target = parseInvokeName(name)
  return runFunc<T>(target.key, input, {
    ...options,
    method: target.method,
  })
}

export interface RunFuncOptions extends TalizenRequestOptions {
  method?: string
}

export async function runFunc<T = unknown>(
  key: string,
  input?: unknown,
  options?: RunFuncOptions,
): Promise<T> {
  const normalizedKey = normalizeFuncKey(key)
  const method = normalizeFuncMethod(options?.method)
  const response = await requestJson<FuncRunResponse<T>>(
    `/func/${encodeFuncKey(normalizedKey)}${method === "main" ? "" : `.${encodeURIComponent(method)}`}`,
    {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    },
    options,
  )

  if (!response.ok) {
    throw new TalizenFuncError(normalizedKey, method, response.error || "Talizen func failed.", response.logs)
  }

  return response.result as T
}

export function parseInvokeName(name: string): { key: string; method: string } {
  const normalized = normalizeFuncKey(name)
  const lastSlash = normalized.lastIndexOf("/")
  const lastDot = normalized.lastIndexOf(".")
  if (lastDot <= lastSlash) {
    return { key: normalized, method: "main" }
  }

  const key = normalized.slice(0, lastDot)
  const method = normalized.slice(lastDot + 1)
  return {
    key: normalizeFuncKey(key),
    method: normalizeFuncMethod(method),
  }
}

function normalizeFuncKey(key: string): string {
  const normalized = key.trim().replace(/^\/+|\/+$/g, "")
  if (normalized === "") {
    throw new Error("Talizen func key is required.")
  }
  if (normalized.includes("..") || normalized.includes("\0")) {
    throw new Error(`Invalid Talizen func key: ${key}`)
  }
  return normalized
}

function normalizeFuncMethod(method: string | undefined): string {
  const normalized = (method ?? "main").trim()
  if (normalized === "") {
    return "main"
  }
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(normalized)) {
    throw new Error(`Invalid Talizen func method: ${method}`)
  }
  return normalized
}

function encodeFuncKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/")
}
