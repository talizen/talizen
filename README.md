# talizen

Talizen's frontend SDK package. It provides a small runtime client and shared types for:

- `talizen/core`
- `talizen/auth`
- `talizen/cms`
- `talizen/form`
- `talizen/func`
- `talizen/func-runtime`

The package is designed to hold the platform-level APIs that frontend projects use directly, while project-specific CMS and form schema types can still be generated separately per project.

## Install

```bash
npm install talizen
```

or use esm.sh

```
{
  "imports": {
    "talizen": "https://esm.sh/talizen@0.1.4"
    "talizen/": "https://esm.sh/talizen@0.1.4/"
  }
}
```

## Usage

### Configure the client

```ts
import { setTalizenConfig } from "talizen/core";

setTalizenConfig({
  baseUrl: "https://www.talizen.com",
  onFileUploadProcess(key, process) {
    console.log(key, process);
  },
});
```

### List CMS content

```ts
import { listContents, type BaseCmsItem } from "talizen/cms";

interface Blog extends BaseCmsItem {
  readonly __cmsKey: "blogs";
  body: {
    title?: string;
    content?: string;
  };
}

const result = await listContents<Blog>("blogs", {
  limit: 10,
  orderBy: "-created_at",
});

console.log(result.list);
console.log(result.total);
```

### Get a single CMS content item

```ts
import { getContent, type BaseCmsItem } from "talizen/cms";

interface Blog extends BaseCmsItem {
  readonly __cmsKey: "blogs";
  body: {
    title?: string;
  };
}

const blog = await getContent<Blog>("blogs", "hello-world");
```

### Get CMS collection metadata

```ts
import { getContentCollection } from "talizen/cms";

const collection = await getContentCollection("blogs");

console.log(collection?.title);
console.log(collection?.jsonSchema);
```

### Submit a form

```ts
import { submitForm } from "talizen/form";

await submitForm("contact-form", {
  email: "hi@talizen.com",
  message: "Hello from the website",
});
```

When a `File` object appears in the payload, `submitForm()` will:

1. Call `POST /form/:key/file/preupload`
2. If `hash_exist` is `false`, upload the file to the returned S3 signed URL
3. Replace the original `File` value with the returned `file_url`
4. Submit the final payload to `/form/:key/submit`

### Login users

```tsx
import {
  listAuthProviders,
  loginWithOAuth,
  useAuth,
} from "talizen/auth";

const providers = await listAuthProviders();
console.log(providers.map((provider) => provider.key));

await loginWithOAuth("github", { redirectUrl: "/account" });

function AccountBadge() {
  const { user, loading, login, register, logout, updateProfile } = useAuth();
  if (loading) return <span>Loading...</span>;
  if (!user) return <button onClick={() => login("alice", "secret")}>Sign in</button>;
  return (
    <div>
      <button onClick={() => register("bob", "secret", "Bob")}>Create account</button>
      <button onClick={() => updateProfile({ address: "No. 1 Example Road" })}>Update profile</button>
      <button onClick={() => logout()}>{user.name ?? user.account ?? "Logout"}</button>
    </div>
  );
}
```

### Invoke a custom function

```ts
import { invoke } from "talizen/func";

const result = await invoke<{ ok: boolean; id: string }>("booking.create", {
  email: "hi@talizen.com",
  date: "2026-07-04",
  time: "10:00",
});
```

`invoke("<fileKey>.<method>", input)` calls the method exported by the script file. If `.method` is omitted, Talizen calls `main`:

```ts
await invoke("booking", { email: "hi@talizen.com" });
```

### Server-side page context

In `getServerSideProps`, the render engine injects a typed context with request
metadata, route params, query, locale, and cookies. Type the whole function with
`GetServerSideProps<Props, Params>` (and infer the page props with
`InferGetServerSidePropsType`) — never leave `ctx` as `any`:

```tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "talizen";

export const getServerSideProps: GetServerSideProps<{ slug: string }, { slug: string }> = async (ctx) => {
  const token = ctx.cookies.get("session");
  return { props: { slug: ctx.params.slug } };
};

export default function Page(props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return <main>{props.slug}</main>;
}
```

Or type just the parameter with `TalizenServerSideContext<{ slug: string }>` (from
`talizen` or `talizen/server-runtime`).

Context fields:

| Field | Type | Notes |
| --- | --- | --- |
| `ctx.params` | `Params` (default `Record<string, string>`) | Dynamic route params, e.g. `[slug]`. |
| `ctx.searchParams` | `Record<string, string>` | Query string; multi-value keys keep the first value. |
| `ctx.request` | object | Current request: `host`, `ip`, `method`, `path`, `url` (= `path`), `headers.get()/has()`, `cookies.get()/has()`. |
| `ctx.cookies` | object | Read/write cookies: `get`, `has`, `set`, `delete`. Writes make the render no-store. |
| `ctx.locale` / `ctx.locales` / `ctx.defaultLocale` | `string` / `string[]` / `string` | Current / all / content-base locales (multilingual sites only). |
| `ctx.routingDefaultLocale` | `string` | The current host's no-prefix locale (domain routing); equals `defaultLocale` without domains. |

Deprecated aliases kept for compatibility: `ctx.req` (= `ctx.request`), `ctx.query`
(= `ctx.searchParams`), and `ctx.request.cookies` (read-only; prefer the top-level
`ctx.cookies`). For host use `ctx.request.host` — there is no top-level `ctx.host`.

The context intentionally does not expose `ctx.auth`, `ctx.db`, `ctx.cache`, or
`ctx.func`. This keeps HTML render caching predictable: cookie reads can use
cookie-vary, cookie writes are no-store, and user-specific auth/Func reads do not
become hidden SSR cache dependencies. Do not import `talizen/auth` or
`talizen/func` in server-side page code; put login UI, private data access,
writes, and custom backend actions in browser-side SDK/Func/API flows.

### Current path and language switching

`talizen/router` (also re-exported from `talizen`) exposes the current route,
mirroring `next/navigation`. Paths are locale-stripped and SSR-safe: they read the
engine-injected pathname, and on the client fall back to stripping
`window.location.pathname` by the configured locales.

```tsx
import { usePathname, getPathname } from "talizen";

// usePathname(): current locale-stripped path in a component; /en/blog -> "/blog".
function Nav() {
  const pathname = usePathname();
  return <a href="/blog" aria-current={pathname === "/blog" || undefined}>Blog</a>;
}

// getPathname(): non-hook version for getServerSideProps / event callbacks.
```

For a language switcher, pair `getLocalePath()` with the locale-aware `<Link>` so
it stays on the current page — `<Link locale>` adds the target prefix (the default
locale gets none) and writes the `CREGHT_LOCALE` cookie:

```tsx
import { Link, useLocale, getLocalePath } from "talizen";

function LanguageSwitcher() {
  const { locale: active, locales } = useLocale();
  const href = getLocalePath(); // current page's locale-less path + query/hash
  return (
    <nav>
      {locales.map((locale) => (
        <Link key={locale} href={href} locale={locale} aria-current={locale === active || undefined}>
          {locale}
        </Link>
      ))}
    </nav>
  );
}
```

`getLocalePath()` returns the current locale-stripped path plus `query`/`hash`; do
not hardcode `href="/"` for a switcher (that always lands on the home page). There
is no `useRouter`: Talizen navigates with native anchors (MPA), not a client-side
router.

### Write function runtime code

Func code can use TypeScript and import Func authoring types from `talizen/func-runtime`.
Runtime capabilities are passed through `ctx`:

```ts
import type { TalizenFuncContext } from "talizen/func-runtime";

export function create(input: { title: string }, ctx: TalizenFuncContext) {
  const user = ctx.auth.requireUser();
  const row = ctx.db.insert("book", {
    title: input.title,
    user_id: user.id,
    status: "draft",
  });
  ctx.cache.set(`book:${row.id}`, row, 60);
  return { ok: true, id: row.id };
}
```

`ctx.db.query(table, query)` returns `{ total, list }`, where `total` is the
matched record count before pagination and `list` is the current page:

```ts
import type { TalizenFuncContext } from "talizen/func-runtime";

export function list(input: { offset?: number }, ctx: TalizenFuncContext) {
  const result = ctx.db.query<{ title: string; status: string }>("book", {
    where: { status: "published" },
    limit: 20,
    offset: input.offset || 0,
  });
  return { total: result.total, books: result.list };
}
```

`ctx.db`, `ctx.cache`, `ctx.auth`, `ctx.request`, and `ctx.cookies` are injected by the Talizen Func runtime. `talizen/func-runtime` is a type-only authoring module; do not import runtime values from it.

`ctx.request` exposes Fetch-style one-shot body readers. Use `await ctx.request.text()` when a webhook signature must be verified against the exact request bytes, `await ctx.request.json()` for parsed JSON, or `await ctx.request.arrayBuffer()` for binary input. Reading the body sets `ctx.request.bodyUsed`; a second read rejects. `ctx.response.status(code)` sets the actual HTTP response status (100-599), including statuses returned when a Func throws after setting the status. The runtime also provides `TextEncoder` and the HMAC SHA-256 subset of `crypto.subtle` (`importKey`, `sign`, and `verify`) for webhook verification.

Func HTTP responses use the HTTP status code rather than a top-level `ok` field. Successful responses contain `{ result: ... }`; failed responses contain `{ error: ... }`. `invoke()` unwraps `result` for callers.

## Package Layout

- `talizen/core`: shared runtime config, request helpers, and base data types.
- `talizen/auth`: project user register, current user helpers, and the React `useAuth()` state hook for login/logout flows.
- `talizen/cms`: CMS content types and content query APIs.
- `talizen/form`: form submission helpers and related types.
- `talizen/func`: custom function invocation helpers such as `invoke`.
- `talizen/func-runtime`: Func-runtime-only `ctx` capability types.
- `talizen/server-runtime`: getServerSideProps-only `ctx` capability types.
- `talizen/router`: current-path and navigation helpers — `usePathname`, `getPathname`, `getLocalePath`.

## Publish

Build and prepare the package contents:

```bash
npm install
npm run build
node scripts/prepare-publish.mjs
```

The GitHub Actions workflow in `.github/workflows/publish.yml` publishes on a tag push. Release a new version with:

```bash
git tag v0.0.8
git push origin main
git push origin v0.0.8
```

## Development

```bash
bun run dev
```

This will build the package and start a development server at http://localhost:8787.

Use the development server in your project:

```json
{
  "imports": {
    "talizen/form": "http://localhost:8787/form.js"
  }
}
```
