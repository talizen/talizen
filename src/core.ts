export type Datatype =
  | "array"
  | "string"
  | "int"
  | "float"
  | "bool"
  | "date"
  | "datetime"
  | "time"
  | "file"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "cms"

export interface TV<T = unknown> {
  type: Datatype | string
  value: T
}

export interface ImgItem {
  size?: number
  name?: string
  src: string
  alt?: string
  width?: number
}

export type Image = ImgItem[] | ImgItem

export type TalizenFileUploadProcessCallback = (key: string, process: number) => void

export interface TalizenClientConfig {
  baseUrl?: string
  headers?: HeadersInit
  fetch?: typeof fetch
  onFileUploadProcess?: TalizenFileUploadProcessCallback
  i18n?: Partial<TalizenLocaleRuntime>
  messages?: Record<string, unknown>
}

export interface TalizenRequestOptions extends TalizenClientConfig {
  signal?: AbortSignal
}

export interface TalizenErrorBody {
  code?: number | string
  message?: string
}

export interface TalizenLocaleRuntime {
  locale: string
  locales: string[]
  defaultLocale: string
}

let talizenConfig: TalizenClientConfig = {}
const talizenConfigListeners = new Set<() => void>()

function isShallowEqualConfig(a: TalizenClientConfig, b: TalizenClientConfig): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false
    }
  }
  return true
}

export function setTalizenConfig(config: TalizenClientConfig): void {
  const merged = {
    ...talizenConfig,
    ...config,
  }
  // Only notify subscribers when the config actually changed. The render
  // runtime may re-apply identical config repeatedly; without this guard each
  // call would trigger a fresh auth refresh and other subscriber work.
  const changed = !isShallowEqualConfig(talizenConfig, merged)
  talizenConfig = merged
  if (changed) {
    talizenConfigListeners.forEach(listener => listener())
  }
}

export function getTalizenConfig(): TalizenClientConfig {
  return talizenConfig
}

export function subscribeTalizenConfig(listener: () => void): () => void {
  talizenConfigListeners.add(listener)
  return () => {
    talizenConfigListeners.delete(listener)
  }
}

declare global {
  var TalizenConfig: TalizenClientConfig | undefined;
}

export function resolveTalizenConfig(
  config?: TalizenRequestOptions,
): Required<Pick<TalizenClientConfig, "baseUrl" | "fetch">> & TalizenRequestOptions {
  // globalThis is the global object in the browser and node.js
  const globalTalizenConfig = typeof globalThis !== "undefined" ? globalThis.TalizenConfig : {}

  const merged = {
    ...globalTalizenConfig,
    ...talizenConfig,
    ...config,
  }

  const baseUrl = merged.baseUrl ?? getDefaultBaseUrl()
  const fetchImpl = merged.fetch ?? getDefaultFetch()

  return {
    ...merged,
    baseUrl,
    fetch: fetchImpl,
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const subPath = path.startsWith("/") ? path.slice(1) : path
  return `${base}/${subPath}`
}

function buildTalizenUrl(path: string, config?: TalizenRequestOptions): string {
  const resolved = resolveTalizenConfig(config)
  return joinUrl(resolved.baseUrl, path)
}

export class TalizenHttpError extends Error {
  readonly status: number
  readonly statusText: string
  readonly body: string
  readonly bodyJson: TalizenErrorBody | undefined
  readonly method: string | undefined
  readonly url: string | undefined

  constructor(status: number, statusText: string, body: string, bodyJson?: TalizenErrorBody, request?: TalizenErrorRequest) {
    super(formatTalizenRequestErrorMessage(status, statusText, body, request))
    this.name = "TalizenHttpError"
    this.status = status
    this.statusText = statusText
    this.body = body
    this.bodyJson = bodyJson
    this.method = request?.method
    this.url = request?.url
  }
}

export interface TalizenErrorRequest {
  method?: string
  url?: string
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit,
  config?: TalizenRequestOptions,
): Promise<T> {
  const resolved = resolveTalizenConfig(config)
  const headers = new Headers(resolved.headers ?? {})

  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value)
    })
  }

  if (init?.body != null && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }

  const requestUrl = buildTalizenUrl(path, resolved)
  const request = {
    method: normalizeRequestMethod(init?.method),
    url: stripUrlQuery(requestUrl),
  }
  const response = await resolved.fetch(requestUrl, {
    ...init,
    headers,
    signal: resolved.signal,
  })

  if (!response.ok) {
    const text = await response.text()
    const bodyJson = parseTalizenErrorBody(text)
    throw new TalizenHttpError(response.status, response.statusText, text, bodyJson, request)
  }

  const text = await response.text()
  if (text === "") {
    return undefined as T
  }

  return JSON.parse(text) as T
}

export function stripUrlQuery(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ""
    return parsed.toString()
  }
  catch {
    return url.split("?")[0] ?? url
  }
}

export function normalizeRequestMethod(method: string | undefined): string {
  return (method ?? "GET").toUpperCase()
}

function formatTalizenRequestErrorMessage(
  status: number,
  statusText: string,
  body: string,
  request?: TalizenErrorRequest,
): string {
  const requestText = [request?.method, request?.url].filter(Boolean).join(" ")
  return `Talizen request failed: ${requestText} ${status} ${statusText} ${body}`.replace(/\s+/g, " ").trim()
}

function getDefaultBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }

  throw new Error("Talizen baseUrl is required. set window.TalizenConfig = { baseUrl: 'https://example.com' } first.")
}

function getDefaultFetch(): typeof fetch {
  if (typeof fetch === "function") {
    return (input, init) => fetch(input, init)
  }

  throw new Error("Talizen fetch implementation is required in the current runtime.")
}

function parseTalizenErrorBody(body: string): TalizenErrorBody | undefined {
  if (body === "") {
    return undefined
  }

  try {
    const parsed = JSON.parse(body) as unknown
    if (isTalizenErrorBody(parsed)) {
      return parsed
    }
  }
  catch {
    return undefined
  }

  return undefined
}

function isTalizenErrorBody(value: unknown): value is TalizenErrorBody {
  if (typeof value !== "object" || value == null) {
    return false
  }

  const record = value as Record<string, unknown>
  const code = record.code
  const message = record.message
  const isCodeValid = code === undefined || typeof code === "number" || typeof code === "string"
  const isMessageValid = message === undefined || typeof message === "string"
  return isCodeValid && isMessageValid
}
