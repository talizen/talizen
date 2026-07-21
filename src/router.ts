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
 * 语言切换用的 href：当前页「去前缀路径 + 保留 query/hash」，配合 i18n 的 `<Link>` 使用——
 * Link 会补上目标语言前缀并写入 `CREGHT_LOCALE` cookie 记住选择：
 *
 * ```tsx
 * import { Link } from "talizen"
 * import { getLocalePath } from "talizen"
 *
 * <Link href={getLocalePath()} locale="en">English</Link>
 * <Link href={getLocalePath()} locale="zh-CN">中文</Link>
 * ```
 *
 * query / hash 仅在客户端可得；SSR 期只返回路径部分。
 */
export function getLocalePath(): string {
  const path = readPathname()
  if (typeof window !== "undefined" && window.location) {
    return `${path}${window.location.search}${window.location.hash}`
  }
  return path
}
