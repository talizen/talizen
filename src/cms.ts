import { requestJson, type TalizenRequestOptions } from "./core.js"
import { getLocale } from "./i18n.js"

// 字段级本地化解码：把 body._i18n[当前语言] 覆盖到同级字段并删除 _i18n。
// 无论 SSR（getServerSideProps 取数）、客户端还是编辑器预览，都在此处按当前语言解码——
// 渲染引擎不再解码 CMS，只透传原始 body（含 _i18n）。用 getLocale()（非 hook），
// 因此在 getServerSideProps 里调用也合法。当前语言由引擎注入的 __TALIZEN_I18N__ 提供。
function decodeBodyLocalization(body: Record<string, unknown>): Record<string, unknown> {
  if (!body || typeof body !== "object" || !("_i18n" in body)) return body
  const { _i18n, ...base } = body as Record<string, unknown> & {
    _i18n?: Record<string, Record<string, unknown>>
  }
  const locale = getLocale().locale
  const over = locale && _i18n ? _i18n[locale] : undefined
  return over && typeof over === "object" ? { ...base, ...over } : base
}

function decodeItem<T extends BaseCmsItem>(item: T): T {
  return item && item.body ? { ...item, body: decodeBodyLocalization(item.body) } : item
}

export interface BaseCmsItem {
  readonly __cmsKey: string
  slug: string
  id: string
  body: Record<string, unknown>
}

export interface GetContentListFilterCondition {
  fieldId?: string
  operator?: "eq" | "neq" | "contains" | "not_contains"
  value?: any
}

export interface GetContentListFilter {
  match?: "any" | "all"
  conditions?: GetContentListFilterCondition[]
}

export interface ListContentParams {
  limit?: number
  offset?: number
  searchKey?: string
  orderBy?: string
  builtinRef?: boolean
  filter?: GetContentListFilter
}

export interface GetContentParams {
  builtinRef?: boolean
}

export interface GetContentWithPrevNextParams extends GetContentParams {
  prev?: boolean
  next?: boolean
  searchKey?: string
  orderBy?: string
  filter?: GetContentListFilter
}

export interface ContentWithPrevNext<T extends BaseCmsItem> {
  current?: T
  next?: T
  prev?: T
}

export interface ContentCollection {
  jsonSchema?: Record<string, unknown>
  title?: string
}

export interface ListResponse<T> {
  list?: T[]
  total?: number
}

export async function getContentCollection(
  key: string,
  options?: TalizenRequestOptions,
): Promise<ContentCollection | null> {
  return requestJson<ContentCollection | null>(
    `/cms/${key}`,
    undefined,
    options,
  )
}

export async function listContents<T extends BaseCmsItem>(
  key: T["__cmsKey"],
  params: ListContentParams = {},
  options?: TalizenRequestOptions,
): Promise<ListResponse<T>> {
  const response = await requestJson<ListResponse<T>>(
    `/cms/${key}/content_list`,
    {
      method: "POST",
      body: JSON.stringify({
        limit: params.limit,
        offset: params.offset,
        search_key: params.searchKey,
        order_by: params.orderBy,
        builtin_ref: params.builtinRef,
        filter: params.filter,
      }),
    },
    options,
  )

  if (response.list) response.list = response.list.map(decodeItem)
  return response
}

export async function getContent<T extends BaseCmsItem>(
  key: T["__cmsKey"],
  slug: string,
  params?: GetContentParams,
  options?: TalizenRequestOptions,
): Promise<T> {
  const url = new URL(`/cms/${key}/content`, "https://talizen.local")

  url.searchParams.set("slug", slug)
  if (params?.builtinRef != null) {
    url.searchParams.set("builtin_ref", String(params.builtinRef))
  }

  const item = await requestJson<T>(url.pathname + url.search, undefined, options)
  return decodeItem(item)
}

export async function getContentWithPrevNext<T extends BaseCmsItem>(
  key: T["__cmsKey"],
  slug: string,
  params: GetContentWithPrevNextParams = {},
  options?: TalizenRequestOptions,
): Promise<ContentWithPrevNext<T>> {
  const res = await requestJson<ContentWithPrevNext<T>>(
    `/cms/${key}/content_with_prev_next`,
    {
      method: "POST",
      body: JSON.stringify({
        slug,
        prev: params.prev,
        next: params.next,
        search_key: params.searchKey,
        order_by: params.orderBy,
        builtin_ref: params.builtinRef,
        filter: params.filter,
      }),
    },
    options,
  )
  return {
    current: res.current ? decodeItem(res.current) : res.current,
    next: res.next ? decodeItem(res.next) : res.next,
    prev: res.prev ? decodeItem(res.prev) : res.prev,
  }
}
