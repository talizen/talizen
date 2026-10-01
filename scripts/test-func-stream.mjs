// Behavioral tests for invoke(..., { onEvent }) (streaming func runs).
// Run: npm run build && node scripts/test-func-stream.mjs

import { invoke, TalizenFuncError } from "../dist/func.js"

let failures = 0
const assert = (condition, label) => {
  console.log(condition ? "  ✓" : "  ✗ FAIL", label)
  if (!condition) failures++
}

// Splits the body into small chunks so events cross chunk boundaries.
function sseResponse(text, status = 200) {
  const bytes = new TextEncoder().encode(text)
  const body = new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7))
      controller.close()
    },
  })
  return new Response(body, { status, headers: { "content-type": "text/event-stream" } })
}

const base = { baseUrl: "https://site.test" }

console.log("case 1: progress events, then the result")
{
  let seenRequest
  const fetch = async (url, init) => {
    seenRequest = { url: String(url), accept: new Headers(init.headers).get("accept") }
    return sseResponse(
      'event: progress\ndata: {"done":1,"total":2,"message":"上传图片 1/2"}\n\n' +
        'event: progress\r\ndata: {"done":2,"total":2}\r\n\r\n' +
        'event: done\ndata: {"result":{"url":"https://x"},"logs":[]}\n\n',
    )
  }
  const events = []
  const result = await invoke("local/xhs.publish", { a: 1 }, { ...base, fetch, timeoutMS: 290000, onEvent: (e) => events.push(e) })
  assert(seenRequest.url === "https://site.test/func/local/xhs.publish?timeout_ms=290000", "same URL as a normal call")
  assert(seenRequest.accept === "text/event-stream", "asks for a stream")
  assert(events.length === 2 && events[0].event === "progress" && events[0].data.message === "上传图片 1/2", "progress delivered in order")
  assert(result && result.url === "https://x", "resolves to the final result")
}

console.log("case 2: error event rejects with the error code")
{
  const fetch = async () => sseResponse('event: progress\ndata: {"done":1}\n\nevent: error\ndata: {"error":"shuttle_offline: no computer"}\n\n')
  try {
    await invoke("local/xhs.publish", {}, { ...base, fetch, onEvent: () => {} })
    assert(false, "should reject")
  } catch (e) {
    assert(e instanceof TalizenFuncError && e.message.startsWith("shuttle_offline"), "TalizenFuncError with the code")
  }
}

console.log("case 3: blocked before running (401 stream)")
{
  const fetch = async () => sseResponse('event: error\ndata: {"error":"member_login_required: sign in"}\n\n', 401)
  try {
    await invoke("x", {}, { ...base, fetch, onEvent: () => {} })
    assert(false, "should reject")
  } catch (e) {
    assert(e.message.startsWith("member_login_required") && e.status === 401, "keeps code and status")
  }
}

console.log("case 4: plain JSON error before the stream started")
{
  const fetch = async () => new Response(JSON.stringify({ code: 402, msg: "quota", error: "quota exceeded" }), { status: 402, headers: { "content-type": "application/json" } })
  try {
    await invoke("x", {}, { ...base, fetch, onEvent: () => {} })
    assert(false, "should reject")
  } catch (e) {
    assert(e instanceof TalizenFuncError && e.status === 402 && e.message === "quota exceeded", "same error as a normal call")
  }
}

console.log("case 5: a throwing onEvent does not lose the result")
{
  const fetch = async () => sseResponse('event: progress\ndata: {}\n\nevent: done\ndata: {"result":42}\n\n')
  const result = await invoke("x", {}, { ...base, fetch, onEvent: () => { throw new Error("boom") } })
  assert(result === 42, "result still arrives")
}

console.log("case 6: stream cut off")
{
  const fetch = async () => sseResponse('event: progress\ndata: {}\n\n')
  try {
    await invoke("x", {}, { ...base, fetch, onEvent: () => {} })
    assert(false, "should reject")
  } catch (e) {
    assert(e instanceof TalizenFuncError, "rejects instead of hanging")
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log("\nall passed")
