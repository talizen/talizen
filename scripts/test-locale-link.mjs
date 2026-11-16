// Behavioral test: a language switch <Link href={getLocalePath()} locale> must hydrate without
// mismatch when the page URL has a query, and keep the query / hash after hydration.
//
// Run: npm run build && node scripts/test-locale-link.mjs
// (jsdom and react-dom are test-only deps: npm i --no-save jsdom react-dom)

import { JSDOM } from "jsdom";

let failures = 0;
const assert = (cond, label) => {
  console.log(cond ? "  ✓" : "  ✗ FAIL", label);
  if (!cond) failures++;
};

const React = (await import("react")).default ?? (await import("react"));
const { renderToString } = await import("react-dom/server");
const { Link, getLocalePath } = await import("../dist/index.js");

const i18n = { locale: "zh", locales: ["en", "zh"], defaultLocale: "en" };
globalThis.TalizenConfig = { i18n, pathname: "/blog" };

const App = () =>
  React.createElement(
    "nav",
    null,
    React.createElement(Link, { href: getLocalePath(), locale: "en", id: "same" }, "EN"),
    React.createElement(Link, { href: "/", locale: "en", id: "other" }, "Home EN"),
  );

// 1. SSR: no window, no query.
const html = renderToString(React.createElement(App));
console.log("SSR");
assert(html.includes('href="/blog"'), "same-page switch renders path only on the server");

// 2. Browser with a query + hash: hydrate the SSR markup.
const dom = new JSDOM(`<!doctype html><html><body><div id="root">${html}</div></body></html>`, {
  url: "https://site.test/zh/blog?utm_source=x#faq",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.TalizenConfig = globalThis.TalizenConfig;

const { act } = await import("react");
const { hydrateRoot } = await import("react-dom/client");
const errors = [];
const origError = console.error;
console.error = (...args) => errors.push(args.join(" "));
await act(async () => {
  hydrateRoot(document.getElementById("root"), React.createElement(App), {
    onRecoverableError: (e) => errors.push(String(e)),
  });
});
console.error = origError;

console.log("hydrate");
assert(getLocalePath() === "/blog", "getLocalePath() is the same on server and client");
assert(!errors.some((e) => /hydrat|did not match|didn't match/i.test(e)), "no hydration mismatch" + (errors.length ? `: ${errors[0].slice(0, 200)}` : ""));
assert(document.getElementById("same").getAttribute("href") === "/blog?utm_source=x#faq", "same-page switch keeps query + hash after hydration");
assert(document.getElementById("other").getAttribute("href") === "/", "switch to another page does not get this page's query");

if (failures) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
