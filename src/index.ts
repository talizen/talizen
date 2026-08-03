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
