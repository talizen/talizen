import { requestJson, resolveTalizenConfig, type TalizenRequestOptions } from "../core/index.js"


export interface SubmitFormParams<TBody extends Record<string, unknown>> {
  token: string
  data: TBody
}

export async function SubmitForm<TBody extends Record<string, unknown> = Record<string, unknown>>(
  params: SubmitFormParams<TBody>,
  options?: TalizenRequestOptions,
): Promise<"ok"> {

  return requestJson<"ok">(
    `/form/submit`,
    {
      method: "POST",
      body: JSON.stringify({
        token: params.token,
        data: params.data,
      }),
    },
    options,
  )
}

