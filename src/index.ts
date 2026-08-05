export * from "./core.js"
export * from "./auth.js"
export * from "./cms.js"
export * from "./captcha-ui.js"
export * from "./form.js"
export * from "./assets.js"
export * from "./i18n.js"
export * from "./router.js"
export * from "./server-runtime.js"
export * from "./analytics.js"

type OneOrMany<T> = T | Array<T>

export interface MetadataTitle {
  default?: string
  template?: string
  absolute?: string
}

export interface MetadataAuthor {
  name: string
  url?: string
}

export interface MetadataIconLink {
  url: string
  media?: string
  sizes?: string
  type?: string
}

export interface MetadataOtherIcon {
  rel: string
  url: string
}

export interface MetadataIcons {
  shortcut?: OneOrMany<string | MetadataIconLink>
  icon?: OneOrMany<string | MetadataIconLink>
  apple?: OneOrMany<string | MetadataIconLink>
  other?: MetadataOtherIcon | Array<MetadataOtherIcon>
}

export interface OpenGraphImage {
  url: string
  width?: number
  height?: number
  alt?: string
}

export interface OpenGraphVideo {
  url: string
  width?: number
  height?: number
}

export interface OpenGraphAudio {
  url: string
}

export interface MetadataFormatDetection {
  email?: boolean
  address?: boolean
  telephone?: boolean
}

/**
 * Robots directives, aligned with Next.js `metadata.robots`.
 *
 * Every field is optional and only emitted when explicitly set. Omitting all of
 * them renders no `<meta name="robots">` at all, leaving the decision to the
 * search engine's default rather than having the platform declare `index, follow`
 * on your behalf.
 *
 * `noarchive` / `nosnippet` / `noimageindex` / `nocache` only carry meaning when
 * `true`; setting them to `false` emits nothing, since those directives have no
 * inverse form.
 */
export interface MetadataRobots {
  index?: boolean
  follow?: boolean
  noarchive?: boolean
  nosnippet?: boolean
  noimageindex?: boolean
  nocache?: boolean
  /** Emitted as a separate `<meta name="googlebot">` tag; not nested further. */
  googleBot?: MetadataRobots
}

export interface OpenGraphMetadata {
  title?: string
  description?: string
  url?: string
  siteName?: string
  images?: Array<OpenGraphImage>
  videos?: Array<OpenGraphVideo>
  audio?: Array<OpenGraphAudio>
  locale?: string
  type?: string
}

export interface Metadata {
  title?: string | MetadataTitle | null
  description?: string | null
  generator?: string | null
  applicationName?: string | null
  referrer?: string | null
  keywords?: string | Array<string> | null
  authors?: Array<MetadataAuthor> | null
  creator?: string | null
  publisher?: string | null
  formatDetection?: MetadataFormatDetection | null
  openGraph?: OpenGraphMetadata | null
  icons?: MetadataIcons | null
  /** String form (`'noindex, nofollow'`) is emitted verbatim as the meta content. */
  robots?: string | MetadataRobots | null
}

/**
 * A single site-level redirect rule, aligned with Next.js `redirects()` semantics.
 *
 * Declare rules in the `redirects` array of `talizen.config.ts`. A matching
 * request is redirected before the page renders, so redirects take precedence
 * over pages and `/public` files.
 */
export interface Redirect {
  /**
   * Source path to match. Supports exact matches (`/old-page`) and a trailing
   * wildcard segment (`/blog/*`).
   */
  source: string
  /**
   * Redirect target. May be an internal path (`/new-page`), a wildcard
   * backreference (`/posts/*`), an absolute URL (`https://example.com/x`), or a
   * protocol-relative URL (`//example.com/x`). Internal paths keep the original
   * query string.
   */
  destination: string
  /**
   * `true` issues a 308 permanent redirect (best for SEO); `false` issues a 307
   * temporary redirect.
   */
  permanent: boolean
}

/**
 * Request context passed to the per-request fields of `talizen.config.ts`.
 *
 * Deliberately narrow: no cookies (reading them would make the page vary by
 * cookie) and no CMS access (site-level config must not fetch data, so it never
 * participates in cache invalidation). It answers only "which language, which
 * host, which path is this request".
 */
export interface TalizenConfigContext {
  /** Current locale, e.g. `"zh-CN"`. Empty string when the site is single-language. */
  locale: string
  /** All locales declared in `i18n.locales`. */
  locales?: Array<string>
  /** Content baseline locale from `i18n.defaultLocale`. */
  defaultLocale?: string
  /** The unprefixed default locale of the host serving this request. */
  routingDefaultLocale?: string
  /** Request host, e.g. `"example.cn"`. Useful for per-domain branching. */
  host: string
  /** Request path with the locale prefix removed. */
  path: string
}

/**
 * A config field that may be a plain value or a function evaluated per request.
 *
 * Only fields that affect the rendered HTML accept a function. Build and routing
 * inputs (`importMap`, `i18n`, `redirects`) must be static values — they are
 * needed before a request exists, and writing them as a function is a load-time
 * error.
 */
export type PerRequest<T> =
  | T
  | ((ctx: TalizenConfigContext) => T | Promise<T>)

/** Attributes for `<html>` / `<body>`. `className` is accepted as an alias of `class`. */
export type TagAttributes = Record<string, string | number>

/** Site-level initial viewport, aligned with the Next.js App Router `viewport` object. */
export interface Viewport {
  width?: string | number | null
  height?: string | number | null
  initialScale?: number | null
  minimumScale?: number | null
  maximumScale?: number | null
  userScalable?: boolean | null
  interactiveWidget?: string | null
  themeColor?: string | null
  colorScheme?: string | null
}

/** Per-domain locale mapping, aligned with Next.js `i18n.domains`. */
export interface I18nDomain {
  domain: string
  defaultLocale: string
  /** Extra locales this domain serves; `defaultLocale` is always served. */
  locales?: Array<string>
  /** Use http instead of https when redirecting across domains (local testing). */
  http?: boolean
}

/** Multilingual routing config, aligned with Next.js `i18n`. */
export interface I18nConfig {
  /** Content baseline locale; also the unprefixed locale by default. */
  defaultLocale: string
  locales: Array<string>
  domains?: Array<I18nDomain>
  /** Redirect prefix-less paths by cookie / Accept-Language. Defaults `true`. */
  localeDetection?: boolean
}

/**
 * Raw HTML snippets injected into the document.
 *
 * @deprecated Use the `head` / `bodyEnd` fields instead — they can be written as
 * `(ctx) => string`, so they can branch by locale or host. `customCode` keeps
 * working and is injected before `head` / `bodyEnd`.
 */
export interface CustomCode {
  head?: string
  body?: string
}

/**
 * The default export of `talizen.config.ts` — the single entry point for
 * site-level configuration.
 *
 * Two groups of fields, split by whether the platform needs them **before** a
 * request exists:
 *
 * - **Static only** — `importMap`, `i18n`, `redirects`. Bundling and route
 *   building happen ahead of any request, so these must be plain values.
 * - **Per request allowed** — `metadata`, `html`, `body`, `head`, `bodyEnd`,
 *   `viewport`. These only shape the rendered HTML, so each may be written as
 *   `(ctx) => value` to branch on locale or host.
 *
 * Things that have their own URL are files, not config: `/robots.ts`,
 * `/sitemap.ts`, `/llms.ts` each produce one endpoint.
 *
 * ```ts
 * import type { TalizenConfig } from "talizen"
 *
 * export default {
 *   i18n: { defaultLocale: "zh-CN", locales: ["zh-CN", "en"] },
 *   metadata: (ctx) => ({
 *     title: { template: "%s | Acme", default: "Acme" },
 *     description: ctx.locale === "en" ? "English" : "中文",
 *   }),
 *   html: { className: "dark" },
 *   head: (ctx) =>
 *     ctx.host.endsWith(".cn")
 *       ? `<script async src="https://hm.baidu.com/hm.js?x"></script>`
 *       : `<script async src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>`,
 * } satisfies TalizenConfig
 * ```
 */
export interface TalizenConfig {
  /** Extra browser dependencies. Static: bundling happens before a request. */
  importMap?: { imports: Record<string, string> }
  /** Multilingual routing. Static: the router is built before a request. */
  i18n?: I18nConfig
  /** Site-level redirects. Static: matched before the page renders. */
  redirects?: Array<Redirect>

  /** Site-level metadata defaults; page metadata layers on top. */
  metadata?: PerRequest<Metadata>
  /** `<html>` attributes. Omit `lang` to let the platform fill the current locale. */
  html?: PerRequest<TagAttributes>
  /** `<body>` attributes. */
  body?: PerRequest<TagAttributes>
  /** HTML injected before `</head>`. */
  head?: PerRequest<string>
  /** HTML injected before `</body>`. */
  bodyEnd?: PerRequest<string>
  /** Site-level initial viewport. */
  viewport?: PerRequest<Viewport>

  /** @deprecated Use `head` / `bodyEnd`. */
  customCode?: CustomCode
}

export type SitemapChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never"

/** Language versions of one URL, emitted as `<xhtml:link rel="alternate">`. */
export interface SitemapAlternates {
  /**
   * hreflang → href. Entries with an empty key or value are skipped, and output
   * is sorted by hreflang so the XML stays stable.
   */
  languages: Record<string, string>
}

/** One `<url>` entry returned by `/sitemap.ts`. */
export interface SitemapEntry {
  /**
   * Absolute URL, or an in-site path such as `/blog/hello` which is resolved
   * against the requesting host. Required; an entry without it is an error.
   */
  url: string
  /** A `Date` (emitted as `YYYY-MM-DD`) or a date string used as-is. */
  lastModified?: string | Date
  /** Anything outside the listed values is dropped. */
  changeFrequency?: SitemapChangeFrequency
  /** `0` to `1`. Values outside that range are dropped rather than clamped. */
  priority?: number
  alternates?: SitemapAlternates
}

/**
 * Signature of the default export in root-level `/sitemap.ts`.
 *
 * The platform always serves `/sitemap.xml`; a `/public/sitemap.xml` is never
 * reached. Providing this file **replaces** the automatic page scan entirely
 * rather than adding to it, so it must list every URL you want indexed —
 * including static routes such as the home page.
 *
 * `/llms.txt` reuses this same enumeration, so `/sitemap.ts` reshapes it too.
 */
export type SitemapFile = () =>
  | Array<SitemapEntry>
  | Promise<Array<SitemapEntry>>

/**
 * One `robots.txt` rule group, aligned with Next.js `MetadataRoute.Robots`.
 */
export interface RobotsRule {
  /** Defaults to `*` when omitted. */
  userAgent?: string | Array<string>
  allow?: string | Array<string>
  disallow?: string | Array<string>
  crawlDelay?: number
}

/**
 * Return type of the default export in root-level `/robots.ts`.
 *
 * The platform always serves `/robots.txt` itself; a `/public/robots.txt` is
 * never reached. Without `/robots.ts` the output allows everything.
 *
 * Preview domains always return `Disallow: /` and skip `/robots.ts` entirely,
 * so a preview URL is never a valid way to check rules.
 */
export interface Robots {
  rules: RobotsRule | Array<RobotsRule>
  /** Defaults to this site's `/sitemap.xml`. */
  sitemap?: string | Array<string>
  host?: string
}

/** One page in the platform's enumeration, as handed to `/llms.ts`. */
export interface LLMsPage {
  /** In-site path such as `/docs/intro`; external links keep their full URL. */
  path: string
  /** Absolute URL of this page's Markdown mirror. */
  url: string
  /** ISO 8601, same source as the sitemap's `lastmod`. */
  lastModified?: string
}

/** Argument passed to the default export of `/llms.ts`. */
export interface LLMsContext {
  /** Site root including protocol, no trailing slash. */
  origin: string
  /** Same page enumeration `/sitemap.xml` uses, so the two stay consistent. */
  pages: ReadonlyArray<LLMsPage>
  /** Site metadata from `talizen.config.ts`. */
  metadata: { title: string; description: string }
}

/** An explicit entry in an `LLMsSection`. `name` falls back to `url`. */
export interface LLMsLink {
  name?: string
  url: string
}

/**
 * One section of `llms.txt`. Either declare `pages` patterns and let the
 * platform match them against its enumeration, or give `links` explicitly and
 * skip matching. Both forms may appear in the same `sections` array — hand-pick
 * a few links, let the platform fill the rest. `links` wins if both are set.
 */
export interface LLMsSection {
  name: string
  /**
   * Patterns: an exact path, or a trailing `/*` matching the prefix itself and
   * everything under it. A leading `/` may be omitted. Within a section, pages
   * sort by the index of the pattern they matched, then by URL.
   */
  pages?: Array<string>
  links?: Array<LLMsLink>
}

/**
 * Declarative return value of the default export in root-level `/llms.ts`.
 *
 * There is deliberately no `title` or `description` field: `llms.txt` takes its
 * heading and summary from `metadata.title` / `metadata.description`, so
 * improving site metadata updates the file automatically. Return a string from
 * `/llms.ts` instead when you need to control those too.
 */
export interface LLMsSpec {
  /** Free Markdown placed after the summary, before the first section. */
  details?: string
  /**
   * Emitted in declared order. A page joins the first section that claims it;
   * pages no section claimed go to a fallback `Pages` section, inserted before
   * a section named `Optional` if there is one, otherwise last.
   */
  sections?: Array<LLMsSection>
  /** Patterns dropped before sectioning, same syntax as `LLMsSection.pages`. */
  exclude?: Array<string>
  /** Whether unclaimed pages get the fallback `Pages` section. Defaults `true`. */
  includeUnmatched?: boolean
}

/**
 * Signature of the default export in root-level `/llms.ts`.
 *
 * Return an `LLMsSpec` to declare structure and let the platform enumerate and
 * lay out pages, or return a string to become the entire `llms.txt`.
 *
 * The platform always serves `/llms.txt`; a `/public/llms.txt` is never reached.
 * If this function throws or returns another shape the endpoint fails rather
 * than falling back to the default output.
 */
export type LLMsFile = (
  ctx: LLMsContext,
) => LLMsSpec | string | Promise<LLMsSpec | string>
