// Behavioral test for the pre-initialization `loading` semantics of useAuth.
//
// Replays the redirect-loop scenario: a consumer guard `if (!loading && !user)
// redirect` must NOT fire in the window before the first /auth/me resolves.
//
// Run: npm run build && node scripts/test-auth-loading.mjs
// (jsdom and react-dom are test-only deps: npm i --no-save jsdom react-dom)

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.test.local/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default ?? (await import("react"));
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");

let failures = 0;
const assert = (cond, label) => {
  console.log(cond ? "  ✓" : "  ✗ FAIL", label);
  if (!cond) failures++;
};

// deferred /auth/me stub
function makeFetchStub() {
  const pending = [];
  const stub = async (url, init) => {
    if (String(url).includes("/auth/me")) {
      return new Promise((resolve) => {
        pending.push((user) =>
          resolve(new Response(JSON.stringify(user), { status: 200, headers: { "content-type": "application/json" } }))
        );
      });
    }
    throw new Error("unexpected request: " + url);
  };
  return { stub, resolveMe: (user) => pending.splice(0).forEach((fn) => fn(user)) };
}

// auth state is isolated per case via a cache-busting query; the plain
// ../dist/core.js import below is the SAME instance auth.js?case=N resolves
// internally (its relative "./core.js" carries no query), so config set here
// is visible to the auth module under test.
const core = await import("../dist/core.js");

async function runCase(caseId, meResult, expectRedirect) {
  console.log(`case ${caseId}: /auth/me → ${meResult ? "user" : "null"}`);
  const auth = await import(`../dist/auth.js?case=${caseId}`);
  const { stub, resolveMe } = makeFetchStub();
  core.setTalizenConfig({ baseUrl: "https://app.test.local", fetch: stub });

  const snapshots = [];
  const redirects = [];

  function Probe() {
    const { user, loading, isInitialized } = auth.useAuth();
    snapshots.push({ user, loading, isInitialized });
    React.useEffect(() => {
      // the naive consumer guard that used to redirect-loop
      if (!loading && !user) redirects.push("→ /login");
    }, [loading, user]);
    return null;
  }

  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(Probe));
  });

  const first = snapshots[0];
  assert(first.loading === true, "first render: loading === true (pre-init window)");
  assert(first.isInitialized === false, "first render: isInitialized === false");
  assert(redirects.length === 0, "naive guard did NOT fire while state unknown");

  await act(async () => {
    resolveMe(meResult);
  });

  const last = snapshots[snapshots.length - 1];
  assert(last.loading === false, "after /auth/me: loading === false");
  assert(last.isInitialized === true, "after /auth/me: isInitialized === true");
  assert(last.loading === !last.isInitialized, "invariant: loading === !isInitialized");
  if (expectRedirect) {
    assert(redirects.length === 1, "guard fired exactly once for a genuinely signed-out visitor");
    assert(last.user === null, "user is null");
  } else {
    assert(redirects.length === 0, "guard never fired for a signed-in visitor");
    assert(last.user?.account === meResult.account, "user resolved");
  }

  await act(async () => {
    root.unmount();
  });
}

// case 1: visitor is signed out → guard fires only AFTER init resolves
await runCase(1, null, true);
// case 2: visitor is signed in → guard never fires
await runCase(2, { id: "u1", account: "demo", name: "Demo" }, false);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
