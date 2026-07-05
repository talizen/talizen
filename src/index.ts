export * from "./core.js"
export * from "./auth.js"
export * from "./cms.js"
export * from "./captcha-ui.js"
export * from "./form.js"
export * from "./i18n.js"
export * from "./server-runtime.js"

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
