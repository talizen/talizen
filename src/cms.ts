import { requestJson, type TalizenRequestOptions } from "./core.js"

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

  return requestJson<T>(url.pathname + url.search, undefined, options)
}

export async function getContentWithPrevNext<T extends BaseCmsItem>(
  key: T["__cmsKey"],
  slug: string,
  params: GetContentWithPrevNextParams = {},
  options?: TalizenRequestOptions,
): Promise<ContentWithPrevNext<T>> {
  return requestJson<ContentWithPrevNext<T>>(
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
}
