import { requestJson, resolveTalizenConfig, type TalizenRequestOptions } from "./core.js"

export interface FormRecord {
  readonly __formKey?: string
  [key: string]: unknown
}

interface PreuploadResponse {
  hash_exist?: boolean
  presigned_url?: string
  file_path?: string
  file_url?: string
  id?: number
}

interface NormalizedPreuploadResponse {
  hashExist: boolean
  uploadUrl?: string
  fileUrl: string
}

export async function submitForm<T extends FormRecord>(
  keyOrToken: T["__formKey"] | string,
  payload: T,
  options?: TalizenRequestOptions,
): Promise<"ok"> {
  const formKey = getFormKey(keyOrToken)
  const data = await replaceFiles(formKey, payload, "", options)

  return requestJson<"ok">(
    `/form/${formKey}/submit`,
    {
      method: "POST",
      body: JSON.stringify({
        data,
      }),
    },
    options,
  )
}

function getFormKey(keyOrToken: string | undefined): string {
  if (keyOrToken == null || keyOrToken === "") {
    throw new Error("Talizen form key is required.")
  }

  return keyOrToken
}

async function replaceFiles(
  formKey: string,
  value: unknown,
  path: string,
  options?: TalizenRequestOptions,
): Promise<unknown> {
  if (isFile(value)) {
    return uploadFile(formKey, path || value.name, value, options)
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item, index) => replaceFiles(formKey, item, joinPath(path, String(index)), options)))
  }

  if (isPlainObject(value)) {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, item]) => [key, await replaceFiles(formKey, item, joinPath(path, key), options)] as const),
    )

    return Object.fromEntries(entries)
  }

  return value
}

async function uploadFile(
  formKey: string,
  fieldKey: string,
  file: File,
  options?: TalizenRequestOptions,
): Promise<string> {
  const resolved = resolveTalizenConfig(options)
  notifyUploadProcess(resolved, fieldKey, 0)

  const preupload = await requestJson<PreuploadResponse>(
    `/form/${formKey}/file/preupload`,
    {
      method: "POST",
      body: JSON.stringify({
        file_name: file.name,
        hash: await sha256(file),
        mimetype: file.type || "application/octet-stream",
        file_size: file.size,
      }),
    },
    options,
  )

  const target = normalizePreuploadResponse(preupload)
  await uploadToSignedUrl(target, file, fieldKey, resolved)
  notifyUploadProcess(resolved, fieldKey, 1)

  return target.fileUrl
}

function normalizePreuploadResponse(response: PreuploadResponse): NormalizedPreuploadResponse {
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
  }
}

async function uploadToSignedUrl(
  target: NormalizedPreuploadResponse,
  file: File,
  fieldKey: string,
  options: TalizenRequestOptions,
): Promise<void> {
  if (target.hashExist || target.uploadUrl == null) {
    return
  }

  if (typeof XMLHttpRequest === "function") {
    await uploadWithXhr(target, file, fieldKey, options)
    return
  }

  const resolved = resolveTalizenConfig(options)
  const headers = new Headers()
  const body: BodyInit = file

  if (file.type) {
    headers.set("content-type", file.type)
  }

  const response = await resolved.fetch(target.uploadUrl, {
    method: "PUT",
    headers,
    body,
    signal: resolved.signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Talizen file upload failed: ${response.status} ${response.statusText} ${text}`.trim())
  }
}

function uploadWithXhr(
  target: NormalizedPreuploadResponse,
  file: File,
  fieldKey: string,
  options: TalizenRequestOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const signal = options.signal
    const body: XMLHttpRequestBodyInit = file

    xhr.open("PUT", target.uploadUrl ?? "")

    if (file.type) {
      xhr.setRequestHeader("content-type", file.type)
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        notifyUploadProcess(options, fieldKey, event.loaded / event.total)
      }
    }

    xhr.onload = () => {
      cleanup()

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }

      reject(new Error(`Talizen file upload failed: ${xhr.status} ${xhr.statusText} ${xhr.responseText}`.trim()))
    }

    xhr.onerror = () => {
      cleanup()
      reject(new Error("Talizen file upload failed: network error"))
    }

    xhr.onabort = () => {
      cleanup()
      reject(createAbortError())
    }

    const abort = () => xhr.abort()
    const cleanup = () => signal?.removeEventListener("abort", abort)

    signal?.addEventListener("abort", abort, { once: true })
    xhr.send(body)
  })
}

async function sha256(file: File): Promise<string> {
  const subtle = globalThis.crypto?.subtle

  if (subtle == null) {
    throw new Error("Talizen file upload requires Web Crypto support.")
  }

  const digest = await subtle.digest("SHA-256", await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")
}

function notifyUploadProcess(options: Pick<TalizenRequestOptions, "onFileUploadProcess"> | undefined, key: string, process: number): void {
  options?.onFileUploadProcess?.(key, clampProcess(process))
}

function clampProcess(process: number): number {
  return Math.min(1, Math.max(0, process))
}

function joinPath(parent: string, key: string): string {
  return parent === "" ? key : `${parent}.${key}`
}

function isFile(value: unknown): value is File {
  return typeof File === "function" && value instanceof File
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]"
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
