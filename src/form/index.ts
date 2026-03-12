import { requestJson, resolveTalizenConfig, type ContentBodyField, type ContentSchema, type DBId, type TalizenRequestOptions } from "../core/index.js"

export interface FormSetting {}

export interface FormApp<TSchema extends ContentSchema = ContentSchema> {
  id: DBId
  project_id: DBId
  key: string
  user_id: number
  name: string
  desc: string
  schema: TSchema
  setting: FormSetting
  created_at: string
  updated_at: string
}

export type FormLogBody<TBody extends Record<string, unknown>> = {
  [K in keyof TBody]?: ContentBodyField<TBody[K]>
}

export interface FormLog<TBody extends Record<string, unknown> = Record<string, unknown>> {
  id: DBId
  form_id: DBId
  uid: string
  ua: string
  ip: string
  form_url: string
  body: FormLogBody<TBody>
  created_at: string
  updated_at: string
}

export interface SubmitFormParams<TBody extends Record<string, unknown> = Record<string, unknown>> {
  token: string
  data: TBody
  ip?: string
  uid?: string
  ua?: string
  fromUrl?: string
}

export async function GetForm(formId: DBId, options?: TalizenRequestOptions): Promise<FormApp> {
  const projectId = requireProjectId(options)
  return requestJson<FormApp>(`/api/r/project/${projectId}/form/${formId}`, undefined, options)
}

export async function SubmitForm<TBody extends Record<string, unknown> = Record<string, unknown>>(
  params: SubmitFormParams<TBody>,
  options?: TalizenRequestOptions,
): Promise<"ok"> {
  const projectId = requireProjectId(options)

  return requestJson<"ok">(
    `/api/r/project/${projectId}/form`,
    {
      method: "POST",
      body: JSON.stringify({
        token: params.token,
        data: params.data,
        ip: params.ip,
        uid: params.uid,
        ua: params.ua,
        from_url: params.fromUrl,
      }),
    },
    options,
  )
}

function requireProjectId(options?: TalizenRequestOptions): string {
  const projectId = resolveTalizenConfig(options).projectId
  if (projectId) {
    return projectId
  }

  throw new Error("Talizen projectId is required. Pass options.projectId or call setTalizenConfig({ projectId }).")
}
