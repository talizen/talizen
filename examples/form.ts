import { SubmitForm } from "../src/form/index.js"
import { setTalizenConfig } from "../src/core/index.js"

setTalizenConfig({
  baseUrl: "https://www.talizen.com",
})

void SubmitForm({
  token: "demo-token",
  data: {
    email: "hi@talizen.com",
    content: "hello",
  },
})
