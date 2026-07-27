import {
  normalizeRequestMethod,
  requestJson,
  resolveTalizenConfig,
  stripUrlQuery,
  type TalizenRequestOptions,
} from "./core.js"

interface PreuploadResponse {
  hash_exist?: boolean
  presigned_url?: string
  file_path?: string
  file_url?: string
  id?: number
}

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"

export interface SignedUploadTarget {
  hashExist: boolean
  uploadUrl?: string
  fileUrl: string
  filePath?: string
  id?: number
  hash: string
}

export async function uploadWithSignedUrl(
  preuploadPath: string,
  file: Blob,
  fileName: string,
  progressKey: string,
  options?: TalizenRequestOptions,
): Promise<SignedUploadTarget> {
  const resolved = resolveTalizenConfig(options)
  notifyUploadProcess(resolved, progressKey, 0)

  const hash = await sha256(file)
  const preupload = await requestJson<PreuploadResponse>(
    preuploadPath,
    {
      method: "POST",
      body: JSON.stringify({
        file_name: fileName,
        hash,
        mimetype: file.type || "application/octet-stream",
        file_size: file.size,
      }),
    },
    options,
  )

  const target = normalizePreuploadResponse(preupload, hash)
  await putToSignedUrl(target, file, progressKey, resolved)
  notifyUploadProcess(resolved, progressKey, 1)
  return target
}

function normalizePreuploadResponse(response: PreuploadResponse, hash: string): SignedUploadTarget {
  const hashExist = response.hash_exist === true
  const uploadUrl = getString(response.presigned_url)
  const fileUrl = getString(response.file_url)

  if (fileUrl == null) {
    throw new Error("Talizen preupload response is missing file_url.")
  }
  if (!hashExist && uploadUrl == null) {
    throw new Error("Talizen preupload response is missing presigned_url.")
  }

  return {
    hashExist,
    uploadUrl,
    fileUrl,
    filePath: getString(response.file_path),
    id: typeof response.id === "number" && response.id > 0 ? response.id : undefined,
    hash,
  }
}

async function putToSignedUrl(
  target: SignedUploadTarget,
  file: Blob,
  progressKey: string,
  options: TalizenRequestOptions,
): Promise<void> {
  if (target.hashExist || target.uploadUrl == null) return

  if (typeof XMLHttpRequest === "function") {
    await uploadWithXhr(target, file, progressKey, options)
    return
  }

  const resolved = resolveTalizenConfig(options)
  const headers = new Headers()
  const request = {
    method: normalizeRequestMethod("PUT"),
    url: stripUrlQuery(target.uploadUrl),
  }

  if (file.type) headers.set("content-type", file.type)
  headers.set("cache-control", IMMUTABLE_CACHE_CONTROL)

  const response = await resolved.fetch(target.uploadUrl, {
    method: "PUT",
    headers,
    body: file,
    signal: resolved.signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(formatUploadError(request, `${response.status} ${response.statusText} ${text}`))
  }
}

function uploadWithXhr(
  target: SignedUploadTarget,
  file: Blob,
  progressKey: string,
  options: TalizenRequestOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const signal = options.signal
    const request = {
      method: normalizeRequestMethod("PUT"),
      url: stripUrlQuery(target.uploadUrl ?? ""),
    }

    xhr.open("PUT", target.uploadUrl ?? "")
    if (file.type) xhr.setRequestHeader("content-type", file.type)
    xhr.setRequestHeader("cache-control", IMMUTABLE_CACHE_CONTROL)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        notifyUploadProcess(options, progressKey, event.loaded / event.total)
      }
    }

    xhr.onload = () => {
      cleanup()
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new Error(formatUploadError(request, `${xhr.status} ${xhr.statusText} ${xhr.responseText}`)))
    }

    xhr.onerror = () => {
      cleanup()
      reject(new Error(formatUploadError(request, "network error")))
    }

    xhr.onabort = () => {
      cleanup()
      reject(createAbortError())
    }

    const abort = () => xhr.abort()
    const cleanup = () => signal?.removeEventListener("abort", abort)

    signal?.addEventListener("abort", abort, { once: true })
    xhr.send(file)
  })
}

function formatUploadError(request: { method: string; url: string }, detail: string): string {
  return `Talizen file upload failed: ${request.method} ${request.url} ${detail}`.replace(/\s+/g, " ").trim()
}

async function sha256(file: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle == null) {
    throw new Error("Talizen file upload requires Web Crypto support.")
  }

  const digest = await subtle.digest("SHA-256", await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("")
}

function notifyUploadProcess(
  options: Pick<TalizenRequestOptions, "onFileUploadProcess"> | undefined,
  key: string,
  process: number,
): void {
  options?.onFileUploadProcess?.(key, Math.min(1, Math.max(0, process)))
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined
}

function createAbortError(): Error {
  if (typeof DOMException === "function") {
    return new DOMException("The operation was aborted.", "AbortError")
  }
  const error = new Error("The operation was aborted.")
  error.name = "AbortError"
  return error
}
