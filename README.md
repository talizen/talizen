# talizen

Talizen's frontend SDK package. It provides a small runtime client and shared types for:

- `talizen/core`
- `talizen/auth`
- `talizen/cms`
- `talizen/form`
- `talizen/assets`
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

### Upload a browser file to the CDN

Use `talizen/assets` when a page needs to upload an image or another browser
file independently of a form:

```ts
import { uploadAsset } from "talizen/assets";

const asset = await uploadAsset(file, {
  onFileUploadProcess(key, progress) {
    console.log(key, progress);
  },
});

console.log(asset.fileUrl);
console.log(asset.url); // Compatibility alias of fileUrl.
```

`uploadAsset()` hashes the file, requests a short-lived signed upload URL,
uploads the bytes directly from the browser to CDN storage, and confirms the
upload with Talizen. It does not send the file through Func or encode it as
base64. Duplicate content can reuse an existing uploaded object. The progress
callback's `key` is the uploaded file name.

Both `File` and `Blob` are accepted. When passing a `Blob`, provide its name:

```ts
await uploadAsset(blob, { fileName: "avatar.webp" });
```

Signed browser upload is available on both preview and published site domains.

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

### Sign up with a verified email

Whether registration requires a proven contact is **project policy**
(`register_requires` in the project's auth settings), not an argument of
`register`. When it requires `email`, prove the address first:

```ts
import { startVerification, confirmVerification, useAuth } from "talizen/auth";

await startVerification({ channel: "email", to: email, purpose: "register" });
// ...user types the code they received
await confirmVerification({ channel: "email", to: email, purpose: "register", code });

// No code or proof argument: the browser carries an httpOnly proof cookie and the
// server checks it. Registering with a different address than the one proven fails.
await useAuth().register({ account: email, email, password });
```

The proof is single-use, bound to that address and purpose, and expires in ten
minutes. Projects with an empty policy are unaffected — `register` behaves exactly
as before.

This applies to page-code registration. When a project routes registration through
its own Func (`register_entry: "func"`), verification is performed by that Func's
own code instead, and `startVerification` from page code is refused.

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

For incremental SSE output, use the native Fetch stream API:

```ts
const response = await fetch("/func/writer?stream=1&timeout_ms=120000", {
  method: "POST",
  headers: {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ prompt }),
});
if (!response.ok || !response.body) throw new Error("Func stream failed");
const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const sseChunk = decoder.decode(value, { stream: true });
  // Parse the native SSE frames: event: ..., data: ..., blank line.
}
```

Read chunks are arbitrary byte boundaries, not complete events; buffer across
reads and split SSE frames only on a blank line.

The stream ends with a platform `done` event or an `error` event. Once a Func
sends its first event, it can no longer set or delete cookies.

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
This exact package name is required; there is no `@talizen/func-runtime` package.
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

Stream bounded incremental work with `ctx.sse.send()`:

```ts
export async function main(input: { prompt: string }, ctx: TalizenFuncContext) {
  ctx.sse.send("token", { text: "Hello" });
  ctx.sse.send({ event: "token", data: { text: " world" } });
  return { ok: true };
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

Func-generated files can be uploaded with `ctx.assets`. Both URL fields are
provided for compatibility and contain the same value; internal storage paths
are not exposed:

```ts
const asset = ctx.assets.upload({ filename, mimeType, base64 });
// { fileUrl: string, url: string, size: number }
```

Transactional email and email verification codes are available through
`ctx.email` once an email integration is connected for the project. The provider
credential stays on the server, so Func code never holds an API key:

```ts
export function send(input: { email: string }, ctx: TalizenFuncContext) {
  ctx.email.sendCode({ to: input.email, scene: "login" });
  return { ok: true };
}

export function verify(input: { email: string; code: string }, ctx: TalizenFuncContext) {
  const ok = ctx.email.verifyCode({
    to: input.email,
    scene: "login",
    code: input.code,
  });
  if (!ok) throw new Error("invalid or expired code");
  return { ok: true };
}
```

`ctx.email.send({ to, subject, html })` sends an arbitrary message and returns
`{ id, provider }`. Code length, expiry, per-recipient rate limiting, the
wrong-attempt cap, and single-use consumption are enforced by the platform — do
not reimplement them in Func code. `scene` namespaces codes by purpose, so a
login code and a password-reset code for the same address never collide.

`ctx.auth` covers two different scopes, on two levels. `ctx.auth.currentUser()`,
`requireUser()` and `register()` are about **the caller of this request** —
`register()` signs the visitor up and issues their session. `ctx.users` is a
separate top-level namespace for the **project's user directory**, which can point
at anybody — `ctx.auth.setPassword(...)` would read like "change my password" while
being able to change anyone's.

There is no platform password-reset endpoint. Write the flow in your own Func with
two primitives — send the code with `ctx.email.sendCode`, then:

```ts
export function requestReset(input: { email: string }, ctx: TalizenFuncContext) {
  // Look the user up first, otherwise this form mails arbitrary addresses.
  const user = ctx.users.find({ email: input.email });
  if (user) ctx.email.sendCode({ to: input.email, scene: "reset_password" });
  // Both branches must return the same thing, or this becomes an enumeration oracle.
  return { ok: true };
}

export function confirmReset(
  input: { email: string; code: string; password: string },
  ctx: TalizenFuncContext,
) {
  const ok = ctx.email.verifyCode({
    to: input.email,
    scene: "reset_password",
    code: input.code,
  });
  if (!ok) throw new Error("invalid or expired code");
  // No code or ticket parameter: you verified above, that is the authorization.
  ctx.users.setPassword({ email: input.email, password: input.password });
  return { ok: true };
}
```

`setPassword` hashes with bcrypt and **revokes every session of that user**, the
caller's included — the platform does this because Func code has no access to the
session table and forgetting it leaves a leaked password's sessions alive. The
user ref accepts exactly one of `email`, `account` or `userId`.

A signed-in user changing their own password should confirm the old one, since a
session may be stolen. Point at the user with the id from `requireUser()`, never
one taken from the request body:

```ts
export function changePassword(
  input: { oldPassword: string; password: string },
  ctx: TalizenFuncContext,
) {
  const user = ctx.auth.requireUser();
  if (!ctx.users.checkPassword({ userId: user.id, password: input.oldPassword }))
    throw new Error("current password is incorrect");
  ctx.users.setPassword({ userId: user.id, password: input.password });
  return { ok: true }; // sessions are gone, send them to the login page
}
```

`checkPassword` returns false for a wrong password, an unknown user, or an account
that only signs in through a third party. Its failures share the login endpoint's
budget (5 per project+IP+account, one hour), so it is not a way around the login
lockout; once spent it throws 429 instead of returning false.

### Log a user in from Func

`ctx.auth.login(ref)` issues a session for an existing user, which is how a Func
implements sign-in — including passwordless flows that the SDK cannot express:

```ts
// Sign in with an emailed code: no password involved
export function loginWithCode(
  input: { email: string; code: string },
  ctx: TalizenFuncContext,
) {
  const user = ctx.users.find({ email: input.email });
  if (!user) throw new Error("the code is wrong or has expired");
  if (!ctx.email.verifyCode({ to: input.email, scene: "login", code: input.code }))
    throw new Error("the code is wrong or has expired");

  // Point at the user the server just resolved — never at input.email directly
  return ctx.auth.login({ userId: user.id });
}

// Password sign-in with your own extra rules
export function login(
  input: { account: string; password: string },
  ctx: TalizenFuncContext,
) {
  if (!ctx.users.checkPassword({ account: input.account, password: input.password }))
    throw new Error("wrong account or password");
  const user = ctx.users.find({ account: input.account })!;
  if (ctx.db.get("banned", user.id)) throw new Error("this account is suspended");
  return ctx.auth.login({ userId: user.id });
}
```

`login` takes no password and no code: your code decides. It throws 404 for an
unknown user and 403 for a disabled one, and the platform records every session it
issues together with the Func file that issued it, visible to the site owner in the
editor. Direct `useAuth().login()` keeps working — the two coexist.

`ctx.db`, `ctx.cache`, `ctx.auth`, `ctx.verify`, `ctx.assets`, `ctx.email`, `ctx.request`, and `ctx.cookies` are injected by the Talizen Func runtime. `talizen/func-runtime` is a type-only authoring module; do not import runtime values from it.

`ctx.request` exposes Fetch-style one-shot body readers. Use `await ctx.request.text()` when a webhook signature must be verified against the exact request bytes, `await ctx.request.json()` for parsed JSON, or `await ctx.request.arrayBuffer()` for binary input. JSON, form-encoded, text, and binary POST bodies reach Func; non-JSON requests receive `{}` as `input` while their exact bytes remain available through `ctx.request`. Reading the body sets `ctx.request.bodyUsed`; a second read rejects. `ctx.response.status(code)` sets the actual HTTP response status (100-599), including statuses returned when a Func throws after setting the status. The runtime also provides `TextEncoder`, Base64 helpers, and Web Crypto algorithms used by webhook verification, including HMAC and RSA2.

Ordinary Func returns produce `{ result: ... }` or `{ error: ... }`; `invoke()` unwraps successful results. Return the global Web-compatible `Response` when an HTTP caller requires an exact status, content type, headers, or body. This bypasses the JSON envelope:

```ts
export async function webhook(_input, ctx) {
  await verifyWebhook(await ctx.request.text());
  return new Response("success"); // 200, text/plain;charset=UTF-8
}
```

Use native `fetch()` rather than `invoke()` when calling a Func method that returns a `Response`.
The constructor is a runtime global and does not need an import. For explicit
annotations, `talizen/func-runtime` exports the type-only `Response` and
`ResponseInit` aliases.

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
