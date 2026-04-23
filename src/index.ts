export * from "./core.js"
export * from "./cms.js"
export * from "./form.js"

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
