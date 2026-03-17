import { requestJson, type TalizenRequestOptions } from "./core.js"

export interface FormRecord {
  readonly __formKey?: string
  [key: string]: unknown
}

export async function submitForm<T extends FormRecord>(
  keyOrToken: T["__formKey"] | string,
  payload: T,
  options?: TalizenRequestOptions,
): Promise<"ok"> {
  return requestJson<"ok">(
    `/form/${keyOrToken}/submit`,
    {
      method: "POST",
      body: JSON.stringify({
        data: payload,
      }),
    },
    options,
  )
}
