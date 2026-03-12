import { ListContent, type BaseCmsItem } from "../src/cms/index.js"
import { setTalizenConfig } from "../src/core/index.js"

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
  projectId: "demo-project",
})

void ListContent<Blogs>("blogs", {
  limit: 10,
  searchKey: "talizen",
})
