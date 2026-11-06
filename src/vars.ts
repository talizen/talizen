import * as React from "react"
import { getTalizenConfig, subscribeTalizenConfig } from "./core.js"

/**
 * 站点变量：全站只有一个值的东西（二维码、客服电话、公告开关……）。
 * 在编辑器「管理 → 站点变量」里改，改了立即生效、不用发布。
 * 值由渲染引擎注入 TalizenConfig.vars，SSR 与客户端读到同一份，任何组件都能同步读取，不发请求。
 */
export type Vars = Record<string, unknown>

const emptyVars: Vars = {}

function readVars(): Vars {
  const config = getTalizenConfig()
  const globalConfig = typeof globalThis !== "undefined" ? globalThis.TalizenConfig : undefined
  const vars = config.vars ?? globalConfig?.vars
  return vars && typeof vars === "object" ? vars : emptyVars
}

/**
 * 在组件里读取站点变量。没有设置值的变量是 undefined，记得给兜底。
 *
 * ```tsx
 * const vars = useVars<{ wechatQrcode?: string; phone?: string }>()
 * return <img src={vars.wechatQrcode} alt="WeChat" />
 * ```
 */
export function useVars<T extends object = Vars>(): Partial<T> {
  return React.useSyncExternalStore(subscribeTalizenConfig, readVars, readVars) as Partial<T>
}

/**
 * 与 useVars() 等价，但**不是 hook**，给 getServerSideProps / generateMetadata 用。
 *
 * ```ts
 * export async function generateMetadata() {
 *   const { siteSlogan } = getVars<{ siteSlogan?: string }>()
 *   return { description: siteSlogan }
 * }
 * ```
 */
export function getVars<T extends object = Vars>(): Partial<T> {
  return readVars() as Partial<T>
}
