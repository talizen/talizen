import { requestJson, type TalizenRequestOptions } from "./core.js"

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

  try {
    await requestJson<unknown>(
      "/site_event",
      {
        method: "POST",
        keepalive: true,
        body: JSON.stringify({
          name: eventName,
          url: window.location?.href,
          props: props ?? {},
        }),
      },
      options,
    )
  }
  catch {
    // Analytics is best-effort; swallow errors so tracking never breaks the UI.
  }
}
