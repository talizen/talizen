import { listContents, type BaseCmsItem } from "../src/cms/index.ts"
import { setTalizenConfig } from "../src/core/index.ts"

interface Authors extends BaseCmsItem {
  readonly __cmsKey: "authors"
  body: {
    name?: string
    avatar?: string
  }
}

interface Blogs extends BaseCmsItem {
  readonly __cmsKey: "blogs"
  body: {
    title?: string
    content?: string
    author?: Authors
  }
}

setTalizenConfig({
  baseUrl: "https://www.talizen.com",
})

await listContents<Blogs>("blogs", {
  limit: 10,
  searchKey: "talizen",
})

// has error: Argument of type '"blogs"' is not assignable to parameter of type '"authors"'
await listContents<Authors>("blogs", {
  limit: 10,
  searchKey: "talizen",
})
