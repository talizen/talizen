import { TalizenHttpError } from "./core.js"

export interface CaptchaChallenge {
  token: string
  type: "slide"
  master_img: string
  tile_img: string
  width: number
  height: number
  tile_width: number
  tile_height: number
  tile_x: number
  tile_y: number
}

export interface CaptchaUiTheme {
  zIndex?: number
  width?: number
  title?: string
  subtitle?: string
  cancelText?: string
  sliderText?: string
  retryText?: string
}

export interface CaptchaVerifyResult {
  token: string
  x: number
  y: number
}

export interface CaptchaVerificationFlowOptions<T> {
  initialCaptcha: CaptchaChallenge
  refreshCaptcha: () => Promise<CaptchaChallenge>
  signal?: AbortSignal
  shouldRetry: (error: unknown) => boolean
  theme?: CaptchaUiTheme
  verify: (result: CaptchaVerifyResult) => Promise<T>
}

type CaptchaDialogTheme = Required<Omit<CaptchaUiTheme, "width">> & {
  hasCustomWidth: boolean
  width: number
}

interface CaptchaDialogElements {
  baseImage: HTMLImageElement
  host: HTMLDivElement
  panel: HTMLDivElement
  stage: HTMLDivElement
  tile: HTMLImageElement
  slider: HTMLInputElement
  errorText: HTMLDivElement
  cancelButton: HTMLButtonElement
}

export function shouldRetryCaptchaSubmit(
  error: unknown,
  shouldTriggerCaptcha: (error: unknown) => boolean,
): boolean {
  if (shouldTriggerCaptcha(error)) {
    return true
  }

  if (!(error instanceof TalizenHttpError)) {
    return false
  }

  if (isCaptchaErrorBody(error)) {
    return true
  }

  return error.status >= 400 && error.status < 500
}

export function buildCaptchaAnswer(x: number, y: number): string {
  return JSON.stringify({ x, y })
}

export function runCaptchaVerification<T>(options: CaptchaVerificationFlowOptions<T>): Promise<T> {
  if (typeof document === "undefined") {
    throw new Error("Talizen captcha UI requires browser DOM support.")
  }

  if (options.signal?.aborted) {
    throw createAbortError()
  }

  return new Promise<T>((resolve, reject) => {
    const dialogTheme = resolveCaptchaDialogTheme(options.initialCaptcha, options.theme)
    const elements = createCaptchaDialogElements(options.initialCaptcha, dialogTheme)
    const { host, tile, slider, errorText, cancelButton } = elements
    let currentCaptcha = options.initialCaptcha
    let settled = false
    let verifying = false

    document.body.append(host)

    const cleanup = () => {
      host.removeEventListener("click", handleBackdropClick)
      document.removeEventListener("keydown", handleKeydown)
      slider.removeEventListener("input", updateTilePosition)
      slider.removeEventListener("change", submit)
      cancelButton.removeEventListener("click", cancel)
      options.signal?.removeEventListener("abort", abort)
      host.remove()
    }

    const settle = (callback: () => void) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      callback()
    }

    const updateTilePosition = () => {
      tile.style.left = `${getSliderValue(slider)}px`
      setCaptchaErrorText(errorText)
    }

    const submit = async () => {
      if (verifying) {
        return
      }

      verifying = true
      const x = getSliderValue(slider)
      setCaptchaDialogDisabled(elements, true)

      try {
        const result = await options.verify({ token: currentCaptcha.token, x, y: currentCaptcha.tile_y })
        settle(() => resolve(result))
      }
      catch (error) {
        if (!options.shouldRetry(error)) {
          settle(() => reject(error))
          return
        }

        try {
          currentCaptcha = await options.refreshCaptcha()
          updateCaptchaDialogCaptcha(elements, currentCaptcha, dialogTheme)
          setCaptchaErrorText(errorText, dialogTheme.retryText)
        }
        catch (refreshError) {
          settle(() => reject(refreshError))
          return
        }
      }
      finally {
        verifying = false
        if (!settled) {
          setCaptchaDialogDisabled(elements, false)
          slider.focus()
        }
      }
    }

    const cancel = () => {
      settle(() => reject(new Error("Talizen captcha verification was cancelled by user.")))
    }

    const abort = () => {
      settle(() => reject(createAbortError()))
    }

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target === host) {
        cancel()
      }
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancel()
      }
    }

    slider.addEventListener("input", updateTilePosition)
    slider.addEventListener("change", submit)
    host.addEventListener("click", handleBackdropClick)
    document.addEventListener("keydown", handleKeydown)
    cancelButton.addEventListener("click", cancel)
    options.signal?.addEventListener("abort", abort, { once: true })

    updateTilePosition()
    slider.focus()
  })
}

function isCaptchaErrorBody(error: TalizenHttpError): boolean {
  const code = String(error.bodyJson?.code ?? "").toLowerCase()
  const message = String(error.bodyJson?.message ?? "").toLowerCase()
  const body = error.body.toLowerCase()

  return code.includes("captcha")
    || code.includes("verify")
    || message.includes("captcha")
    || message.includes("验证")
    || body.includes("captcha")
    || body.includes("验证")
}

function resolveCaptchaDialogTheme(captcha: CaptchaChallenge, theme?: CaptchaUiTheme): CaptchaDialogTheme {
  const localeText = getCaptchaLocaleText()

  return {
    zIndex: theme?.zIndex ?? 9999,
    hasCustomWidth: theme?.width != null,
    width: theme?.width ?? getDefaultCaptchaDialogWidth(captcha),
    title: theme?.title ?? localeText.title,
    subtitle: theme?.subtitle ?? localeText.subtitle,
    cancelText: theme?.cancelText ?? localeText.cancelText,
    sliderText: theme?.sliderText ?? localeText.sliderText,
    retryText: theme?.retryText ?? localeText.retryText,
  }
}

function createCaptchaDialogElements(
  captcha: CaptchaChallenge,
  theme: CaptchaDialogTheme,
): CaptchaDialogElements {
  const host = createStyledElement("div", {
    position: "fixed",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.4)",
    zIndex: String(theme.zIndex),
  })
  const sliderClassName = "talizen-captcha-slider"
  const sliderStyle = createCaptchaSliderStyle(sliderClassName)

  const panel = createStyledElement("div", {
    width: `${theme.width}px`,
    maxWidth: "calc(100vw - 32px)",
    background: "#ffffff",
    borderRadius: "18px",
    padding: "16px",
    boxSizing: "border-box",
    boxShadow: "0 24px 60px rgba(15,23,42,0.24)",
    color: "#111827",
  })

  const title = createStyledElement("div", {
    fontSize: "18px",
    lineHeight: "26px",
    fontWeight: "700",
    marginBottom: "4px",
  }, theme.title)

  const subtitle = createStyledElement("div", {
    fontSize: "14px",
    lineHeight: "22px",
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: "12px",
  }, theme.subtitle)

  const stage = createCaptchaStage(captcha)
  const sliderLabel = createStyledElement("div", {
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: "8px",
  }, theme.sliderText)

  const slider = createCaptchaSlider(captcha, sliderClassName)
  const errorText = createStyledElement("div", {
    display: "none",
    flex: "1",
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: "500",
    color: "#ef4444",
  })

  const actions = createStyledElement("div", {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    justifyContent: "flex-start",
    marginTop: "8px",
  })

  const cancelButton = createStyledElement("button", {
    padding: "10px 18px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 1px 2px rgba(15,23,42,0.08)",
    color: "#111827",
    fontSize: "15px",
    lineHeight: "20px",
    fontWeight: "600",
    cursor: "pointer",
    marginLeft: "auto",
  }, theme.cancelText)
  cancelButton.type = "button"

  actions.append(errorText, cancelButton)
  panel.append(title, subtitle, stage.host, sliderLabel, slider, actions)
  host.append(sliderStyle, panel)

  return {
    baseImage: stage.baseImage,
    host,
    panel,
    stage: stage.host,
    tile: stage.tile,
    slider,
    errorText,
    cancelButton,
  }
}

function createCaptchaStage(captcha: CaptchaChallenge): {
  baseImage: HTMLImageElement
  host: HTMLDivElement
  tile: HTMLImageElement
} {
  const host = createStyledElement("div", {
    position: "relative",
    width: `${captcha.width}px`,
    height: `${captcha.height}px`,
    maxWidth: "100%",
    margin: "0 0 12px",
    borderRadius: "12px",
    overflow: "hidden",
    background: "#f5f5f5",
  })

  const baseImage = createStyledElement("img", {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  })
  baseImage.src = captcha.master_img
  baseImage.draggable = false

  const tile = createStyledElement("img", {
    position: "absolute",
    top: `${captcha.tile_y}px`,
    left: "0px",
    width: `${captcha.tile_width}px`,
    height: `${captcha.tile_height}px`,
    pointerEvents: "none",
  })
  tile.src = captcha.tile_img
  tile.draggable = false

  host.append(baseImage, tile)
  return { baseImage, host, tile }
}

function createCaptchaSlider(captcha: CaptchaChallenge, className: string): HTMLInputElement {
  const slider = createStyledElement("input", {
    width: "100%",
    display: "block",
    margin: "0",
  })

  slider.type = "range"
  slider.className = className
  slider.min = "0"
  slider.max = String(Math.max(0, captcha.width - captcha.tile_width))
  slider.value = "0"

  return slider
}

function createCaptchaSliderStyle(className: string): HTMLStyleElement {
  const style = document.createElement("style")
  style.textContent = `
    .${className} {
      appearance: none;
      -webkit-appearance: none;
      height: 40px;
      background: transparent;
      cursor: pointer;
    }
    .${className}:focus {
      outline: none;
    }
    .${className}::-webkit-slider-runnable-track {
      height: 12px;
      border: 1px solid #d1d5db;
      border-radius: 999px;
      background: #f9fafb;
      box-shadow: inset 0 1px 2px rgba(15,23,42,0.08);
    }
    .${className}::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 30px;
      height: 30px;
      margin-top: -10px;
      border: 3px solid #ffffff;
      border-radius: 999px;
      background: #1677ff;
      box-shadow: 0 4px 12px rgba(22,119,255,0.35);
    }
    .${className}::-moz-range-track {
      height: 12px;
      border: 1px solid #d1d5db;
      border-radius: 999px;
      background: #f9fafb;
      box-shadow: inset 0 1px 2px rgba(15,23,42,0.08);
    }
    .${className}::-moz-range-thumb {
      width: 24px;
      height: 24px;
      border: 3px solid #ffffff;
      border-radius: 999px;
      background: #1677ff;
      box-shadow: 0 4px 12px rgba(22,119,255,0.35);
    }
    .${className}:disabled {
      cursor: wait;
      opacity: 0.72;
    }
  `
  return style
}

function createStyledElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  styles: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName)
  Object.assign(element.style, styles)

  if (text != null) {
    element.textContent = text
  }

  return element
}

function updateCaptchaDialogCaptcha(
  elements: CaptchaDialogElements,
  captcha: CaptchaChallenge,
  theme: CaptchaDialogTheme,
): void {
  if (!theme.hasCustomWidth) {
    elements.panel.style.width = `${getDefaultCaptchaDialogWidth(captcha)}px`
  }

  elements.stage.style.width = `${captcha.width}px`
  elements.stage.style.height = `${captcha.height}px`
  elements.baseImage.src = captcha.master_img
  elements.tile.src = captcha.tile_img
  elements.tile.style.top = `${captcha.tile_y}px`
  elements.tile.style.left = "0px"
  elements.tile.style.width = `${captcha.tile_width}px`
  elements.tile.style.height = `${captcha.tile_height}px`
  elements.slider.max = String(Math.max(0, captcha.width - captcha.tile_width))
  elements.slider.value = "0"
}

function getDefaultCaptchaDialogWidth(captcha: CaptchaChallenge): number {
  return Math.max(captcha.width + 32, 320)
}

function setCaptchaDialogDisabled(elements: CaptchaDialogElements, disabled: boolean): void {
  elements.slider.disabled = disabled
}

function setCaptchaErrorText(element: HTMLDivElement, message = ""): void {
  element.textContent = message
  element.style.display = message === "" ? "none" : "block"
}

function getSliderValue(slider: HTMLInputElement): number {
  return clampNumber(toSafeNumber(slider.value), toSafeNumber(slider.min), toSafeNumber(slider.max))
}

function toSafeNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getCaptchaLocaleText(): Required<Omit<CaptchaUiTheme, "zIndex" | "width">> {
  const languages = typeof navigator === "undefined"
    ? []
    : [navigator.language, ...(navigator.languages ?? [])]
      .filter((item): item is string => typeof item === "string" && item !== "")
      .map((item) => item.toLowerCase())

  for (const language of languages) {
    if (language.startsWith("en")) {
      return {
        title: "Complete security verification",
        subtitle: "Drag the slider to move the puzzle into place",
        cancelText: "Cancel",
        sliderText: "Drag the slider to complete the puzzle",
        retryText: "Verification failed, please try again.",
      }
    }

    if (language.startsWith("zh")) {
      return {
        title: "请完成安全验证",
        subtitle: "拖动滑块，将拼图移动到正确位置",
        cancelText: "取消",
        sliderText: "向右拖动滑块完成拼图",
        retryText: "验证失败，请重试。",
      }
    }
  }

  return {
    title: "Complete security verification",
    subtitle: "Drag the slider to move the puzzle into place",
    cancelText: "Cancel",
    sliderText: "Drag the slider to complete the puzzle",
    retryText: "Verification failed, please try again.",
  }
}

function createAbortError(): Error {
  if (typeof DOMException === "function") {
    return new DOMException("The operation was aborted.", "AbortError")
  }

  const error = new Error("The operation was aborted.")
  error.name = "AbortError"
  return error
}
