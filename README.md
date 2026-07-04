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

```ts
import { currentUser, login, logout, register } from "talizen/auth";

await register({
  account: "alice",
  password: "secret",
  name: "Alice",
  email: "hi@talizen.com",
});
await login({ account: "alice", password: "secret" });

const user = await currentUser();
await logout();
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

### Write function runtime code

Func code can use TypeScript and import runtime-only helpers from `talizen/func-runtime`:

```ts
import { auth, db, cache } from "talizen/func-runtime";

export function create(input: { title: string }) {
  const user = auth.requireUser();
  const row = db.insert("book", {
    title: input.title,
    user_id: user.id,
    status: "draft",
  });
  cache.set(`book:${row.id}`, row, 60);
  return { ok: true, id: row.id };
}
```

`db`, `cache`, and Func `auth` are injected by the Talizen Func runtime. They are typed in this package for authoring, but they are not browser/Node general-purpose APIs.

## Package Layout

- `talizen/core`: shared runtime config, request helpers, and base data types.
- `talizen/auth`: project user register, login, logout, and current user helpers.
- `talizen/cms`: CMS content types and content query APIs.
- `talizen/form`: form submission helpers and related types.
- `talizen/func`: custom function invocation helpers such as `invoke`.
- `talizen/func-runtime`: Func-runtime-only `db`, `cache`, and `auth` types.

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
