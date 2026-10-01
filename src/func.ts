import {
  parseTalizenErrorBody,
  requestJson,
  requestRaw,
  TalizenHttpError,
  type TalizenRequestOptions,
} from "./core.js"

export interface FuncLogEntry {
  level: string
  text: string
}

export interface FuncRunResponse<T = unknown> {
  result?: T
  logs?: FuncLogEntry[]
  error?: string
}

export class TalizenFuncError extends Error {
  readonly key: string
  readonly method: string
  readonly logs: FuncLogEntry[]
  readonly status: number

  constructor(key: string, method: string, message: string, logs?: FuncLogEntry[], status = 200) {
    super(message)
    this.name = "TalizenFuncError"
    this.key = key
    this.method = method
    this.logs = logs ?? []
    this.status = status
  }
}

export async function invoke<T = unknown>(
  name: string,
  input?: unknown,
  options?: RunFuncOptions,
): Promise<T> {
  const target = parseInvokeName(name)
  return runFunc<T>(target.key, input, {
    ...options,
    method: target.method,
  })
}

/** One server-sent event from a streaming func run (anything before the final result). */
export interface FuncStreamEvent {
  /** e.g. "progress" (ctx.shuttle.call forwards Shuttle's progress as this), or whatever the func passed to ctx.sse.send. */
  event: string
  /** Parsed JSON when the payload is JSON, otherwise the raw string. */
  data: any
  id?: string
}

export interface RunFuncOptions extends TalizenRequestOptions {
  method?: string
  timeoutMS?: number
  timeoutMs?: number
  /**
   * Run the func as a stream and receive its events as they happen — e.g.
   * `{ event: "progress", data: { done, total, message } }` while a
   * `ctx.shuttle.call` is running. The promise still resolves to the final
   * result and rejects with the same TalizenFuncError as a normal call.
   * Events may be dropped under load; the final result never is.
   */
  onEvent?: (event: FuncStreamEvent) => void
}

export async function runFunc<T = unknown>(
  key: string,
  input?: unknown,
  options?: RunFuncOptions,
): Promise<T> {
  const normalizedKey = normalizeFuncKey(key)
  const method = normalizeFuncMethod(options?.method)
  const timeoutMS = normalizeTimeoutMS(options?.timeoutMS ?? options?.timeoutMs)
  const path = `/func/${encodeFuncKey(normalizedKey)}${method === "main" ? "" : `.${encodeURIComponent(method)}`}${timeoutMS ? `?timeout_ms=${timeoutMS}` : ""}`
  if (options?.onEvent) {
    return runFuncStream<T>(path, normalizedKey, method, input, options.onEvent, options)
  }
  let response: FuncRunResponse<T>
  try {
    response = await requestJson<FuncRunResponse<T>>(
      path,
      {
        method: "POST",
        body: JSON.stringify(input ?? {}),
      },
      options,
    )
  } catch (error) {
    if (error instanceof TalizenHttpError) {
      throw new TalizenFuncError(normalizedKey, method, funcHttpErrorMessage(error), undefined, error.status)
    }
    throw error
  }

  if (response.error) {
    throw new TalizenFuncError(normalizedKey, method, response.error || "Talizen func failed.", response.logs)
  }

  return response.result as T
}

async function runFuncStream<T>(
  path: string,
  key: string,
  method: string,
  input: unknown,
  onEvent: (event: FuncStreamEvent) => void,
  options: RunFuncOptions,
): Promise<T> {
  const { response, request } = await requestRaw(
    path,
    {
      method: "POST",
      body: JSON.stringify(input ?? {}),
      headers: { accept: "text/event-stream" },
    },
    options,
  )
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("text/event-stream") || !response.body) {
    // Failed before the stream started (quota, not found…): same errors as a normal call.
    const text = await response.text()
    if (!response.ok) {
      const error = new TalizenHttpError(response.status, response.statusText, text, parseTalizenErrorBody(text), request)
      throw new TalizenFuncError(key, method, funcHttpErrorMessage(error), undefined, response.status)
    }
    const payload = (text ? JSON.parse(text) : {}) as FuncRunResponse<T>
    if (payload.error) {
      throw new TalizenFuncError(key, method, payload.error, payload.logs, response.status)
    }
    return payload.result as T
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
    let boundary: number
    while ((boundary = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, "")
      const event = parseSSEBlock(block)
      if (!event) continue
      if (event.event === "done") {
        void reader.cancel().catch(() => {})
        return (event.data as FuncRunResponse<T>)?.result as T
      }
      if (event.event === "error") {
        void reader.cancel().catch(() => {})
        const data = event.data as FuncRunResponse<T> | string
        const message = typeof data === "string" ? data : data?.error || "Talizen func failed."
        throw new TalizenFuncError(key, method, message, typeof data === "string" ? undefined : data?.logs, response.status)
      }
      try {
        onEvent(event)
      } catch {
        // A failing progress handler must not lose the result.
      }
    }
    if (done) break
  }
  throw new TalizenFuncError(key, method, "The func stream ended before a result arrived.", undefined, response.status)
}

function parseSSEBlock(block: string): FuncStreamEvent | null {
  let event = "message"
  let id: string | undefined
  const data: string[] = []
  for (const line of block.split(/\r?\n/)) {
    if (line === "" || line.startsWith(":")) continue
    const colon = line.indexOf(":")
    const field = colon < 0 ? line : line.slice(0, colon)
    const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "")
    if (field === "event") event = value
    else if (field === "data") data.push(value)
    else if (field === "id") id = value
  }
  if (data.length === 0 && event === "message") return null
  const raw = data.join("\n")
  let parsed: unknown = raw
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Not JSON: keep the string.
  }
  return { event, data: parsed, id }
}

function funcHttpErrorMessage(error: TalizenHttpError): string {
  try {
    const payload = JSON.parse(error.body) as { error?: unknown }
    if (typeof payload.error === "string") {
      return payload.error
    }
    if (payload.error && typeof payload.error === "object") {
      const message = (payload.error as { message?: unknown }).message
      if (typeof message === "string") {
        return message
      }
    }
  } catch {
    // Fall through to the HTTP error body.
  }
  return error.body || error.message || "Talizen func failed."
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

function normalizeTimeoutMS(timeoutMS: number | undefined): number | undefined {
  if (timeoutMS == null) {
    return undefined
  }
  if (!Number.isFinite(timeoutMS) || timeoutMS <= 0) {
    throw new Error(`Invalid Talizen func timeoutMS: ${timeoutMS}`)
  }
  return Math.floor(timeoutMS)
}
