import { requestJson, type TalizenRequestOptions } from "./core.js"
import { uploadWithSignedUrl } from "./signed-upload.js"

export interface UploadAssetOptions extends TalizenRequestOptions {
  /** Filename used by the CDN. Required for unnamed Blob values. */
  fileName?: string
}

export interface UploadedAsset {
  fileUrl: string
  /** Compatibility alias of fileUrl. */
  url: string
  fileName: string
  mimeType: string
  size: number
  hash: string
}

/** Upload a browser File/Blob directly to the site's CDN using a signed PUT URL. */
export async function uploadAsset(file: File | Blob, options?: UploadAssetOptions): Promise<UploadedAsset> {
  if (!isBlob(file)) {
    throw new Error("Talizen uploadAsset requires a File or Blob.")
  }
  if (file.size <= 0) {
    throw new Error("Talizen uploadAsset cannot upload an empty file.")
  }

  const fileName = getUploadFileName(file, options?.fileName)
  const target = await uploadWithSignedUrl(
    "/asset/file/preupload",
    file,
    fileName,
    fileName,
    options,
  )

  if (!target.hashExist) {
    if (target.id == null) {
      throw new Error("Talizen preupload response is missing file id.")
    }
    await requestJson<"ok">(
      "/asset/file/ack",
      {
        method: "POST",
        body: JSON.stringify({ id: target.id }),
      },
      options,
    )
  }

  return {
    fileUrl: target.fileUrl,
    url: target.fileUrl,
    fileName,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    hash: target.hash,
  }
}

function getUploadFileName(file: File | Blob, override?: string): string {
  const fileName = override?.trim() || (isFile(file) ? file.name.trim() : "")
  if (fileName === "") {
    throw new Error("Talizen uploadAsset requires options.fileName for unnamed Blob values.")
  }
  return fileName
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob === "function" && value instanceof Blob
}

function isFile(value: Blob): value is File {
  return typeof File === "function" && value instanceof File
}
