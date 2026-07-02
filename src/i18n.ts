import * as React from "react"

/**
 * 当前语言运行时信息。由 Talizen 渲染引擎注入到 `globalThis.__TALIZEN_I18N__`
 * （SSR 与浏览器端注入同一份，避免 hydration 不一致）。站点未开启多语言时为空。
 */
export interface LocaleRuntime {
  /** 当前生效语言；站点未配置多语言时为 ""。 */
  locale: string
  /** 站点配置的全部语言。 */
  locales: string[]
  /** 默认语言（其 URL 无前缀）。 */
  defaultLocale: string
}

declare global {
  // eslint-disable-next-line no-var
  var __TALIZEN_I18N__: Partial<LocaleRuntime> | undefined
}

function readLocaleRuntime(): LocaleRuntime {
  const d = (typeof globalThis !== "undefined" ? globalThis.__TALIZEN_I18N__ : undefined) ?? {}
  const locales = Array.isArray(d.locales) ? d.locales.filter((l): l is string => typeof l === "string") : []
  return {
    locale: typeof d.locale === "string" ? d.locale : "",
    locales,
    defaultLocale: typeof d.defaultLocale === "string" ? d.defaultLocale : (locales[0] ?? ""),
  }
}

/**
 * 读取当前语言运行时信息（当前语言 / 全部语言 / 默认语言）。SSR 与客户端返回一致。
 * 站点未开启多语言时 `locale === ""`。
 *
 * ```tsx
 * const { locale, locales, defaultLocale } = useLocale()
 * ```
 */
export function useLocale(): LocaleRuntime {
  return readLocaleRuntime()
}

/**
 * 给站内路径加语言前缀（默认语言不加前缀）。不传 `locale` 时使用当前语言。
 * 站外链接（协议 / 协议相对 URL）与页内锚点（`#...`）原样返回。
 *
 * ```ts
 * localizedPath("/blog")        // zh 页面 → "/zh/blog"；默认语言 → "/blog"
 * localizedPath("/about", "ja") // → "/ja/about"
 * ```
 */
export function localizedPath(path: string, locale?: string): string {
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(path) || path.startsWith("#")) return path
  const rt = readLocaleRuntime()
  const target = locale ?? rt.locale
  if (!target || target === rt.defaultLocale) return path
  const p = path.startsWith("/") ? path : `/${path}`
  return p === "/" ? `/${target}` : `/${target}${p}`
}

/** 记住用户显式语言选择的 Cookie 名（检测优先级：Cookie > Accept-Language > 默认）。 */
export const LOCALE_COOKIE = "CREGHT_LOCALE"

export type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  /**
   * 指定则表示「切换到该语言」：`href` 用该语言前缀，并在点击时写 `CREGHT_LOCALE`
   * Cookie 记住选择。不传则沿用当前语言（普通站内链接）。
   */
  locale?: string
}

/**
 * 语言感知的站内链接，替代裸 `<a>`：自动给 `href` 补当前语言前缀（默认语言不补）。
 * 传 `locale` 表示语言切换（用该语言前缀，且点击时写 `CREGHT_LOCALE` 记住选择）。
 *
 * ```tsx
 * <Link href="/blog">Blog</Link>            // 跟随当前语言：zh 页面 → /zh/blog
 * <Link href="/" locale="ja">日本語</Link>  // 切到日文并记住
 * ```
 */
export function Link(props: LinkProps): React.ReactElement {
  const { href, locale, onClick, ...rest } = props
  const finalHref = localizedPath(href, locale)
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (locale && typeof document !== "undefined") {
      document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=31536000; samesite=lax`
    }
    onClick?.(event)
  }
  return React.createElement("a", { ...rest, href: finalHref, onClick: handleClick })
}
