# talizen

Talizen's frontend SDK package. It provides a small runtime client and shared types for:

- `talizen/core`
- `talizen/cms`
- `talizen/form`

The package is designed to hold the platform-level APIs that frontend projects use directly, while project-specific CMS and form schema types can still be generated separately per project.

## Install

```bash
npm install talizen
```

## Usage

### Configure the client

```ts
import { setTalizenConfig } from "talizen/core"

setTalizenConfig({
  baseUrl: "https://www.talizen.com",
  onFileUploadProcess(key, process) {
    console.log(key, process)
  },
})
```

### List CMS content

```ts
import { listContents, type BaseCmsItem } from "talizen/cms"

interface Blog extends BaseCmsItem {
  readonly __cmsKey: "blogs"
  body: {
    title?: string
    content?: string
  }
}

const result = await listContents<Blog>("blogs", {
  limit: 10,
  orderBy: "-created_at",
})

console.log(result.list)
console.log(result.total)
```

### Get a single CMS content item

```ts
import { getContent, type BaseCmsItem } from "talizen/cms"

interface Blog extends BaseCmsItem {
  readonly __cmsKey: "blogs"
  body: {
    title?: string
  }
}

const blog = await getContent<Blog>("blogs", "hello-world")
```

### Get CMS collection metadata

```ts
import { getContentCollection } from "talizen/cms"

const collection = await getContentCollection("blogs")

console.log(collection?.title)
console.log(collection?.jsonSchema)
```

### Submit a form

```ts
import { submitForm } from "talizen/form"

await submitForm("contact-form", {
  email: "hi@talizen.com",
  message: "Hello from the website",
})
```

When a `File` object appears in the payload, `submitForm()` will:

1. Call `POST /form/:key/file/preupload`
2. If `hash_exist` is `false`, upload the file to the returned S3 signed URL
3. Replace the original `File` value with the returned `file_url`
4. Submit the final payload to `/form/:key/submit`

## Package Layout

- `talizen/core`: shared runtime config, request helpers, and base data types.
- `talizen/cms`: CMS content types and content query APIs.
- `talizen/form`: form submission helpers and related types.

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
