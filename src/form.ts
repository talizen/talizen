import {
  buildCaptchaAnswer,
  runCaptchaVerification,
  shouldRetryCaptchaSubmit,
  type CaptchaChallenge,
  type CaptchaUiTheme,
} from "./captcha-ui.js"
import {
  requestJson,
  TalizenHttpError,
  type TalizenRequestOptions,
} from "./core.js"
import { uploadWithSignedUrl } from "./signed-upload.js"

export type { CaptchaChallenge as FormCaptcha, CaptchaUiTheme as FormCaptchaUiTheme } from "./captcha-ui.js"

export interface FormRecord {
  readonly __formKey?: string
  [key: string]: unknown
}

export interface SubmitFormOptions extends TalizenRequestOptions {
  captchaToken?: string
  captchaAnswer?: string
  captchaX?: number
  captchaY?: number
}

export interface SubmitFormWithCaptchaOptions extends SubmitFormOptions {
  shouldTriggerCaptcha?: (error: unknown) => boolean
  captchaUiTheme?: CaptchaUiTheme
}

export async function submitForm<T extends FormRecord>(
  keyOrToken: T["__formKey"] | string,
  payload: T,
  options?: SubmitFormWithCaptchaOptions,
): Promise<"ok"> {
  const formKey = getFormKey(keyOrToken)
  const data = await replaceFiles(formKey, payload, "", options)

  try {
    return await submitFormRequest(formKey, data, options)
  }
  catch (error) {
    if (!shouldShowCaptcha(error, options)) {
      throw error
    }
  }

  return runCaptchaVerification({
    initialCaptcha: await getFormCaptcha(formKey, options),
    signal: options?.signal,
    theme: options?.captchaUiTheme,
    refreshCaptcha: () => getFormCaptcha(formKey, options),
    shouldRetry: (error) => shouldRetryCaptchaSubmit(error, (item) => shouldShowCaptcha(item, options)),
    verify: (result) => submitFormRequest(formKey, data, {
      ...options,
      captchaToken: result.token,
      captchaAnswer: buildCaptchaAnswer(result.x, result.y),
      captchaX: result.x,
      captchaY: result.y,
    }),
  })
}

function submitFormRequest(
  formKey: string,
  data: unknown,
  options?: SubmitFormOptions,
): Promise<"ok"> {
  return requestJson<"ok">(
    `/form/${formKey}/submit`,
    {
      method: "POST",
      body: JSON.stringify({
        data,
        captcha_token: options?.captchaToken,
        captcha_answer: options?.captchaAnswer,
        captcha_x: options?.captchaX,
        captcha_y: options?.captchaY,
      }),
    },
    options,
  )
}

export async function getFormCaptcha(
  keyOrToken: string,
  options?: TalizenRequestOptions,
): Promise<CaptchaChallenge> {
  const formKey = getFormKey(keyOrToken)

  return requestJson<CaptchaChallenge>(
    `/form/${formKey}/captcha`,
    {
      method: "GET",
    },
    options,
  )
}

function shouldShowCaptcha(error: unknown, options?: SubmitFormWithCaptchaOptions): boolean {
  return (options?.shouldTriggerCaptcha ?? isCaptchaRequiredError)(error)
}

function isCaptchaRequiredError(error: unknown): boolean {
  return error instanceof TalizenHttpError && isCaptchaRequiredCode(error.bodyJson?.code)
}

function isCaptchaRequiredCode(code: number | string | undefined): boolean {
  return code === 428 || code === "428"
}

function getFormKey(keyOrToken: string | undefined): string {
  if (keyOrToken == null || keyOrToken === "") {
    throw new Error("Talizen form key is required.")
  }

  return keyOrToken
}

async function replaceFiles(
  formKey: string,
  value: unknown,
  path: string,
  options?: TalizenRequestOptions,
): Promise<unknown> {
  if (isFile(value)) {
    return uploadFile(formKey, path || value.name, value, options)
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item, index) => replaceFiles(formKey, item, joinPath(path, String(index)), options)))
  }

  if (isPlainObject(value)) {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, item]) => [key, await replaceFiles(formKey, item, joinPath(path, key), options)] as const),
    )

    return Object.fromEntries(entries)
  }

  return value
}

async function uploadFile(
  formKey: string,
  fieldKey: string,
  file: File,
  options?: TalizenRequestOptions,
): Promise<string> {
  const target = await uploadWithSignedUrl(
    `/form/${formKey}/file/preupload`,
    file,
    file.name,
    fieldKey,
    options,
  )
  return target.fileUrl
}

function joinPath(parent: string, key: string): string {
  return parent === "" ? key : `${parent}.${key}`
}

function isFile(value: unknown): value is File {
  return typeof File === "function" && value instanceof File
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]"
}
