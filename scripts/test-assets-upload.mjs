// Behavioral tests for browser CDN signed uploads.
// Run: npm run build && node scripts/test-assets-upload.mjs

import { uploadAsset } from "../dist/assets.js"

let failures = 0
const assert = (condition, label) => {
  console.log(condition ? "  ✓" : "  ✗ FAIL", label)
  if (!condition) failures++
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

console.log("case 1: new file → preupload, signed PUT, ack")
{
  const requests = []
  const progress = []
  const fetchStub = async (input, init = {}) => {
    const url = String(input)
    requests.push({ url, init })

    if (url === "https://site.test/api/asset/file/preupload") {
      return jsonResponse({
        hash_exist: false,
        presigned_url: "https://upload.test/object?signature=secret",
        file_path: "site_render/1/demo.png",
        file_url: "https://cdn.test/site_render/1/demo.png",
        id: 42,
      })
    }
    if (url === "https://upload.test/object?signature=secret") {
      return new Response("", { status: 200 })
    }
    if (url === "https://site.test/api/asset/file/ack") {
      return jsonResponse("ok")
    }
    throw new Error(`unexpected request: ${url}`)
  }

  const file = new Blob(["hello"], { type: "image/png" })
  const asset = await uploadAsset(file, {
    baseUrl: "https://site.test/api",
    fetch: fetchStub,
    fileName: "demo.png",
    onFileUploadProcess: (key, value) => progress.push([key, value]),
  })

  assert(requests.length === 3, "made preupload, PUT, and ack requests")
  assert(requests[0].init.method === "POST", "preupload uses POST")
  assert(requests[1].init.method === "PUT", "CDN upload uses PUT")
  assert(requests[1].init.headers.get("content-type") === "image/png", "PUT preserves MIME type")
  assert(requests[1].init.headers.get("cache-control") === "public, max-age=31536000, immutable", "PUT sends signed cache policy")
  assert(JSON.parse(requests[2].init.body).id === 42, "ack uses preupload file id")
  assert(asset.fileUrl === "https://cdn.test/site_render/1/demo.png", "returns CDN file URL")
  assert(asset.filePath === "site_render/1/demo.png", "returns CDN file path")
  assert(asset.hash === "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", "returns SHA-256 hash")
  assert(progress.at(0)?.[1] === 0 && progress.at(-1)?.[1] === 1, "reports upload progress boundaries")
}

console.log("case 2: existing hash → skip PUT and ack")
{
  const requests = []
  const file = new Blob(["hello"], { type: "image/png" })
  const asset = await uploadAsset(file, {
    baseUrl: "https://site.test/api",
    fileName: "same.png",
    fetch: async (input, init = {}) => {
      requests.push({ url: String(input), init })
      return jsonResponse({
        hash_exist: true,
        file_path: "site_render/1/existing.png",
        file_url: "https://cdn.test/site_render/1/existing.png",
      })
    },
  })

  assert(requests.length === 1, "existing hash makes only the preupload request")
  assert(asset.fileUrl.endsWith("/existing.png"), "returns the existing CDN URL")
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
