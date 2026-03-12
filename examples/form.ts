import { submitForm } from "../src/form/index.js"
import { setTalizenConfig } from "../src/core/index.js"

setTalizenConfig({
  baseUrl: "https://www.talizen.com",
})

void submitForm("demo-token", {
  email: "hi@talizen.com",
  content: "hello",
})
