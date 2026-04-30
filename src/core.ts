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
}

export interface TalizenRequestOptions extends TalizenClientConfig {
  signal?: AbortSignal
}

export interface TalizenErrorBody {
  code?: number | string
  message?: string
}

let talizenConfig: TalizenClientConfig = {}

export function setTalizenConfig(config: TalizenClientConfig): void {
  talizenConfig = {
    ...talizenConfig,
    ...config,
  }
}

export function getTalizenConfig(): TalizenClientConfig {
  return talizenConfig
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

  constructor(status: number, statusText: string, body: string, bodyJson?: TalizenErrorBody) {
    super(`Talizen request failed: ${status} ${statusText} ${body}`.trim())
    this.name = "TalizenHttpError"
    this.status = status
    this.statusText = statusText
    this.body = body
    this.bodyJson = bodyJson
  }
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

  const response = await resolved.fetch(buildTalizenUrl(path, resolved), {
    ...init,
    headers,
    signal: resolved.signal,
  })

  if (!response.ok) {
    const text = await response.text()
    const bodyJson = parseTalizenErrorBody(text)
    throw new TalizenHttpError(response.status, response.statusText, text, bodyJson)
  }

  const text = await response.text()
  if (text === "") {
    return undefined as T
  }

  return JSON.parse(text) as T
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
