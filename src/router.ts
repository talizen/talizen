import * as React from "react"
import { getTalizenConfig, subscribeTalizenConfig } from "./core.js"

// readLocales 读取站点配置的语言列表（仅用于回退时剥路径前缀）。直接读 TalizenConfig，不依赖 i18n 模块。
function readLocales(): string[] {
  const config = getTalizenConfig()
  const globalConfig = typeof globalThis !== "undefined" ? globalThis.TalizenConfig : undefined
  const locales = (config.i18n ?? globalConfig?.i18n)?.locales
  return Array.isArray(locales) ? locales.filter((l): l is string => typeof l === "string") : []
}

// stripLocalePrefix 去掉路径开头的已知语言段（默认语言本就无前缀，天然命中 else）。
function stripLocalePrefix(pathname: string, locales: string[]): string {
  const first = pathname.split("/")[1] ?? ""
  if (first && locales.some((l) => l.toLowerCase() === first.toLowerCase())) {
    return pathname.slice(first.length + 1) || "/"
  }
  return pathname || "/"
}

// readPathname 返回当前页面「去掉语言前缀」的路径。优先用渲染引擎注入的 TalizenConfig.pathname
// （SSR 与客户端一致，避免水合不一致）；缺失时在客户端回退到按 locales 剥 window.location.pathname。
function readPathname(): string {
  const config = getTalizenConfig()
  const globalConfig = typeof globalThis !== "undefined" ? globalThis.TalizenConfig : undefined
  const injected = config.pathname ?? globalConfig?.pathname
  if (typeof injected === "string" && injected !== "") return injected
  if (typeof window !== "undefined" && window.location) {
    return stripLocalePrefix(window.location.pathname, readLocales())
  }
  return "/"
}

/**
 * 当前页面路径（已去掉语言前缀，SSR 与客户端返回一致，不含 query / hash）。对标 next/navigation 的 usePathname。
 * 组件渲染里用 usePathname()；服务端取数用 getPathname()。
 *
 * ```tsx
 * const pathname = usePathname()   // 访问 /en/blog 时返回 "/blog"
 * ```
 */
export function usePathname(): string {
  return React.useSyncExternalStore(subscribeTalizenConfig, readPathname, readPathname)
}

/** usePathname 的非 hook 版本，用于 getServerSideProps / 事件回调等非渲染场景。 */
export function getPathname(): string {
  return readPathname()
}

/**
 * 语言切换用的 href：当前页去掉语言前缀的路径，配合 i18n 的 `<Link locale>` 使用——
 * Link 会补上目标语言前缀、保留当前页的 query / hash，并在点击时写入 `CREGHT_LOCALE` cookie 记住选择：
 *
 * ```tsx
 * import { Link } from "talizen"
 * import { getLocalePath } from "talizen"
 *
 * <Link href={getLocalePath()} locale="en">English</Link>
 * <Link href={getLocalePath()} locale="zh-CN">中文</Link>
 * ```
 *
 * 只返回路径，SSR 与客户端一致。以前在客户端会拼上 location.search / hash，而 SSR 拿不到 query，
 * 地址一带参数（?utm_source=…）水合就对不上（hydration mismatch）；保留 query / hash 改由 `<Link locale>` 在水合后补上。
 */
export function getLocalePath(): string {
  return readPathname()
}
