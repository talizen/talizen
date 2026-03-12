import { requestJson, resolveTalizenConfig, type TalizenRequestOptions } from "../core/index.js"

export interface BaseCmsItem {
  readonly __cmsKey: string
  slug: string
  id: string
  body: Record<string, unknown>
}

export interface CmsListItem<T extends BaseCmsItem = BaseCmsItem> {
  key: T["__cmsKey"]
  name: string
  Item: T
}

export interface GetContentListFilterCondition {
  fieldId?: string
  operator?: string
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

export interface ListResponse<T extends BaseCmsItem> {
  list?: T[]
  total?: number
}

export async function ListContent<T extends BaseCmsItem>(
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

  return response
}

export async function GetContent<T extends BaseCmsItem>(
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

  return requestJson<T>(url.pathname + url.search, undefined, options)
}

export async function GetContentWithPrevNext<T extends BaseCmsItem>(
  key: T["__cmsKey"],
  slug: string,
  params: GetContentWithPrevNextParams = {},
  options?: TalizenRequestOptions,
): Promise<ContentWithPrevNext<T>> {
  const url = new URL(`/cms/${key}/content_with_prev_next`, "https://talizen.local")

  url.searchParams.set("slug", slug)
  if (params.prev != null) {
    url.searchParams.set("prev", String(params.prev))
  }
  if (params.next != null) {
    url.searchParams.set("next", String(params.next))
  }
  if (params.searchKey) {
    url.searchParams.set("search_key", params.searchKey)
  }
  if (params.orderBy) {
    url.searchParams.set("order_by", params.orderBy)
  }
  if (params.builtinRef != null) {
    url.searchParams.set("builtin_ref", String(params.builtinRef))
  }
  if (params.filter) {
    url.searchParams.set("filter", JSON.stringify(params.filter))
  }

  return requestJson<ContentWithPrevNext<T>>(url.pathname + url.search, undefined, options)
}
