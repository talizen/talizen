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


export interface TalizenClientConfig {
  baseUrl?: string
  headers?: HeadersInit
  fetch?: typeof fetch
}

export interface TalizenRequestOptions extends TalizenClientConfig {
  signal?: AbortSignal
}

let globalTalizenConfig: TalizenClientConfig = {}

export function setTalizenConfig(config: TalizenClientConfig): void {
  globalTalizenConfig = {
    ...globalTalizenConfig,
    ...config,
  }
}

export function getTalizenConfig(): TalizenClientConfig {
  return {
    ...globalTalizenConfig,
  }
}

export function resolveTalizenConfig(config?: TalizenRequestOptions): Required<Pick<TalizenClientConfig, "baseUrl" | "fetch">> & TalizenRequestOptions {
  const merged = {
    ...globalTalizenConfig,
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

export function buildTalizenUrl(path: string, config?: TalizenRequestOptions): string {
  const resolved = resolveTalizenConfig(config)
  return new URL(path.replace(/^\//, ""), ensureBaseUrl(resolved.baseUrl)).toString()
}

export async function requestJson<T>(path: string, init?: RequestInit, config?: TalizenRequestOptions): Promise<T> {
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
    throw new Error(`Talizen request failed: ${response.status} ${response.statusText} ${text}`.trim())
  }

  const text = await response.text()
  if (text === "") {
    return undefined as T
  }

  return JSON.parse(text) as T
}

function ensureBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
}

function getDefaultBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }

  throw new Error("Talizen baseUrl is required. Call setTalizenConfig({ baseUrl }) first.")
}

function getDefaultFetch(): typeof fetch {
  if (typeof fetch === "function") {
    return (input, init) => fetch(input, init)
  }

  throw new Error("Talizen fetch implementation is required in the current runtime.")
}
