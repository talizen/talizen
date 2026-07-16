import { requestJson, resolveTalizenConfig, type TalizenRequestOptions } from "./core.js"

export type TrackProps = Record<string, unknown>

export interface TrackOptions extends TalizenRequestOptions {}

/**
 * Report a custom analytics event ("埋点") for the current site.
 *
 * Fire-and-forget and best-effort: it never throws on network/HTTP errors, so
 * analytics can't break the page. The site is resolved server-side from the
 * request host — you do not pass a site id. The current page URL is attached
 * automatically. Visitor identity (for unique counts) is handled by a
 * first-party cookie on the server.
 *
 * Delivery prefers `navigator.sendBeacon`, so the event is reliably recorded
 * even when the click navigates away (e.g. a link's onClick). Falls back to
 * `fetch` with `keepalive` when sendBeacon is unavailable.
 *
 * Call it from client code only (event handlers, effects); it is a no-op during
 * SSR since there is no `window`.
 *
 * @example
 * import { track } from "talizen/analytics"
 * track("click_buy", { plan: "pro" })
 */
export async function track(
  name: string,
  props?: TrackProps,
  options?: TrackOptions,
): Promise<void> {
  const eventName = (name ?? "").trim()
  if (!eventName) return
  if (typeof window === "undefined") return

  const body = JSON.stringify({
    name: eventName,
    url: window.location?.href,
    props: props ?? {},
  })

  // Prefer sendBeacon: the browser queues it and delivers it even as the page
  // unloads, so events survive a click that navigates away.
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const baseUrl = resolveTalizenConfig(options).baseUrl.replace(/\/+$/, "")
      const ok = navigator.sendBeacon(`${baseUrl}/site_event`, new Blob([body], { type: "application/json" }))
      if (ok) return
    }
  }
  catch {
    // fall through to fetch
  }

  try {
    await requestJson<unknown>(
      "/site_event",
      { method: "POST", keepalive: true, body },
      options,
    )
  }
  catch {
    // Analytics is best-effort; swallow errors so tracking never breaks the UI.
  }
}
