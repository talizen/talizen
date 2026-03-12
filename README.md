# talizen

Talizen 前端 SDK 类型仓库，统一提供：

- `talizen/core`
- `talizen/cms`
- `talizen/form`

这个仓库的目标是把 Talizen 平台前端会直接使用的类型和最小运行时请求封装整理成一个可以独立发布到 GitHub 和 npm 的包。

## 安装

```bash
npm install talizen
```

## 使用

```ts
import { setTalizenConfig } from "talizen/core"
import { ListContent, type BaseCmsItem } from "talizen/cms"

interface Blogs extends BaseCmsItem {
  readonly __cmsKey: "blogs"
  body: {
    title?: string
    content?: string
  }
}

setTalizenConfig({
  baseUrl: "https://www.talizen.com",
  projectId: "demo-project",
})

const blogs = await ListContent<Blogs>("blogs", {
  limit: 10,
})
```

表单提交：

```ts
import { SubmitForm } from "talizen/form"

await SubmitForm(
  {
    token: "form-token",
    data: {
      email: "hi@talizen.com",
    },
  },
  {
    projectId: "demo-project",
  },
)
```

## 类型设计

- `talizen/core`：通用基础类型，来自后端 `internal/model`。
- `talizen/cms`：CMS schema、content、筛选参数、获取内容 API。
- `talizen/form`：Form schema、提交参数、日志类型、提交 API。

其中业务项目自己的 `types/cms.d.ts`、`types/form.d.ts` 依然建议由平台按项目 schema 动态生成；本仓库负责承载平台级公共类型和泛型 API。

## 发布

```bash
npm install
npm run build
npm publish
```

GitHub Actions 工作流在 `.github/workflows/publish.yml`，按 tag 发布 npm 包：

```bash
git tag v0.1.0
git push origin v0.1.0
```
