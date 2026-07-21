/**
 * 只读字符串映射,用于请求头与只读 cookie。对齐 Web `Headers` 的读取子集:
 * `get` 未命中返回 `null`,`has` 判断是否存在。
 */
export interface ServerReadonlyStringMap {
  get(name: string): string | null
  has(name: string): boolean
}

/**
 * 当前请求的只读信息,对齐 Node `req` 与 Web `Request` 的常用子集。
 * 通过 `context.request` 访问(`context.req` 为其别名)。
 */
export interface TalizenServerRequestRuntime {
  host: string
  ip: string
  method: string
  /** 请求路径(不含 host / scheme),等价于 Node `req.url`。 */
  path: string
  /**
   * 同 `path`(是路径,不是完整 URL);保留以兼容既有代码。
   * @deprecated 语义等同 `path`,用 `path` 更清晰。
   */
  url: string
  headers: ServerReadonlyStringMap
  /**
   * 只读 cookie(仅 `get` / `has`)。
   * @deprecated 用顶层 `context.cookies`(可读写)。此处仅为兼容 `req.cookies` 习惯保留。
   */
  cookies: ServerReadonlyStringMap
}

export interface ServerCookieSetOptions {
  path?: string
  domain?: string
  maxAge?: number
  secure?: boolean
  httpOnly?: boolean
  sameSite?: "lax" | "strict" | "none"
}

/**
 * 可读写 cookie 存取器。写操作(`set` / `delete`)会让本次渲染变为 no-store(不进 HTML 缓存)。
 */
export interface TalizenServerCookieRuntime {
  get(name: string): string | null
  has(name: string): boolean
  set(name: string, value: string, options?: ServerCookieSetOptions): { ok?: boolean }
  delete(name: string, options?: Pick<ServerCookieSetOptions, "path" | "domain">): { ok?: boolean }
}

/**
 * `getServerSideProps` 的服务端上下文。
 *
 * `Params` 泛型可标注动态路由参数,例如 `/blog/[slug]`:
 * ```ts
 * export async function getServerSideProps(ctx: TalizenServerSideContext<{ slug: string }>) {
 *   const { slug } = ctx.params          // slug: string
 *   const q = ctx.searchParams.tab       // 查询参数
 *   const locale = ctx.locale            // 当前语言
 *   const token = ctx.cookies.get("t")   // 读 cookie
 *   return { props: { slug } }
 * }
 * ```
 */
export interface TalizenServerSideContext<
  Params extends Record<string, string> = Record<string, string>,
> {
  /** 动态路由参数(如 `[slug]`)。 */
  params: Params
  /** 查询字符串(同名多值取第一个)。 */
  searchParams: Record<string, string>
  /**
   * 查询字符串。
   * @deprecated 用 `searchParams`(内容相同)。
   */
  query: Record<string, string | string[]>
  /** 当前生效语言;站点未开启多语言时为 `undefined`。 */
  locale?: string
  /** 站点支持的全部语言。 */
  locales?: string[]
  /** 站点内容基准语言(CMS 字段 fallback base)。 */
  defaultLocale?: string
  /** 当前域名的无前缀默认语言(domain routing);未配置 domains 时等于 `defaultLocale`。 */
  routingDefaultLocale?: string
  /** 当前请求信息(host / headers / cookies 等)。 */
  request: TalizenServerRequestRuntime
  /**
   * 当前请求信息。
   * @deprecated 用 `request`(同一个对象)。保留以兼容 Next.js `req` 习惯。
   */
  req: TalizenServerRequestRuntime
  /** 可读写 cookie。写操作会让本次渲染 no-store。 */
  cookies: TalizenServerCookieRuntime
}

/**
 * `getServerSideProps` 的返回值,对齐 Next.js:`props` / `redirect` / `notFound` 三选一。
 */
export type GetServerSidePropsResult<Props = Record<string, unknown>> =
  | { props: Props | Promise<Props> }
  | { redirect: { destination: string; permanent?: boolean; statusCode?: number } }
  | { notFound: true }

/**
 * `getServerSideProps` 的函数类型,对齐 Next.js 的 `GetServerSideProps<Props, Params>`。
 * ```ts
 * import type { GetServerSideProps } from "talizen"
 *
 * export const getServerSideProps: GetServerSideProps<{ slug: string }, { slug: string }> = async (ctx) => {
 *   return { props: { slug: ctx.params.slug } }
 * }
 * ```
 */
export type GetServerSideProps<
  Props = Record<string, unknown>,
  Params extends Record<string, string> = Record<string, string>,
> = (
  context: TalizenServerSideContext<Params>,
) => Promise<GetServerSidePropsResult<Props>> | GetServerSidePropsResult<Props>

/**
 * 从 `getServerSideProps` 推断页面组件的 props 类型,对齐 Next.js 的 `InferGetServerSidePropsType`。
 * ```ts
 * export default function Page(props: InferGetServerSidePropsType<typeof getServerSideProps>) {}
 * ```
 */
export type InferGetServerSidePropsType<T> = T extends GetServerSideProps<infer P, Record<string, string>>
  ? P
  : T extends (context: never) => infer R
    ? Extract<Awaited<R>, { props: unknown }> extends { props: infer P }
      ? Awaited<P>
      : never
    : never
