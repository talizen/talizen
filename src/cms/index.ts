import { requestJson, resolveTalizenConfig, type ContentBodyField, type ContentSchema, type DBId, type TalizenRequestOptions } from "../core/index.js"

export interface BaseCmsItem {
  readonly __cmsKey: string
  slug: string
  id: DBId
  body: Record<string, unknown>
}

export interface CmsListItem<T extends BaseCmsItem = BaseCmsItem> {
  key: T["__cmsKey"]
  name: string
  Item: T
}

export interface CmsApp<TSchema extends ContentSchema = ContentSchema> {
  id: DBId
  project_id: DBId
  key: string
  user_id: number
  name: string
  desc: string
  schema: TSchema
  created_at: string
  updated_at: string
  visibility?: "private" | "public" | (string & {})
}

export type ContentStatus = "online" | "offline" | (string & {})

export interface CmsContent<TBody extends Record<string, unknown> = Record<string, unknown>> {
  id: DBId
  slug: string
  content_app_id: DBId
  user_id: number
  schema: ContentSchema
  tags?: string[]
  status?: ContentStatus
  body: {
    [K in keyof TBody]?: ContentBodyField<TBody[K]>
  }
  draft_body?: {
    [K in keyof TBody]?: ContentBodyField<TBody[K]>
  }
  created_at: string
  updated_at: string
}

export interface GetContentListFilterCondition {
  fieldId?: string
  operator?: string
  value?: unknown
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

export async function ListContent<T extends BaseCmsItem>(
  key: T["__cmsKey"],
  params: ListContentParams = {},
  options?: TalizenRequestOptions,
): Promise<T[]> {
  const projectId = requireProjectId(options)

  const response = await requestJson<{ list?: T[] }>(
    `/api/r/project/${projectId}/cms_by_key/${key}/content_list`,
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

  return response.list ?? []
}

export async function GetContent<T extends BaseCmsItem>(
  key: T["__cmsKey"],
  slug: string,
  params?: GetContentParams,
  options?: TalizenRequestOptions,
): Promise<T> {
  const projectId = requireProjectId(options)
  const url = new URL(`/api/r/project/${projectId}/cms_by_key/${key}/content`, "https://talizen.local")

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
  const projectId = requireProjectId(options)
  const url = new URL(`/api/r/project/${projectId}/cms_by_key/${key}/content_with_prev_next`, "https://talizen.local")

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

function requireProjectId(options?: TalizenRequestOptions): string {
  const projectId = resolveTalizenConfig(options).projectId
  if (projectId) {
    return projectId
  }

  throw new Error("Talizen projectId is required. Pass options.projectId or call setTalizenConfig({ projectId }).")
}
