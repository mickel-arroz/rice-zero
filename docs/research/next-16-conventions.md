# Next.js 16.3.2 + React 19.2.8 App Router — actual conventions

## How to use this doc

Every claim below was derived from the documentation **bundled inside the installed package** at
`node_modules/next/dist/docs/` (444 files), plus, where the docs were ambiguous or self-contradictory,
the compiled implementation under `node_modules/next/dist/`. Versions verified from
`node_modules/next/package.json` (`"version": "16.3.2"`) and `node_modules/react/package.json`
(`"version": "19.2.8"`).

**The bundled docs are the source of truth over anything you remember or find on the web.** They ship
with the exact installed version. Blog posts, Stack Overflow answers, and model training data about
"Next.js App Router" are overwhelmingly about 13/14/15 and will actively mislead you here. This is the
premise of the repo's own `AGENTS.md`:

> This version has breaking changes — APIs, conventions, and file structure may all differ from your
> training data. Read the relevant guide in `node_modules/next/dist/docs/` … before writing any code.
> Heed deprecation notices.
> — `node_modules/next/dist/docs/01-app/02-guides/ai-agents.md`, "Step 1: Point agents at the bundled docs"

Citations are repo-relative paths plus the heading the claim came from. Below, `docs/` abbreviates
`node_modules/next/dist/docs/`. `02-pages/` is the **legacy Pages Router** and is deliberately not
covered here ("Before Next.js 13, the Pages Router was the main way to create routes… we recommend
migrating to the new App Router" — `docs/02-pages/index.md`). `04-community/` is not covered.

### This repo's current state (checked, not assumed)

`package.json`, `next.config.ts`, `tsconfig.json`, and `eslint.config.mjs` are a stock `create-next-app`
scaffold: `next@16.3.2`, `react@19.2.8`, Tailwind v4 via `@tailwindcss/postcss`, ESLint 9 flat config,
`next.config.ts` exporting an empty `NextConfig`. Two facts that change how you should read §4:

- **`cacheComponents` is NOT enabled.** The default is `false` — verified in
  `node_modules/next/dist/server/config-shared.js`, `defaultConfig` (`cacheComponents: false`). This
  project is therefore on the **previous caching model**, documented at
  `docs/01-app/02-guides/caching-without-cache-components.md`. Much of the newest documentation assumes
  the flag is on; do not copy `use cache` snippets without enabling it first.
- **`typedRoutes` is NOT enabled** (`config-shared.js`, `defaultConfig`: `typedRoutes: false`).

`scripts.dev` is `next dev` with no `--turbopack` — correct, that is the default now.
`next-env.d.ts` already imports `./.next/types/routes.d.ts` and `./.next/types/root-params.d.ts`.

---

# Breaking changes / things you probably remember wrong

Ordered roughly by how likely you are to write the wrong thing from memory.

### 1. `middleware.ts` is now `proxy.ts`

**You expect:** `middleware.ts` at the project root exporting `export function middleware(request) {}`.

**It actually is:** `proxy.ts` (or `.js`), exporting a function named `proxy` (or a default export — the
docs recommend naming it `proxy` either way).

> The `middleware.js` file convention has been **deprecated** in Next.js 16 and renamed to `proxy.js`.
> All functionality remains the same — only the file and export names have changed.
> — `docs/01-app/03-api-reference/03-file-conventions/middleware.md`

Config flags containing "middleware" are renamed too: `skipMiddlewareUrlNormalize` →
`skipProxyUrlNormalize` (`docs/01-app/02-guides/upgrading/version-16.md`, "`middleware` to `proxy`").
The runtime is now fixed and unconfigurable:

> Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy
> files. Setting the `runtime` config option in Proxy will throw an error.
> — `docs/01-app/03-api-reference/03-file-conventions/proxy.md`, "Runtime"

The project-structure table lists `proxy.ts`, not `middleware.ts`, among top-level files
(`docs/01-app/01-getting-started/02-project-structure.md`, "Top-level files").
Codemod: `npx @next/codemod@canary middleware-to-proxy .`

### 2. `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are async — sync access is **removed**, not deprecated

**You expect:** Next 15's grace period, where `const { slug } = params` still worked with a warning.

**It actually is:** gone.

> Version 15 introduced Async Request APIs as a breaking change, with **temporary** synchronous
> compatibility. Starting with **Next.js 16**, synchronous access is fully removed. These APIs can only
> be accessed asynchronously.
> — `docs/01-app/02-guides/upgrading/version-16.md`, "Async Request APIs (Breaking change)"

Covers `cookies`, `headers`, `draftMode`, `params` in `layout.js`/`page.js`/`route.js`/`default.js`/
`opengraph-image`/`twitter-image`/`icon`/`apple-icon`, and `searchParams` in `page.js`. See §3.

### 3. `revalidateTag` now takes **two** arguments

**You expect:** `revalidateTag('posts')`.

**It actually is:** `revalidateTag(tag, profile)` — the second argument is required by the type.
Verified in `node_modules/next/dist/server/web/spec-extension/revalidate.d.ts`:

```ts
export declare function revalidateTag(tag: string, profile: string | CacheLifeConfig): undefined;
```

> The single-argument form `revalidateTag(tag)` is deprecated. It currently works if TypeScript errors
> are suppressed, but this behavior may be removed in a future version.
> — `docs/01-app/03-api-reference/04-functions/revalidateTag.md`, "Parameters"

Use `revalidateTag('posts', 'max')` for stale-while-revalidate. For read-your-own-writes inside a
Server Action, use the new `updateTag('posts')` instead.

### 4. `error.tsx` gets `retry`, not (primarily) `reset`

**You expect:** `export default function Error({ error, reset })`.

**It actually is:** `{ error, retry }` in every current example.

```tsx
// app/dashboard/error.tsx
'use client' // Error boundaries must be Client Components

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}
```

`reset` still exists but is demoted: "In most cases, you should use `retry()` instead. However, if you
have a specific reason to clear the error state and re-render the error boundary's children **without
re-fetching** the contents, you can use the `reset()` function."
(`docs/01-app/03-api-reference/03-file-conventions/error.md`, "Props → `reset`"). Version History in
that file: `v16.3.0` `retry` became stable; `v16.2.0` `unstable_retry` added.

### 5. `next lint` is removed; `next build` no longer lints

> Starting with Next.js 16, `next lint` is removed. As part of the removal, the `eslint` option in your
> Next config file is no longer needed and can be safely removed.
> — `docs/01-app/03-api-reference/05-config/03-eslint.md`

> Starting with Next.js 16, `next build` no longer runs the linter automatically.
> — `docs/01-app/01-getting-started/01-installation.md`, "Set up linting"

`@next/eslint-plugin-next` now defaults to ESLint **flat config**
(`docs/01-app/02-guides/upgrading/version-16.md`, "ESLint Flat Config"). This repo already has the
correct `eslint.config.mjs` and a `"lint": "eslint"` script.
Codemod: `npx @next/codemod@canary next-lint-to-eslint-cli .`

### 6. Turbopack is the default bundler for `dev` **and** `build`

**You expect:** to add `--turbopack` to your scripts.

**It actually is:** unnecessary, and a `webpack` config now **fails** `next build`.

> Starting with **Next.js 16**, Turbopack is stable and used by default with `next dev` and `next build`
> … If your project has a custom `webpack` configuration and you run `next build` (which now uses
> Turbopack by default), the build will **fail** to prevent misconfiguration issues.
> — `docs/01-app/02-guides/upgrading/version-16.md`, "Turbopack by default"

Opt out with `next build --webpack`. Turbopack config is now the **top-level** `turbopack` key, not
`experimental.turbopack` (same doc, "Turbopack configuration location"). `next dev` output moved to
`.next/dev`, so dev and build can run concurrently, and a lockfile prevents two `next dev` instances on
the same project (same doc, "Concurrent `dev` and `build`"). Turbopack filesystem caching is on by
default for both dev and build (`docs/01-app/03-api-reference/05-config/01-next-config-js/turbopackFileSystemCache.md`,
Version History: `v16.3.0` "FileSystem caching is enabled by default for builds").

### 7. The route segment config exports you know are mostly gone from the API reference

**You expect:** `export const dynamic`, `revalidate`, `fetchCache`, `experimental_ppr` as first-class
route segment config.

**It actually is:** the Route Segment Config index documents only **four** options — `dynamicParams`,
`runtime`, `preferredRegion`, `maxDuration`
(`docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md`). There is no
`dynamic.md`, `revalidate.md`, or `fetchCache.md` file. Those three survive only in the legacy guide
`docs/01-app/02-guides/caching-without-cache-components.md` ("Route segment config").

> `v16.0.0` | `dynamic`, `dynamicParams`, `revalidate`, and `fetchCache` **removed when Cache
> Components is enabled**. … `v16.0.0` | `export const experimental_ppr = true` **removed**.
> — same `index.md`, "Version History"

`experimental_ppr` is removed unconditionally. `runtime = 'edge'` and `preferredRegion` are both
deprecated (`runtime.md`: "The Edge Runtime is deprecated. Remove the `runtime` export from your route
files."; `preferredRegion.md`'s title is literally "preferredRegion (deprecated)").

Two **new** segment config exports exist that aren't in that index table: `instant` and `prefetch`, both
Cache-Components-only. See §4.

### 8. PPR is not `experimental.ppr` any more

**You expect:** `experimental: { ppr: true }` plus `export const experimental_ppr = true`.

**It actually is:** the top-level `cacheComponents: true` flag, which subsumes PPR, `dynamicIO`, and
`useCache`. `experimental.dynamicIO` and `experimental.useCache` are **removed**.

> **Next.js 16** removes the experimental **Partial Prerendering (PPR)** flag and configuration options,
> including the route level segment `experimental_ppr`. … you can opt into PPR using the
> `cacheComponents` configuration. … PPR in **Next.js 16** works differently than in **Next.js 15**
> canaries.
> — `docs/01-app/02-guides/upgrading/version-16.md`, "Partial Prerendering (PPR)"

Heed this before flipping the flag: "Enabling `cacheComponents` is not a rename-only change: it can
surface build errors for uncached data outside of `<Suspense>` and requires adopting the Cache
Components model." (same doc, "Removals → `experimental.dynamicIO` and `experimental.useCache`").

### 9. "Full Route Cache" / "Router Cache" / "Data Cache" is no longer the vocabulary

**You expect:** the four-cache mental model (Request Memoization, Data Cache, Full Route Cache, Router
Cache).

**It actually is:** grepping the whole bundled `docs/` tree finds **zero** occurrences of "Full Route
Cache" and **zero** of "Router Cache". "Router Cache" is now **Client Cache**
(`docs/01-app/04-glossary.md`, "Client Cache"). "Data Cache" survives only in legacy/migration prose.
The current model names three stores — prerendered HTML, a shared store, and the browser
(`docs/01-app/01-getting-started/08-caching.md`, "Where cached content is stored") — plus
**Memoization** (`docs/01-app/04-glossary.md`, "Memoization").

### 10. `fetch` is not cached by default

**You expect:** `fetch()` cached indefinitely by default (Next 13/14 behavior).

**It actually is:** opt-in, and has been since 15.

> `fetch` requests are not cached by default and will block the page from rendering until the request is
> complete.
> — `docs/01-app/01-getting-started/06-fetching-data.md`, "With the `fetch` API"

> **Good to know**: Caching is opt-in. Set `cache: 'force-cache'` to cache any request, including `POST`
> and requests that send `authorization` or `cookie` headers.
> — `docs/01-app/03-api-reference/04-functions/fetch.md`, "`options.cache`"

Route Handlers likewise are not cached by default; `GET` opts in via `export const dynamic = 'force-static'`
(`docs/01-app/01-getting-started/15-route-handlers.md`, "Caching").

### 11. `unstable_cacheLife` / `unstable_cacheTag` lost their prefix

`cacheLife` and `cacheTag` are stable — import them plainly from `next/cache`
(`docs/01-app/02-guides/upgrading/version-16.md`, "Caching APIs → cacheLife and cacheTag"). The
`unstable_*` names still exist as aliases in `node_modules/next/cache.d.ts` but should not be used.

### 12. Parallel routes: `default.js` is now required (with two exceptions)

**You expect:** a missing `default.js` in an `@slot` silently renders a 404.

**It actually is:** a build error. **The bundled docs contradict each other here**:
`parallel-routes.md` still says "a `404` is rendered instead"; `default.md` says "an error is returned
for named slots… and requires you to define a `default.js`"; `version-16.md` says "Builds will fail
without them." **Settled from the implementation**,
`node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js` (~lines 426–461):

- A missing `default` for a **named slot** (`@team`) throws `MissingDefaultParallelRouteError` at build
  time…
- …**unless** the slot is inside a catch-all segment (`isInsideCatchAll` — "The catch-all provides
  fallback behavior, so `default.js` is not required") **or** the segment is a leaf with no child routes
  (`isLeafSegment` — "Leaf segments don't need `default.js` because there are no child routes that could
  cause the parallel slot to unmatch").
- The implicit `children` slot never errors; it falls back to a built-in default that triggers
  `notFound()`, or renders `null` for interception routes.

Believe the loader, not `parallel-routes.md`.

### 13. `next/image` defaults changed in ways that silently alter output

All from `docs/01-app/02-guides/upgrading/version-16.md`, "`next/image` changes", unless noted:

| Setting | Was | Now |
| --- | --- | --- |
| `images.minimumCacheTTL` | 60 seconds | **4 hours** (14400) |
| `images.imageSizes` | included `16` | `16` **removed** |
| `images.qualities` | all qualities allowed | **`[75]`** only; out-of-list `quality` coerced to nearest |
| `images.maximumRedirects` | unlimited | **3** |
| local IP optimization | allowed | **blocked**; opt in via `images.dangerouslyAllowLocalIP` |
| local `src` with query string | allowed | requires `images.localPatterns.search` |

Also: the `priority` prop is **deprecated in favor of `preload`**
(`docs/01-app/03-api-reference/02-components/image.md`, "`priority`" — `preload` is a boolean, default
`false`, that inserts a `<link>` in `<head>`). `next/legacy/image` and `images.domains` are deprecated.

### 14. `serverRuntimeConfig` / `publicRuntimeConfig` / `next/config` removed; AMP removed

Use environment variables. For values that must be read at **runtime** rather than inlined at build
time, `await connection()` from `next/server` first
(`docs/01-app/02-guides/upgrading/version-16.md`, "Removals → Runtime Configuration"). AMP
(`next/amp`, `useAmp`, `export const config = { amp: true }`, the `amp` config key) is entirely removed
(same doc, "AMP Support").

### 15. `unstable_rootParams` → `next/root-params`, and it is genuinely new

Introduced in **16.3.0** (`docs/01-app/03-api-reference/04-functions/next-root-params.md`, "Version
History"). See §3.

### 16. Scroll behavior override is opt-in now

If you set `scroll-behavior: smooth` on `<html>`, Next.js **no longer** overrides it during navigation.
Add `data-scroll-behavior="smooth"` to `<html>` to restore the old behavior
(`docs/01-app/02-guides/upgrading/version-16.md`, "Scroll Behavior Override").

### 17. Runtime floor moved

Node.js **20.9+** (Node 18 unsupported), TypeScript **5.1+**, browsers Chrome/Edge/Firefox 111+ and
Safari 16.4+ (`docs/01-app/02-guides/upgrading/version-16.md`, "Node.js runtime and browser support";
`docs/03-architecture/supported-browsers.md`).

### 18. `next build` no longer prints bundle sizes

`size` and `First Load JS` removed — "We found these to be inaccurate in server-driven architectures
using React Server Components." (`docs/01-app/02-guides/upgrading/version-16.md`, "Performance
Improvements"). Use Lighthouse or `next experimental-analyze` instead.

### 19. In `next.config.js`, `process.argv` no longer contains `'dev'`

The config file is no longer loaded twice during dev. Check `process.env.NODE_ENV === 'development'` or
the `phase` argument instead (`docs/01-app/02-guides/upgrading/version-16.md`, "`next dev` config
load"). `typegen` and `build` are still visible in `process.argv`.

### 20. `useActionState` comes from `react`; `useFormStatus` from `react-dom`

Every example in the bundled docs imports `useActionState` from `'react'` — never `react-dom`
(`docs/01-app/01-getting-started/10-error-handling.md`, "Server Functions"). `useFormStatus` is the one
that comes from `'react-dom'` (`docs/01-app/02-guides/forms.md`, "Pending states"). The signature is the
three-tuple `const [state, formAction, pending] = useActionState(action, initialState)`.

### 21. `forbidden()` / `unauthorized()` are still experimental

Despite being widely written about, they still require `experimental: { authInterrupts: true }` in
16.3.2 (`docs/01-app/03-api-reference/05-config/01-next-config-js/authInterrupts.md`, frontmatter
`version: canary`; `docs/01-app/03-api-reference/04-functions/forbidden.md` and `unauthorized.md`,
frontmatter `version: experimental`). `notFound()` is stable.

---

# 1. Routing and file conventions

## Files in `app/`

From `docs/01-app/01-getting-started/02-project-structure.md`, "Routing Files":

| File | Extensions | Purpose |
| --- | --- | --- |
| `layout` | `.js` `.jsx` `.tsx` | Layout |
| `page` | `.js` `.jsx` `.tsx` | Page |
| `loading` | `.js` `.jsx` `.tsx` | Loading UI |
| `not-found` | `.js` `.jsx` `.tsx` | Not found UI |
| `error` | `.js` `.jsx` `.tsx` | Error UI |
| `global-error` | `.js` `.jsx` `.tsx` | Global error UI |
| `route` | `.js` `.ts` | API endpoint |
| `template` | `.js` `.jsx` `.tsx` | Re-rendered layout |
| `default` | `.js` `.jsx` `.tsx` | Parallel route fallback page |

Plus, still experimental: `forbidden`, `unauthorized`
(`docs/01-app/03-api-reference/03-file-conventions/forbidden.md`, `unauthorized.md`), and
`global-not-found` behind `experimental: { globalNotFound: true }`
(`docs/01-app/03-api-reference/03-file-conventions/not-found.md`, "`global-not-found.js`
(experimental)"). Root-level files: `proxy.ts`, `instrumentation.ts`, `instrumentation-client.ts`,
`mdx-components.tsx`.

Component hierarchy, outermost first
(`docs/01-app/01-getting-started/02-project-structure.md`, "Component hierarchy"):
`layout.js` → `template.js` → `error.js` → `loading.js` → `not-found.js` → `page.js` or nested `layout.js`.

A route is not publicly accessible until it has a `page.js` **or** `route.js`, so colocation inside
`app/` is safe by default (same doc, "Colocation"). `_folder` opts a folder and all subfolders out of
routing (same doc, "Private folders").

## `page.tsx`

Required: a default-exported React component. Optional props `params` and `searchParams`, both Promises.

```tsx
// app/blog/[slug]/page.tsx
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug } = await params
  const { page = '1' } = await searchParams
  return <h1>Blog Post: {slug}</h1>
}
```

(`docs/01-app/03-api-reference/03-file-conventions/page.md`, "Props")

Notes from the same file, "Good to know" and "`searchParams` (optional)":

- A `page` is always the **leaf** of the route subtree.
- Pages are Server Components by default.
- `searchParams` is a plain object, **not** a `URLSearchParams` instance.
- `searchParams` is a Request-time API and opts the page into dynamic rendering.
- In a Client Component page, read either promise with React's `use()`.

Optional exports on a page: `metadata` / `generateMetadata`, `viewport` / `generateViewport`,
`generateStaticParams`, and the four route segment config exports.

## `layout.tsx`

Required: default-exported component accepting `children`. Optional `params` (a Promise). Parallel-route
slots arrive as named props.

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

Rules from `docs/01-app/03-api-reference/03-file-conventions/layout.md`, "Root Layout":

- The `app` directory **must** include a root layout; it **must** define `<html>` and `<body>`.
- Do **not** hand-write `<head>`/`<title>`/`<meta>` — use the Metadata API.
- You can have **multiple root layouts** (any layout with no layout above it). Navigating across them
  causes a **full page load**.
- The root layout can sit under a dynamic segment (e.g. `app/[lang]/layout.js`); those segments are
  **root parameters**, readable via `next/root-params`.

Caveats worth internalizing (same file, "Caveats"): layouts **do not re-render on navigation**, so they
cannot access `searchParams` or `pathname` — read those in a Client Component via `useSearchParams` /
`usePathname`, or in the page via the `searchParams` prop. Layouts cannot pass data to `children`; fetch
the same data in both and rely on `fetch` dedupe or React `cache`.

`loading.js` sits *below* `layout.js` in the hierarchy, so it cannot cover uncached data access inside
the layout itself. Without Cache Components the navigation blocks; with Cache Components you get a
build-time error. Fix by wrapping the runtime access in its own `<Suspense>` (same file, "Interaction
with `loading.js`").

## `template.tsx` vs `layout.tsx`

Templates render **between** a layout and its children and get a unique key, so children remount on
navigation — state resets, effects re-synchronize, DOM is recreated
(`docs/01-app/03-api-reference/03-file-conventions/template.md`, "Behavior"). Precise remount rule:

> Templates receive a unique key for their own segment level. They remount when that segment (including
> its dynamic params) changes. Navigations within deeper segments do not remount higher-level templates.
> **Search params do not trigger remounts.**

`template.js` wraps `error.js`, `loading.js`, `not-found.js`, and `page.js`, but does **not** wrap the
`layout.js` in the same segment.

## `route.ts` (Route Handlers)

Supported methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. Unsupported methods
return `405`. `OPTIONS` is auto-implemented if you don't define it. There **cannot** be a `route.js` at
the same segment level as `page.js`
(`docs/01-app/01-getting-started/15-route-handlers.md`, "Convention"; "Supported HTTP Methods").

```ts
// app/dashboard/[team]/route.ts
import type { NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ team: string }> }
) {
  const { team } = await params
  return Response.json({ team })
}
```

(`docs/01-app/03-api-reference/03-file-conventions/route.md`, "Parameters")

## Route groups, dynamic segments, parallel and intercepting routes

| Pattern | Meaning | Doc |
| --- | --- | --- |
| `(group)` | Organizational; omitted from the URL | `docs/01-app/03-api-reference/03-file-conventions/route-groups.md` |
| `_folder` | Private; opted out of routing entirely | `docs/01-app/01-getting-started/02-project-structure.md`, "Private folders" |
| `[slug]` | Dynamic segment → `string` | `docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` |
| `[...slug]` | Catch-all → `string[]` | same |
| `[[...slug]]` | Optional catch-all → `string[] \| undefined` | same |
| `@slot` | Parallel route named slot, passed as a prop to the parent layout | `docs/01-app/03-api-reference/03-file-conventions/parallel-routes.md`, "Slots" |
| `(.)folder` | Intercept same level | `docs/01-app/03-api-reference/03-file-conventions/intercepting-routes.md`, "Convention" |
| `(..)folder` | Intercept one level above | same |
| `(..)(..)folder` | Intercept two levels above | same |
| `(...)folder` | Intercept from the `app` root | same |

Route group caveats (`route-groups.md`, "Caveats"): navigating between different root layouts triggers a
full page reload; two groups must not resolve to the same URL path; with multiple root layouts and no
top-level `layout.js`, `/` must be defined inside one of the groups.

Parallel route caveats (`parallel-routes.md`, "Slots"): slots are **not** route segments and do not
affect the URL. `children` is an implicit slot — `app/page.js` is equivalent to `app/@children/page.js`.
And: "you cannot have separate prerendered and dynamically rendered slots at the same route segment
level. If one slot is dynamic, all slots at that level must be dynamic."

Intercepting-route gotcha (`intercepting-routes.md`, "Convention"): "The `(..)` convention is based on
_route segments_, not the file-system. For example, it does not consider `@slot` folders." So in the
canonical modal pattern, `photo` is one segment level up even though it's two directories up.

`default.tsx` receives an optional `params` Promise and is the fallback for a slot whose active state
can't be recovered on a hard navigation
(`docs/01-app/03-api-reference/03-file-conventions/default.md`). To reproduce the old 404 behavior:

```tsx
// app/@team/default.tsx
import { notFound } from 'next/navigation'

export default function Default() {
  notFound()
}
```

## Route Segment Config (the four that remain)

`docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md`:

| Option | Type | Default |
| --- | --- | --- |
| `dynamicParams` | `boolean` | `true` |
| `runtime` | `'nodejs' \| 'edge' (deprecated)` | `'nodejs'` |
| `preferredRegion` | `'auto' \| 'global' \| 'home' \| string \| string[] (deprecated)` | `'auto'` |
| `maxDuration` | `number` | Set by deployment platform |

`maxDuration` set at the page level also changes the default timeout of all Server Actions used on that
page (`maxDuration.md`, "Server Actions"). `dynamicParams` "is not available when Cache Components is
enabled" (`dynamicParams.md`, "Good to know"). `runtime` cannot be used in Proxy (`runtime.md`).

Two newer exports, both Cache-Components-only and both absent from the index table:

```tsx
// instant.md — validation that navigations into this segment produce instant UI
type InstantConfig = true | false | { level?: 'warning' }
export const instant: InstantConfig = true
```

```tsx
// prefetch.md — how the segment is prefetched
type Prefetch = 'auto' | 'partial' | 'force-disabled'
export const prefetch: Prefetch = 'partial'
```

Both throw in Client Components. "`'auto'` is the default and is equivalent to omitting the export;
don't write `prefetch = 'auto'` explicitly." (`prefetch.md`, "Good to know")

## `generateStaticParams`

Usable in `page`, `layout`, and `route` files. Returns an array of param objects.

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await fetch('https://.../posts').then((res) => res.json())
  return posts.map((post) => ({ slug: post.slug }))
}
```

From `docs/01-app/03-api-reference/04-functions/generate-static-params.md`, "Good to know": it replaces
`getStaticPaths`; during `next build` it runs before the corresponding layouts/pages; during
revalidation it is **not** called again. With Cache Components, returning an empty array now **errors**
(`docs/01-app/02-guides/migrating-to-cache-components.md`, "`generateStaticParams` must return at least
one param").

---

# 2. Server Components vs Client Components

Layouts and pages are Server Components by default
(`docs/01-app/01-getting-started/05-server-and-client-components.md`, intro). `'use client'` at the top
of a file declares a boundary:

> Once a file is marked with `"use client"`, **all of its imports and the components it directly renders
> are included in the client bundle**. This means you don't need to add the directive to every component
> that is intended for the client.
>
> This behavior applies to components that are part of the Client Component's module graph… It does not
> apply to **Server Components passed as children or other props**. Those components are not imported
> into the Client Component's module graph. They are rendered on the server and passed to the Client
> Component as rendered output.
> — same doc, "Using Client Components"

Props crossing the boundary must be serializable; "❌ Function is not serializable"
(`docs/01-app/03-api-reference/01-directives/use-client.md`, "Usage").

Client-only hooks that come from `next/navigation` (verified against
`node_modules/next/dist/client/components/navigation.d.ts`): `useRouter`, `usePathname`,
`useSearchParams`, `useParams`, `useSelectedLayoutSegment`, `useSelectedLayoutSegments`. The same module
also re-exports the server-side control-flow functions: `notFound`, `forbidden`, `unauthorized`,
`redirect`, `permanentRedirect`, `RedirectType`, `unstable_rethrow`.

Use `next/root-params` (§3) for values above the root layout, instead of prop-drilling.

---

# 3. Async request APIs

**All of these are async. There is no synchronous fallback.**

| API | Import | Signature |
| --- | --- | --- |
| `cookies()` | `next/headers` | `Promise<ReadonlyRequestCookies>` |
| `headers()` | `next/headers` | `Promise<Headers>` (read-only) |
| `draftMode()` | `next/headers` | `Promise<{ isEnabled, enable(), disable() }>` |
| `params` | prop | `Promise<{ … }>` in `page`/`layout`/`route`/`default` |
| `searchParams` | prop | `Promise<{ [key: string]: string \| string[] \| undefined }>` in `page` only |
| `connection()` | `next/server` | `Promise<void>` |
| `io()` | `next/cache` | `Promise<void>` (new in 16.3.0) |

```tsx
import { cookies, headers, draftMode } from 'next/headers'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug } = await params
  const { q } = await searchParams
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')
  const userAgent = (await headers()).get('user-agent')
  const { isEnabled } = await draftMode()
  // …
}
```

In a Client Component (which cannot be `async`), read the promise with React's `use()`:

```tsx
'use client'
import { use } from 'react'

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
}
```

(`docs/01-app/03-api-reference/03-file-conventions/page.md`, "Reading `searchParams` and `params` in
Client Components")

### `cookies()` rules

`docs/01-app/03-api-reference/04-functions/cookies.md`, "Good to know" and "Understanding Cookie
Behavior in Server Components":

- Reading works in Server Components. **Setting does not** — "HTTP does not allow setting cookies after
  streaming starts, so you must use `.set` in a Server Function or Route Handler."
- `.delete` only in a Server Function or Route Handler, same domain and protocol as the `.set`.
- Methods: `get`, `getAll`, `has`, `set(name, value, options)`, `delete`, `toString`.
- Options: `name`, `value`, `expires`, `maxAge`, `domain`, `path` (default `'/'`), `secure`, `httpOnly`,
  `sameSite`, `priority`, `partitioned`. "The only option with a default value is `path`."

### `headers()` rules

Read-only Web `Headers`. Cannot `set` or `delete` outgoing headers
(`docs/01-app/03-api-reference/04-functions/headers.md`, "Good to know").

### `draftMode()` and caching directives

`isEnabled` **is** readable inside a `use cache` scope; `cookies()`/`headers()` are not. Calling
`enable()`/`disable()` inside a cached scope throws. When Draft Mode is on, cached functions re-execute
every request and results are not saved
(`docs/01-app/03-api-reference/04-functions/draft-mode.md`, "Good to know").

### `next/root-params` (new in 16.3.0)

Async getters named after your dynamic segment folders **above the root layout**, callable from any
Server Component without prop drilling.

```tsx
// app/[lang]/layout.tsx
import { lang } from 'next/root-params'

export default async function RootLayout(props: LayoutProps<'/[lang]'>) {
  return (
    <html lang={await lang()}>
      <body>{props.children}</body>
    </html>
  )
}
```

Constraints from `docs/01-app/03-api-reference/04-functions/next-root-params.md`, "Restrictions":

- Server Components only. **Not** in Client Components, **not** in Server Actions, **not** in Route
  Handlers (planned for a future release).
- **Not** available inside `unstable_cache` (throws) — use `'use cache'` instead.
- Segment names must be valid JS identifiers; `[post-slug]` errors.
- Return types: `[id]` → `string`; `[...path]` → `string[]`; `[[...path]]` → `string[] | undefined`.
  With multiple root layouts, a param absent from one of them is typed `string | undefined`.
- You do not need `import 'server-only'` — "The import already fails at build time if used in a Client
  Component."
- Only the root params a cached function **actually reads** join its cache key (same doc, "Behavior with
  caching directives").

---

# 4. Data fetching and caching

## Which model is this repo on?

There are two, and the docs interleave them.

- **Previous model (this repo's current state, `cacheComponents: false`).** Documented at
  `docs/01-app/02-guides/caching-without-cache-components.md`, whose first line is: "This guide assumes
  you are **not** using Cache Components which was introduced in version 16 under the `cacheComponents`
  flag." Here you still use `fetch` options, `unstable_cache`, and the `dynamic`/`revalidate`/`fetchCache`
  segment configs.
- **Cache Components (`cacheComponents: true`).** `use cache`, `cacheLife`, `cacheTag`, PPR by default,
  `instant`/`prefetch` segment exports. The `dynamic`/`revalidate`/`fetchCache` exports **error** once the
  flag is on (`docs/01-app/02-guides/migrating-to-cache-components.md`, "Enable Cache Components").

Common to both: **`fetch` is not cached by default**, and Route Handler `GET` is not cached by default.

## Previous model — `fetch` options

`docs/01-app/03-api-reference/04-functions/fetch.md`:

```ts
await fetch('https://…', { cache: 'force-cache' })          // or 'no-store'
await fetch('https://…', { next: { revalidate: 3600 } })     // false | 0 | number (seconds)
await fetch('https://…', { next: { tags: ['collection'] } }) // max 128 tags, 256 chars each
```

- Default is `auto no cache`: fetched on every request in dev, once during `next build` for a
  prerendered route, and on every request if Request-time APIs are detected.
- Only `200` responses are stored under `force-cache`.
- Conflicting options like `{ revalidate: 3600, cache: 'no-store' }` "are not allowed, both will be
  ignored, and in development mode a warning will be printed."
- Identical `GET` fetches are **memoized** per render pass, but "Memoization does not apply in Route
  Handlers, since they are not part of the React component tree."
- **None of these are marked deprecated.** `fetch.md`'s Version History lists only `v13.0.0`.

`unstable_cache` for non-`fetch` work (`docs/01-app/02-guides/caching-without-cache-components.md`,
"`unstable_cache` for non-`fetch` functions"):

```ts
import { unstable_cache } from 'next/cache'

export const getCachedUser = unstable_cache(
  async (id: string) => db.select().from(users).where(eq(users.id, id)).then((r) => r[0]),
  ['user'],                        // cache key prefix
  { tags: ['user'], revalidate: 3600 }
)
```

Its own doc carries a banner: "This API has been replaced by `use cache` in Next.js 16."
(`docs/01-app/03-api-reference/04-functions/unstable_cache.md`). **But** — a real inconsistency inside
the bundled docs — `use-cache.md` ("Runtime caching considerations") and `use-cache-remote.md`
("Persistence across deploys") both still direct you to `unstable_cache` or the `fetch` cache for data
that must **persist across deploys**, because `use cache` entries never do (their key includes the build
id). So `unstable_cache` is "replaced" yet remains the documented answer for one job.

## Previous model — segment config

```tsx
export const dynamic = 'auto' // 'auto' | 'force-dynamic' | 'error' | 'force-static'
export const revalidate = false // false | 0 | number
export const fetchCache = 'auto' // 'auto' | 'default-cache' | 'only-cache' | 'force-cache' | 'force-no-store' | 'default-no-store' | 'only-no-store'
```

(`docs/01-app/02-guides/caching-without-cache-components.md`, "Route segment config"). `force-static`
forces `cookies()`, `headers()`, and `useSearchParams()` to return empty values.

## Cache Components — `use cache`

Requires `cacheComponents: true`. The function or component must be `async`.

```ts
// next.config.ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { cacheComponents: true }
export default nextConfig
```

```tsx
// File level — caches all exports in the file
'use cache'
export default async function Page() { /* … */ }

// Component level
export async function MyComponent() {
  'use cache'
  return <></>
}

// Function level
export async function getData() {
  'use cache'
  return (await fetch('/api/data')).json()
}
```

(`docs/01-app/03-api-reference/01-directives/use-cache.md`, "Usage")

**Cache keys** (same file, "Cache keys") are built from: build ID (or `deploymentId`), a hash of the
function's location and signature, serializable arguments, and — in dev — an HMR refresh hash. Variables
captured from outer scope are bound as arguments and become part of the key.

**Serialization** (same file, "Serialization"): arguments use React **Server Component** serialization
(more restrictive); return values use **Client Component** serialization. Supported for both: primitives,
plain objects, arrays, Dates, Maps, Sets, TypedArrays, ArrayBuffers; return values additionally allow JSX
elements. Unsupported: class instances, functions (except as pass-through), symbols, WeakMaps/WeakSets,
`URL` instances.

**The critical constraint** (same file, "Constraints → Request-time APIs"):

> Cached functions and components **cannot** access runtime APIs like `cookies()`, `headers()`, or
> `searchParams`, and the restriction follows the call stack… On a dynamically rendered route this
> surfaces when the route runs, so it **can pass `next build` and fail under `next start`**. Read these
> values outside the cached scope and pass them as arguments.

Passing a runtime-data *promise* into a cached scope instead hangs the build, timing out after 50 seconds
(same file, "Troubleshooting → Build Hangs (Cache Timeout)").

Two variants:

- **`'use cache: private'`** — allows `cookies()`, `headers()`, `searchParams` inside the cached scope,
  but the result is **never stored on the server**; it lives only in that browser's memory and does not
  survive a reload. `connection()` is still prohibited. Not available in Route Handlers.
  (`docs/01-app/03-api-reference/01-directives/use-cache-private.md`)
- **`'use cache: remote'`** — stores the entry in a durable cache handler shared across instances. Costs
  a network roundtrip; the docs say it pays off "only at a high hit rate". Cannot nest inside
  `'use cache: private'` and vice versa. Does **not** persist across deploys.
  (`docs/01-app/03-api-reference/01-directives/use-cache-remote.md`)

Named handlers can be defined via `cacheHandlers` and referenced as `'use cache: <name>'`
(`docs/01-app/03-api-reference/05-config/01-next-config-js/cacheHandlers.md`, "Handler types").

## `cacheLife` and `cacheTag`

Both from `next/cache`. `cacheLife` must be called **inside** a cache directive scope, never at module
scope, and only once per invocation.

```ts
import { cacheLife, cacheTag } from 'next/cache'

export async function getPost(id: string) {
  'use cache'
  cacheTag(`post-${id}`)          // 1+ strings; ≤128 tags per call, ≤256 chars each
  cacheLife('hours')              // preset or custom profile name
  // or: cacheLife({ stale: 3600, revalidate: 7200, expire: 86400 })
  return db.post.findUnique({ where: { id } })
}
```

Preset profiles — **verified against the type definitions** in `node_modules/next/cache.d.ts`, which
carry the numeric values in JSDoc, and matching
`docs/01-app/03-api-reference/04-functions/cacheLife.md`, "Preset cache profiles":

| Profile | `stale` | `revalidate` | `expire` |
| --- | --- | --- | --- |
| `default` | 5 minutes | 15 minutes | never |
| `seconds` | 30 seconds | 1 second | 1 minute |
| `minutes` | 5 minutes | 1 minute | 1 hour |
| `hours` | 5 minutes | 1 hour | 1 day |
| `days` | 5 minutes | 1 day | 1 week |
| `weeks` | 5 minutes | 1 week | 30 days |
| `max` | 5 minutes | 30 days | never (docs page says 1 year) |

> Note the one discrepancy: `cacheLife.md`'s table says `max`'s `expire` is "1 year", while
> `node_modules/next/cache.d.ts`'s JSDoc for `cacheLife('max')` says `expire: never` and
> `config-shared.js` uses `INFINITE_CACHE`. Trust the implementation.

Prerendering thresholds (`cacheLife.md`, "Prerendering behavior"): `revalidate: 0` or `expire` under
5 minutes → excluded from prerenders; `stale` under 30 seconds → excluded from prerenders; `stale`
between 30s and 5m → in the prerender but out of the App Shell. Of the presets, only `seconds` trips any
threshold. The client router enforces a **minimum 30-second stale time** regardless of config
(`use-cache.md`, "`use cache` at runtime").

Custom profiles:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    biweekly: { stale: 60 * 60 * 24 * 14, revalidate: 60 * 60 * 24, expire: 60 * 60 * 24 * 14 },
  },
}
```

Omitted properties inherit from `default`. You may also **override** built-in profiles including
`default` and `max` (`cacheLife.md`, "Overriding the default cache profiles"). `expire` must be longer
than `revalidate` or Next.js errors.

## Revalidation: which API, where

| API | Import | Signature | Legal in |
| --- | --- | --- | --- |
| `revalidateTag` | `next/cache` | `(tag: string, profile: string \| { expire?: number }) => void` | Server Actions, Route Handlers |
| `updateTag` | `next/cache` | `(tag: string) => void` | **Server Actions only** |
| `revalidatePath` | `next/cache` | `(path: string, type?: 'page' \| 'layout') => void` | Server Actions, Route Handlers |
| `refresh` | `next/cache` | `() => void` | **Server Actions only** |

(Signatures verified in `node_modules/next/dist/server/web/spec-extension/revalidate.d.ts`.)

`docs/01-app/01-getting-started/09-revalidating.md`, "`updateTag`" — the decision table:

| | `updateTag` | `revalidateTag` |
| --- | --- | --- |
| **Where** | Server Actions only | Server Actions and Route Handlers |
| **Behavior** | Immediately expires cache | Stale-while-revalidate |
| **Use case** | Read-your-own-writes (user sees their change) | Background refresh (slight delay OK) |

`docs/01-app/02-guides/server-actions.md`, "Choosing a cache update" adds `refresh`: "refetch the
current route's RSC Payload **without** invalidating cached data. Use when the view depends on state
outside the cache that the action just changed."

`revalidatePath` notes (`docs/01-app/03-api-reference/04-functions/revalidatePath.md`): if `path`
contains a dynamic segment (`/product/[slug]`) the `type` argument is **required**; if it's a literal
path, omit it. Don't append `/page` or `/layout` to the path. `revalidatePath('/', 'layout')` purges the
Client Cache and invalidates everything. With rewrites, pass the **destination** path. Prefer tag-based
revalidation — "it's more precise and avoids over-invalidating"
(`docs/01-app/01-getting-started/09-revalidating.md`, "`revalidatePath`").

## `connection()` vs `io()`

Both suspend to exclude what follows from the prerender. `io()` is new in 16.3.0 and is now preferred:

> The `connection()` function excludes the code that follows it from the static shell, but it stays
> suspended until a full user navigation reaches the server, so it also blocks prefetches. `io()`
> suspends like any other asynchronous function, so the code after it can be wrapped in `"use cache"`
> and prefetched and cached on the client. **Prefer `io()` over `connection()`**, and reach for
> `connection()` only when you need to wait for a real user request.
> — `docs/01-app/03-api-reference/04-functions/io.md`, "How `io()` differs from `connection()`"

```tsx
import { Suspense } from 'react'
import { io } from 'next/cache'

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <CurrentTime />
    </Suspense>
  )
}

async function CurrentTime() {
  await io()
  return <p>{new Date().toISOString()}</p>
}
```

Note: `docs/01-app/01-getting-started/08-caching.md` ("Random values and timestamps") still teaches
`connection()` for this; it has not caught up with `io()`.

`unstable_noStore` is deprecated in favor of `connection`
(`docs/01-app/03-api-reference/04-functions/unstable_noStore.md`, frontmatter `version: legacy`).

## What `cacheComponents: true` actually changes

From `docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md` and
`docs/01-app/02-guides/migrating-to-cache-components.md`:

- Enables `use cache`, `use cache: private`, `use cache: remote`, `cacheLife`, `cacheTag`, `instant`,
  `prefetch`, and a non-no-op `io()`.
- **PPR becomes the default** for the App Router.
- **Requires the Node.js runtime.** `runtime = 'edge'` routes must migrate.
- `dynamic`, `revalidate`, `fetchCache` exports **error**; `dynamicParams` is unavailable.
- `GET` Route Handlers follow the same prerender model as pages.
- `generateStaticParams` returning an empty array now errors.
- Uses React `<Activity>` to preserve component state across navigations — dropdowns stay open, init
  effects don't re-fire, form values and `useActionState` results persist. This can break existing code.
- `useSearchParams` always needs a `<Suspense>` boundary; `usePathname`/`useParams`/
  `useSelectedLayoutSegment(s)` may suspend or fail the build.
- Synchronous IO (`new Date()`, `Math.random()`, `crypto.randomUUID()`) fails the prerender, and
  `instant = false` does **not** clear those errors.

Adoption tooling named in the docs: `npx skills add vercel/next.js --skill next-cache-components-adoption`
and `npx @next/codemod@canary cache-components-instant-false ./app`.

---

# 5. Server Functions / Server Actions

## Naming and declaration

The docs lead with **Server Function** as the broad term; **Server Action** is the narrower usage.

> A **Server Function** is an asynchronous function that runs on the server… In an `action` or mutation
> context, they are also called **Server Actions**… Behind the scenes, actions use the `POST` method,
> and only this HTTP method can invoke them.
> — `docs/01-app/01-getting-started/07-mutating-data.md`, "What are Server Functions?"

`'use server'` goes at the top of a file (marking all exports) or inline at the top of an async function.
Inline inside a Server Component is allowed and documented:

```tsx
// app/page.tsx
export default function Page() {
  async function createPost(formData: FormData) {
    'use server'
    // …
  }
  return <form action={createPost}>{/* … */}</form>
}
```

You **cannot** define a Server Function in a Client Component — import it from a file with a top-level
`'use server'` instead (`docs/01-app/03-api-reference/01-directives/use-server.md`, "Using Server
Functions in a Client Component").

## Invocation

```tsx
// Plain form action — works without JS (progressive enhancement)
<form action={createPost}>…</form>
```

```tsx
// With useActionState — note the import is from 'react'
'use client'
import { useActionState } from 'react'
import { createPost } from '@/app/actions'

export function Form() {
  const [state, formAction, pending] = useActionState(createPost, { message: '' })
  return (
    <form action={formAction}>
      <input type="text" name="title" required />
      {state?.message && <p aria-live="polite">{state.message}</p>}
      <button disabled={pending}>Create Post</button>
    </form>
  )
}
```

When used with `useActionState`, the action's signature gains a leading state argument:
`export async function createPost(prevState: FormState, formData: FormData)`
(`docs/01-app/02-guides/forms.md`, "Validation errors").

```tsx
// Pending state via useFormStatus — import from 'react-dom', requires a child component
'use client'
import { useFormStatus } from 'react-dom'

export function SubmitButton() {
  const { pending } = useFormStatus()
  return <button disabled={pending} type="submit">Sign Up</button>
}
```

Outside a form, wrap the action in `startTransition`
(`docs/01-app/01-getting-started/07-mutating-data.md`, "Showing a pending state"):

```tsx
'use client'
import { useActionState, startTransition } from 'react'
const [state, action, pending] = useActionState(createPost, false)
// …
<button onClick={() => startTransition(action)}>Create Post</button>
```

Event handlers can just `await` the function directly. Extra arguments go through `.bind`, not hidden
inputs — "the value will be part of the rendered HTML and will not be encoded"
(`docs/01-app/02-guides/forms.md`, "Passing additional arguments"):

```ts
const updateUserWithId = updateUser.bind(null, userId)
// export async function updateUser(userId: string, formData: FormData) {}
```

A Next.js-specific behavior worth knowing:

> Next.js dispatches Server Actions one at a time per client… do not rely on `Promise.all` to
> parallelize Server Actions from the client.
> — `docs/01-app/02-guides/server-actions.md`, "Sequential dispatch on the client"

## Validation and security

Zod is the sanctioned library, via `safeParse` + early return
(`docs/01-app/02-guides/forms.md`, "Form validation"):

```ts
'use server'
import { z } from 'zod'

const schema = z.object({ email: z.string() })

export default async function createUser(formData: FormData) {
  const validatedFields = schema.safeParse({ email: formData.get('email') })
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors }
  }
  // mutate
}
```

> Note: `forms.md` uses zod v3 API (`z.string({ invalid_type_error })`), while `authentication.md` uses
> zod v4 API (`z.email({ error: … })`). The bundled docs are inconsistent; pick per your installed zod.

The security guidance is the most repeated point in this doc set, and schema validation alone is
explicitly declared insufficient:

> Server Functions are reachable via direct POST requests, not just through your application's UI.
> **Always verify authentication and authorization inside every Server Function.**
> — `docs/01-app/01-getting-started/07-mutating-data.md`, "What are Server Functions?" (warning callout)

> Schema validation (zod or similar) only checks the *shape* of the input. A well-formed `Item` object
> can still refer to a row the caller does not own.
> — `docs/01-app/02-guides/server-actions.md`, "Security"

```ts
// app/items/actions.ts — the sanctioned shape
'use server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// Safe: take only the change, derive identity from the session, look up by ownership.
export async function completeItem(itemId: string) {
  const session = await auth()
  if (!session?.user) return

  const item = await db.item.findFirst({
    where: { id: itemId, ownerId: session.user.id },
  })
  if (!item) return

  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}
```

Framework-provided protections (`docs/01-app/02-guides/server-actions.md`, "Security"): CSRF check
(`Origin` vs `Host`), 1MB default body limit, encrypted action IDs with dead-code elimination, and
encryption of closure-captured variables. "Framework protections are not a substitute for
application-level checks… Render-time gating (only rendering a form on an authenticated page) is not a
security boundary."

A proxy-specific trap (`docs/01-app/03-api-reference/03-file-conventions/proxy.md`, "Execution order"):

> Server Functions are not separate routes in this chain. They are handled as POST requests to the route
> where they are used, so a Proxy matcher that excludes a path will also skip Server Function calls on
> that path.

Return values are serialized to the client — "Only return data the UI needs, not raw database records."
(`docs/01-app/03-api-reference/01-directives/use-server.md`, "Return values"). Action IDs rotate at most
every 14 days; stale clients get "Failed to find Server Action" — "Surface the error as a retry path in
the UI rather than a hard failure." (`docs/01-app/02-guides/server-actions.md`, "Deployment
considerations").

## Revalidating and redirecting inside an action

```ts
'use server'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateUserProfile(userId: string, profile: Profile) {
  await db.users.update(userId, profile)
  updateTag(`user-${userId}`)   // read-your-own-writes; user sees the change immediately
}
```

`redirect()` throws a control-flow exception, so call it **after** any revalidation and **outside** a
`try` block:

> In Server Actions and Route Handlers, `redirect` should be called **outside** the `try` block when
> using `try/catch` statements.
> — `docs/01-app/03-api-reference/04-functions/redirect.md`, "Behavior"

Setting or deleting a cookie in an action also triggers a re-render: "Next.js re-renders the current page
and its layouts on the server so the **UI reflects the new cookie value**."
(`docs/01-app/01-getting-started/07-mutating-data.md`, "Cookies")

## `after()`

```ts
import { after } from 'next/server'

export async function POST(request: Request) {
  // …
  after(() => { logAnalytics() })
  return new Response(null, { status: 200 })
}
```

From `docs/01-app/03-api-reference/04-functions/after.md`: usable in Server Components (including
`generateMetadata`), Server Functions, Route Handlers, and Proxy. It is **not** a Request-time API and
does not make a route dynamic. It runs "even if the response didn't complete successfully… including when
an error is thrown or when `notFound` or `redirect` is called." Inside a **Server Component**, calling
`cookies()`/`headers()` in the callback **throws** — read them before `after` and close over the values.
In Route Handlers and Server Functions they are allowed.

---

# 6. Error handling

## `error.tsx`

Must be a Client Component. Props: `error` (with `digest`), `retry`, `reset`. See §Breaking-changes-4 for
the full snippet. Boundary scope
(`docs/01-app/03-api-reference/03-file-conventions/error.md`, "Reference"):

> `error.js` wraps `loading.js`, `not-found.js`, `page.js`, and nested `layout.js` files… It does **not**
> wrap the `layout.js` or `template.js` above it in the same segment.

`error.message` for Server Component errors is generic in production — match it to server logs via
`error.digest`. Errors thrown in **event handlers** are not caught by error boundaries; errors inside
`startTransition` **are** (`docs/01-app/01-getting-started/10-error-handling.md`, "Nested error
boundaries").

## `global-error.tsx`

```tsx
// app/global-error.tsx
'use client'

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => retry()}>Try again</button>
      </body>
    </html>
  )
}
```

> Global error UI must define its own `<html>` and `<body>` tags, global styles, fonts, or other
> dependencies… **This file replaces the root layout or template when active.**
> — `docs/01-app/03-api-reference/03-file-conventions/error.md`, "Global Error"

Two gotchas from the same section: it does **not** include your global styles, so an app-level theme
toggle won't reach it; and because error boundaries are Client Components, `metadata`/`generateMetadata`
exports are unsupported there (use React's `<title>` component). It is **not** production-only — Version
History records `v15.2.0` "Also display `global-error` in development."

## `not-found` / `forbidden` / `unauthorized`

| File | Function | Status code | Requires flag |
| --- | --- | --- | --- |
| `not-found.tsx` | `notFound()` | `200` for streamed responses, `404` for non-streamed | no (stable) |
| `forbidden.tsx` | `forbidden()` | `403` | `experimental.authInterrupts` |
| `unauthorized.tsx` | `unauthorized()` | `401` | `experimental.authInterrupts` |

All three import from `next/navigation`, return `never`, need no `return` keyword, and are **suppressed
by a surrounding `try/catch`** — use `unstable_rethrow`. `notFound()` also injects
`<meta name="robots" content="noindex" />`
(`docs/01-app/03-api-reference/04-functions/not-found.md`). `forbidden()` and `unauthorized()` "cannot be
called in the root layout" (`docs/01-app/03-api-reference/04-functions/forbidden.md`, "Good to know").

The streaming trap, repeated in all three function docs ("Calling X after streaming has started"):

> the response has already begun streaming as a `200`, and the status can't change once streaming has
> started… **With Cache Components, every dynamic route streams a static shell first, so run that check
> in `proxy` instead.**

```ts
// next.config.ts
const nextConfig: NextConfig = { experimental: { authInterrupts: true } }
```

## `redirect` vs `permanentRedirect`

```ts
import { redirect, permanentRedirect, RedirectType } from 'next/navigation'

redirect(path, type)          // type: 'replace' (default) | 'push' (default in Server Actions)
permanentRedirect(path, type)
```

`redirect` → 307, `permanentRedirect` → 308; both use **303** for progressive-enhancement form
submissions. `type` has no effect in Server Components. `redirect` can be called during Client Component
rendering **but not in event handlers** — use `useRouter` there
(`docs/01-app/03-api-reference/04-functions/redirect.md`, "Behavior").

## `unstable_rethrow` and `catchError`

```tsx
import { notFound, unstable_rethrow } from 'next/navigation'

try {
  const post = await fetch('…').then((res) => {
    if (res.status === 404) notFound()
    if (!res.ok) throw new Error(res.statusText)
    return res.json()
  })
} catch (err) {
  unstable_rethrow(err)
  console.error(err)
}
```

`unstable_rethrow` (still `version: unstable`) must be the first call in the catch block. APIs that need
it: `notFound()`, `redirect()`, `permanentRedirect()`, and Request-time APIs inside statically-marked
segments (`docs/01-app/03-api-reference/04-functions/unstable_rethrow.md`).

`catchError` from **`next/error`** is new and stable in 16.3.0 — a component-level error boundary that is
framework-aware:

```tsx
'use client'
import { catchError, type ErrorInfo } from 'next/error'

function ErrorFallback(props: { title: string }, { error, retry }: ErrorInfo) {
  return (
    <div>
      <h2>{props.title}</h2>
      <p>{error.message}</p>
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}

export default catchError(ErrorFallback)
```

> **Framework-aware integration** — APIs like `redirect()` and `notFound()` work by throwing special
> errors under the hood. `catchError` handles these seamlessly, so they're not accidentally caught by
> your error boundary.
> — `docs/01-app/03-api-reference/04-functions/catchError.md`

`ErrorInfo` is `{ error: Error, retry: () => void, reset: () => void }`. The fallback must be a Client
Component. You do **not** wrap `error.js` default exports with it. Verified export:
`node_modules/next/error.d.ts` → `export { catchError } from './dist/api/error'`.

---

# 7. Auth and sessions

The docs' stance is unambiguous: **auth belongs in a Data Access Layer, not in the proxy.**

> While Proxy can be useful for initial checks, **it should not be your only line of defense in
> protecting your data**. The majority of security checks should be performed as close as possible to
> your data source.
> — `docs/01-app/02-guides/authentication.md`, "Optimistic checks with Proxy (Optional)"

Note the heading says *Optional*. In the proxy, "only read the session from the cookie (optimistic
checks), and **avoid database checks** to prevent performance issues."

Session cookies (`docs/01-app/02-guides/authentication.md`, "Stateless Sessions"): generate a secret
(`openssl rand -base64 32`), encrypt with `jose` or `iron-session`, manage via the `cookies` API.

```ts
// app/lib/session.ts
import 'server-only'
import { cookies } from 'next/headers'

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const session = await encrypt({ userId, expiresAt })
  const cookieStore = await cookies()

  cookieStore.set('session', session, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}
```

"Cookies should be set on the server to prevent client-side tampering." The payload "should contain the
**minimum**, unique user data… It should not contain personally identifiable information… or sensitive
data like passwords."

The DAL pattern (`docs/01-app/02-guides/authentication.md`, "Creating a Data Access Layer (DAL)";
`docs/01-app/02-guides/data-security.md`, "Data Access Layer"): a `verifySession()` wrapped in React
`cache`, in a file with `import 'server-only'`, returning minimal DTOs. "Only the Data Access Layer
should access `process.env`." Client Components can't import the DAL.

Explicit anti-patterns called out:

- **Layout checks** — "layouts don't re-render on navigation, meaning the user session won't be checked
  on every route change. A layout **also does not control whether the rest of the route renders**."
- **`return null` for unauthorized** — "not recommended since Next.js applications have multiple entry
  points, which will not prevent nested route segments and Server Actions from being accessed."
- **Assuming page-level auth covers actions** — "A page-level authentication check does not extend to
  the Server Actions defined within it. Always re-verify inside the action."
  (`docs/01-app/02-guides/data-security.md`, "Authentication and authorization"; names IDOR as the
  failure mode.)

Static routes shared between users (e.g. paywalled content) are the one case the docs say to protect in
the proxy, because DAL checks run at request time and static routes are built once.

Tainting requires opt-in: `experimental: { taint: true }`, then React's
`experimental_taintObjectReference` / `experimental_taintUniqueValue`
(`docs/01-app/02-guides/data-security.md`, "Tainting").

---

# 8. Forms

`<Form>` from `next/form` extends `<form>` with prefetching, client-side navigation on submission, and
progressive enhancement (`docs/01-app/03-api-reference/02-components/form.md`). Its behavior forks on the
`action` type:

- **`action` is a string** → behaves like a native GET form; form data is encoded into the URL as search
  params; Next.js prefetches the path (including `layout.js`/`loading.js`) when the form becomes visible
  and does a client-side navigation. Props: `action` (required; `""` means the same route with updated
  search params), `replace` (default `false`), `scroll` (default `true`), `prefetch` (default `true`).
- **`action` is a function** → behaves like a React form. **`replace` and `scroll` are ignored**, and
  prefetching is impossible because the destination isn't known until the action runs.

Not supported on `<Form>`: `method`, `encType`, `target` (and the `formMethod`/`formEncType`/`formTarget`
overrides) — "If you need to use these props, use the HTML `<form>` element instead." `key` on a string
action is unsupported. `<input type="file">` with a string action submits the filename, not the file.

Validation: HTML attributes client-side (`required`, `type="email"`), zod server-side. Model expected
errors as **return values** rather than thrown exceptions — "avoid try/catch and throwing"
(`docs/01-app/01-getting-started/10-error-handling.md`, "Server Functions").

---

# 9. Metadata

## `metadata` vs `generateMetadata`

Both are exportable from **`layout.js` and `page.js` only**, are **Server Component only**, and are
**mutually exclusive within a segment**
(`docs/01-app/03-api-reference/04-functions/generate-metadata.md`, "The `metadata` object" /
"`generateMetadata` function").

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Next.js' }
```

```tsx
import type { Metadata, ResolvingMetadata } from 'next'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params
  const product = await fetch(`https://.../${id}`).then((res) => res.json())
  const previousImages = (await parent).openGraph?.images || []

  return {
    title: product.title,
    openGraph: { images: ['/some-specific-page-image.jpg', ...previousImages] },
  }
}
```

You can also type the first argument with `PageProps<'/route'>` or `LayoutProps<'/route'>`.

Rules worth remembering:

- `searchParams` is **only available in `page.js`** segments.
- `redirect()` and `notFound()` may be used inside `generateMetadata`.
- Metadata objects merge **shallowly**, root → leaf. A child defining `openGraph` **replaces the whole
  parent `openGraph` object**, not just the keys it sets (same doc, "Merging").
- File-based metadata has **higher priority** and overrides both the object and the function.
- `metadataBase` sets a base URL prefix for relative URL fields. "Using a relative path in a URL-based
  `metadata` field without configuring a `metadataBase` will cause a **build error**." URL composition
  favors intent over directory traversal: `./payments`, `payments`, `/payments`, and even `../payments`
  all resolve relative to the end of `metadataBase`.

**Deprecated metadata keys** (same doc): `themeColor`, `colorScheme`, and `viewport` inside `metadata`
are deprecated in favor of the separate `viewport` / `generateViewport` export.

## `viewport` / `generateViewport`

```tsx
import type { Viewport } from 'next'

export const viewport: Viewport = { themeColor: 'black' }
```

Separate from metadata because "**Unlike metadata, viewport cannot be streamed** because it affects
initial page load UI." (`docs/01-app/03-api-reference/04-functions/generate-viewport.md`, "With Cache
Components"). Fields: `themeColor`, `width`, `initialScale`, `maximumScale`, `userScalable`,
`interactiveWidget`, `colorScheme`. Codemod: `metadata-to-viewport-export`.

## Streaming metadata

> When `generateMetadata` resolves, the resulting metadata tags are appended to the **`<body>`** tag…
> For **HTML-limited bots** that can't execute JavaScript (e.g. `facebookexternalhit`), metadata
> continues to block page rendering. The resulting metadata will be available in the `<head>` tag.
> — `docs/01-app/03-api-reference/04-functions/generate-metadata.md`, "Streaming metadata"

Prerendered pages don't stream metadata. Override the bot list with `htmlLimitedBots` (a regex) in
`next.config.ts` — but "Streaming metadata is an advanced feature, and the default should be sufficient
for most cases."

## File-based metadata conventions

Icons (`docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`):

| Convention | Types | Locations |
| --- | --- | --- |
| `favicon` | `.ico` | **top level of `app/` only**, and cannot be code-generated |
| `icon` | `.ico` `.jpg` `.jpeg` `.png` `.svg`, or `.js` `.ts` `.tsx` | `app/**/*` |
| `apple-icon` | `.jpg` `.jpeg` `.png`, or `.js` `.ts` `.tsx` | `app/**/*` |

OG/Twitter images (`.../01-metadata/opengraph-image.md`): `opengraph-image` and `twitter-image` accept
`.jpg` `.jpeg` `.png` `.gif` (**no `.svg`**), or `.js` `.ts` `.tsx`; plus `opengraph-image.alt.txt` /
`twitter-image.alt.txt`. Hard limits: twitter ≤ 5MB, opengraph ≤ 8MB — "If the image file size exceeds
these limits, **the build will fail**."

```tsx
// app/about/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'About Acme'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const interSemiBold = await readFile(join(process.cwd(), 'assets/Inter-SemiBold.ttf'))

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ fontSize: 128, background: 'white', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        About Acme
      </div>
    ),
    { ...size, fonts: [{ name: 'Inter', data: interSemiBold, style: 'normal', weight: 400 }] }
  )
}
```

Config exports: `alt`, `size`, `contentType` for OG/Twitter; `size` and `contentType` only for icons
(**no `alt` export for icons**).

`ImageResponse` is imported from **`next/og`** — it moved out of `next/server` in v14
(`docs/01-app/03-api-reference/04-functions/image-response.md`, Version History). Constraints from that
file: Satori-based, "Only flexbox and a subset of CSS properties are supported. Advanced layouts (e.g.
`display: grid`) will not work"; **maximum bundle size 500KB** including fonts and images; fonts must be
`ttf`/`otf`/`woff`.

Sitemap (`.../01-metadata/sitemap.md`) — `sitemap.(xml|js|ts)` at the root of `app`:

```ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://acme.com', lastModified: new Date(), changeFrequency: 'yearly', priority: 1 },
    { url: 'https://acme.com/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ]
}
```

Robots (`.../01-metadata/robots.md`) — `robots.(txt|js|ts)` at the root of `app`:

```ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/private/' },
    sitemap: 'https://acme.com/sitemap.xml',
  }
}
```

New in **16.3.0**: an `other` field for non-standard per-agent directives (`Request-Rate`, `Clean-param`).
"Values in `other` are passed through verbatim. Next.js does not validate directive names or values."

Manifest (`.../01-metadata/manifest.md`) — `manifest.(json|webmanifest|js|ts)` at the root of `app`,
returning `MetadataRoute.Manifest`.

All metadata Route Handlers (`sitemap.ts`, `opengraph-image.tsx`, `icon.tsx`) "are cached by default"
unless they use a Request-time API. And: "If using along with `proxy.ts`, configure the matcher to
exclude the metadata files." (`.../01-metadata/index.md`)

## The v16 async change for image and sitemap generators

**Asymmetric — get this right.** The *generator* functions still receive synchronous `params`; the
*default-export image/sitemap function* receives Promises.

```js
// app/shop/[slug]/opengraph-image.js
export async function generateImageMetadata({ params }) {
  const { slug } = params            // still sync
  return [{ id: '1' }, { id: '2' }]
}

export default async function Image({ params, id }) {
  const { slug } = await params      // now a Promise
  const imageId = await id           // now a Promise
}
```

```js
// app/product/sitemap.js
export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }]
}

export default async function sitemap({ id }) {
  const resolvedId = await id        // now Promise<string>
  const start = Number(resolvedId) * 50000
}
```

(`docs/01-app/02-guides/upgrading/version-16.md`, "Async parameters for icon, and open-graph Image" and
"Async `id` parameter for `sitemap`"; confirmed by the Version History rows in `app-icons.md`,
`opengraph-image.md`, `generate-image-metadata.md`, `sitemap.md`, `generate-sitemaps.md`.)

## Unsupported metadata and JSON-LD

No built-in support for `<meta http-equiv>`, `<base>`, `<noscript>`, `<style>`, `<script>`,
`<link rel="stylesheet">`, or the `preload`/`preconnect`/`dns-prefetch` hints (use `ReactDOM.preload`
etc. from a Client Component) — `generate-metadata.md`, "Unsupported Metadata".

JSON-LD goes in a native `<script>`, **not** `next/script`
(`docs/01-app/02-guides/json-ld.md`):

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
/>
```

The `<` replacement is the documented XSS mitigation: "`JSON.stringify` … does not sanitize
malicious strings used in XSS injection."

---

# 10. Proxy (formerly middleware)

```ts
// proxy.ts — project root, or inside src/, level with app/
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}

export const config = {
  matcher: '/about/:path*',
}
```

There is also a shorthand type: `import type { NextProxy } from 'next/server'`, which infers both
`request` (`NextRequest`) and `event` (`NextFetchEvent`)
(`docs/01-app/03-api-reference/03-file-conventions/proxy.md`, "Params → `request`"). Verified export in
`node_modules/next/server.d.ts`: `export { NextMiddleware, MiddlewareConfig, NextProxy, ProxyConfig }`.

Key rules from `proxy.md`:

- "The file must export a single function, either as a default export or named `proxy`. Multiple proxy
  from the same file are not supported."
- **Without a `matcher`, Proxy runs on every request**, including `_next/static`, `_next/image`, and
  `public/` assets. "Consider using a negative match pattern to exclude these paths, otherwise auth logic
  or redirects can unintentionally block CSS, JS, or images from loading."
- `matcher` values must be **constants**, statically analyzable at build time. Variables are ignored.
- Object form supports `source`, `locale`, `has`, `missing`.
- If you customized `pageExtensions`, name the file `proxy.page.ts` accordingly.
- Runtime is Node.js and cannot be configured; setting `runtime` throws.
- `fetch` with `cache`, `next.revalidate`, or `next.tags` **has no effect in Proxy**
  (`docs/01-app/01-getting-started/16-proxy.md`, "Proxy").
- `revalidateTag` / `revalidatePath` cannot be called from Proxy.

```js
export const config = {
  matcher: [
    // Exclude API routes, static files, image optimizations, and .png files
    '/((?!api|_next/static|_next/image|.*\\.png$).*)',
  ],
}
```

Execution order (`proxy.md`, "Execution order"): `headers` → `redirects` (config) → Proxy → `beforeFiles`
rewrites → filesystem routes → `afterFiles` rewrites → dynamic routes → `fallback` rewrites.

The docs are openly discouraging about the whole feature: "this feature is recommended to be used as a
last resort… We recommend users avoid relying on Middleware unless no other options exist."
(`proxy.md`, "Migration to Proxy").

---

# 11. `next.config.ts`

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
}

export default nextConfig
```

(`docs/01-app/03-api-reference/05-config/01-next-config-js/index.md`, "TypeScript")

Supported extensions: `.js` (CJS), `.mjs` (ESM), `.ts`. **`.cjs` and `.cts` are not supported** (same
doc, "ECMAScript Modules"). Function and async-function forms are supported, receiving
`(phase, { defaultConfig })` — use `PHASE_DEVELOPMENT_SERVER` from `next/constants`.

Caveat worth knowing: "Module resolution in `next.config.ts` is currently limited to CommonJS. However,
ECMAScript Modules (ESM) syntax is available when using Node.js native TypeScript resolver for Node.js
v22.10.0 and higher." For CommonJS projects the docs recommend `next.config.mts`
(`docs/01-app/03-api-reference/05-config/02-typescript.md`, "Type Checking Next.js Configuration Files").

## Options that exist in this version

`index.md` does not carry an inline list — the website generates it from the 70 sibling `.md` files in
`docs/01-app/03-api-reference/05-config/01-next-config-js/`. Grouped:

**Stable, top-level.** Routing/URL: `basePath`, `trailingSlash`, `redirects`, `rewrites`, `headers`,
`pageExtensions`. Build/output: `distDir`, `output`, `outputHashSalt`, `generateBuildId`, `generateEtags`,
`compress`, `transpilePackages`, `serverExternalPackages`, `webpack`, `deploymentId`,
`supportsImmutableAssets`, `adapterPath`. Bundler: `turbopack` (with `turbopack.ignoreIssue`).
React: `reactCompiler`, `reactStrictMode`, `reactMaxHeadersLength`. TypeScript: `typescript`,
`typedRoutes`. Caching: `cacheComponents`, `cacheHandler`, `cacheHandlers`, `cacheLife`, `expireTime`,
`partialPrefetching`. Assets/CSS: `images`, `assetPrefix`, `crossOrigin`, `sassOptions`,
`poweredByHeader`. Dev/DX: `devIndicators`, `allowedDevOrigins`, `onDemandEntries`, `logging`, `env`,
`httpAgentOptions`, `instrumentationClientInject`, `htmlLimitedBots`.

**Experimental (`experimental.*`):** `authInterrupts`, `cssChunking`, `inlineCss`, `mdxRs`,
`optimizePackageImports`, `prefetchInlining`, `proxyClientMaxBodySize`, `serverComponentsHmrCache`,
`staleTimes`, `staticGenerationRetryCount` / `staticGenerationMaxConcurrency` /
`staticGenerationMinPagesPerWorker`, `taint`, `turbopackChunking`, `turbopackRustReactCompiler`,
`turbopackFileSystemCacheForDev` / `…ForBuild`, `turbopackMemoryEviction`, `turbopackLocalPostcssConfig`,
`urlImports`, `useLightningcss`, `useOffline`, `useTypeScriptCli`, `webVitalsAttribution`, `typedEnv`,
`globalNotFound`, `hideLogsAfterAbort`, `instantInsights`.

**Legacy but still documented** (frontmatter `version: legacy`): `env`, `exportPathMap` (deprecated, not
removed), `appDir` ("no longer needed as of Next.js 13.4"), `incrementalCacheHandlerPath` (now the
`cacheHandler` doc, renamed and stabilized in v14.1.0).

## Promoted to stable in 16.x

| Option | Evidence |
| --- | --- |
| `turbopack` (was `experimental.turbo`) | `turbopack.md`: "The `experimental.turbo` option will be removed in Next.js 16." |
| `reactCompiler` | `version-16.md`, "React Compiler Support": "promoted from `experimental` to stable. It is not enabled by default" |
| `adapterPath` | `version-16.md`, "Build Adapters API (alpha)": "promoted to a stable, top-level option in 16.2.0" |
| `typedRoutes` | `typedRoutes.md`: "marked as stable, so you should use `typedRoutes` instead of `experimental.typedRoutes`" |
| `cacheComponents` | `cacheComponents.md`, Version History `16.0.0` — "controls the `ppr`, `useCache`, and `dynamicIO` flags as a single, unified configuration" |
| `cacheLife` / `cacheTag` functions | `version-16.md`, "cacheLife and cacheTag" |

**Not promoted, despite what you may assume:** `authInterrupts` is still experimental. And
`serverActions.md` is internally inconsistent — it says Server Actions became stable in Next 14 and are
on by default, yet every snippet still nests `allowedOrigins` and `bodySizeLimit` under
`experimental: { serverActions: { … } }`. Follow the snippets.

## Removed

`eslint` option, `next lint`, AMP (`amp` config, `next/amp`, `useAmp`), `serverRuntimeConfig` /
`publicRuntimeConfig`, `devIndicators.appIsrStatus` / `.buildActivity` / `.buildActivityPosition`,
`experimental.dynamicIO`, `experimental.useCache`, `experimental.ppr`, `experimental.turbo`,
`unstable_rootParams` (`docs/01-app/02-guides/upgrading/version-16.md`, "Removals").

---

# 12. TypeScript, ESLint, testing, CLI

## TypeScript

Minimum **5.1.0** (`docs/01-app/01-getting-started/01-installation.md`, "Set up TypeScript"); async
Server Components additionally want TS 5.1.3+ and `@types/react` 18.2.8+
(`docs/01-app/03-api-reference/05-config/02-typescript.md`, "With Async Server Components").

**`next-env.d.ts`** is managed by Next.js. From `02-typescript.md`, "next-env.d.ts":

> Its contents are an implementation detail and may change over time. **Add it to `.gitignore`.** If your
> project already tracks the file, remove it from Git. Do not edit this file manually.

It must be in `tsconfig.json`'s `include` array. Regenerated by `next dev`, `next build`, `next typegen`.

**Route-aware type helpers** — global, no import, generated during `next dev` / `next build` /
`next typegen` (`02-typescript.md`, "Route-Aware Type Helpers"):

```tsx
// app/blog/[slug]/page.tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  const query = await props.searchParams
  return <h1>Blog Post: {slug}</h1>
}
```

```tsx
// app/dashboard/layout.tsx
export default function Layout(props: LayoutProps<'/dashboard'>) {
  return <section>{props.children}{/* props.analytics if app/dashboard/@analytics exists */}</section>
}
```

```ts
// app/users/[id]/route.ts
import type { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, ctx: RouteContext<'/users/[id]'>) {
  const { id } = await ctx.params
  return Response.json({ id })
}
```

Static routes resolve `params` to `{}`. `LayoutProps` infers named parallel-route slots from the
directory structure.

**`next typegen`** generates these without a full build. Output goes to `<distDir>/types` — "typically
`.next/dev/types` in development or `.next/types` in production"
(`docs/01-app/03-api-reference/06-cli/next.md`, "next typegen options"). Recommended CI usage:

```bash
next typegen && tsc --noEmit
```

**Typed routes**: set top-level `typedRoutes: true`. It types `next/link`'s `href` and, in the App
Router, `next/navigation`'s `push` / `replace` / `prefetch`. Non-literal hrefs need `as Route`
(`import type { Route } from 'next'`). It does **not** type `next/router`.

**TypeScript 7 / `tsc` CLI** (`02-typescript.md`, "Using TypeScript 7"): `next build` now runs the
project-local `tsc` CLI by default rather than the TS compiler API. Diagnostics come straight from `tsc`
— no Next.js code frames. The whole tsconfig project is checked, including test files and
`.next/dev/types`; `--debug-build-paths` does not narrow it. Opt out with
`experimental.useTypeScriptCli: false` (note the inversion: the CLI checker is the default, and `false`
selects the old path).

Options: `typescript.ignoreBuildErrors` (default `false`), `typescript.tsconfigPath` (default
`'tsconfig.json'`). Only `tsconfig.json` is watched in dev — restart the dev server if you use another
filename.

## ESLint

Packages: `eslint` + `eslint-config-next`. Three entrypoints — `eslint-config-next` (base),
`eslint-config-next/core-web-vitals` (recommended; CWV rules upgraded warning→error),
`eslint-config-next/typescript`. Flat config only.

```js
// eslint.config.mjs — what create-next-app --typescript produces
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])

export default eslintConfig
```

(`docs/01-app/03-api-reference/05-config/03-eslint.md`, "Setup ESLint" / "With TypeScript" — this repo
already matches.) Run with `npx eslint .`. Monorepos: `settings: { next: { rootDir: 'packages/my-app/' } }`.
Prettier: import `eslint-config-prettier/flat` after `...nextVitals`.

## Testing

The headline caveat, stated in three places:

> Since `async` Server Components are new to the React ecosystem, some tools do not fully support them.
> In the meantime, we recommend using **End-to-End Testing** over **Unit Testing** for `async` components.
> — `docs/01-app/02-guides/testing/index.md`, "Async Server Components"

**Vitest** — "Vitest currently does not support them. While you can still run **unit tests** for
synchronous Server and Client Components, we recommend using **E2E tests** for `async` components."
Deps: `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`.

```ts
// vitest.config.mts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: { environment: 'jsdom' },
})
```

**Jest** — same caveat. Deps: `jest jest-environment-jsdom @testing-library/react @testing-library/dom
@testing-library/jest-dom ts-node @types/jest`.

```ts
// jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

`next/jest` auto-configures the SWC transform, auto-mocks stylesheets/images/`next/font`, loads `.env`,
and ignores `node_modules` and `.next`. Module aliases still need a matching `moduleNameMapper`.

**Playwright** — no caveat; this is the recommended path for async Server Components. Set up with
`npm init playwright`. "We recommend running your tests against your production code" — `npm run build`
then `npm run start`, then `npx playwright test`
(`docs/01-app/02-guides/testing/playwright.md`, "Running your Playwright tests").

There is also a `cypress.md` guide.

Bonus: `next/experimental/testing/server` exposes `unstable_getResponseFromNextConfig` and
`getRedirectUrl` for unit-testing `headers`/`redirects`/`rewrites`
(`docs/01-app/03-api-reference/05-config/01-next-config-js/index.md`, "Unit Testing (experimental)").

## CLI

Eight commands (`docs/01-app/03-api-reference/06-cli/next.md`, "Commands"): `dev`, `build`, `start`,
`info`, `telemetry`, `typegen`, `upgrade` (new in 16.1.0), `experimental-analyze` (new in 16.1.0).
Running `next` with no command is an alias for `next dev`. **`next lint` and `next export` are gone.**

- `next dev` — `--turbopack` / `--turbo` (already the default), `--webpack`, `-p/--port`,
  `-H/--hostname`, `--experimental-https`, `--experimental-cpu-prof`. Output goes to `.next/dev`.
- `next build` — `--turbopack`, `--webpack`, `-d/--debug`, `--profile`, `--experimental-app-only`,
  `--experimental-build-mode`, `--debug-prerender`, `--debug-build-paths=<patterns>`.
- `next start` — `-p`, `-H`, `--keepAliveTimeout <ms>`.
- `next typegen [directory]`.
- `next upgrade --revision <revision>`.
- `next experimental-analyze` — Turbopack bundle analysis, local server on port 4000 by default.

## `create-next-app` defaults in this version

> The default setup enables TypeScript, Tailwind CSS, ESLint, App Router, and Turbopack, with import
> alias `@/*`, and includes `AGENTS.md` (with a `CLAUDE.md` that references it) to guide coding agents to
> write up-to-date Next.js code.
> — `docs/01-app/01-getting-started/01-installation.md`, "Quick start"

Flags marked `(default)`: `--ts`, `--tailwind`, `--turbopack`, `--agents-md`. `--react-compiler` and
`--src-dir` are **not** defaults. Linter choice is ESLint / Biome / none.

---

# Not found in bundled docs

Listed so nobody mistakes silence for confirmation. Do not fill these from recollection.

1. **Whether `route.ts` may export `metadata` / `generateMetadata`.** The rule is stated only positively
   ("layout.js and page.js"), never as an explicit prohibition on Route Handlers.
2. **A default value for `metadataBase`.** No `VERCEL_URL` or `localhost:3000` inference is documented,
   and no runtime warning — only the build error for relative URLs without it.
3. **An async `generateViewport` example.** `generate-viewport.md`'s Version History stops at `v14.0.0`
   and carries no v16 async-params row, even though its Types section shows promise-typed `params`.
4. **A statement that Server Function *arguments* must be serializable.** Serializability is documented
   for Client Component props and for action *return values*. Closure-capture encryption is documented
   instead. (`use cache` arguments have their own explicit rules; those are covered in §4.)
5. **A `permalink` third argument to `useActionState`.** Not mentioned anywhere.
6. **A rate-limiting implementation.** `data-security.md` has a "Rate limiting" heading that only links
   out to the Backend-for-Frontend guide.
7. **A canonical recommended `tsconfig.json`** in `02-typescript.md` — only the `include`/`exclude`
   arrays. The nearest full example lives in `docs/01-app/02-guides/migrating/from-vite.md`.
8. **`next internal` in the CLI reference**, and **`--internal-trace` in the `next dev` options table.**
   Both are used in `docs/01-app/02-guides/local-development.md` and `version-16.md` but are undocumented
   as CLI surface.
9. **Formal type signatures for `cacheLife()` and `cacheTag()`** in their doc pages. Inferable from the
   examples and from `node_modules/next/cache.d.ts`, but never written out in prose the way
   `revalidateTag`/`updateTag`/`revalidatePath`/`refresh`/`connection`/`io` are.
10. **Concrete version numbers for the `instant` and `prefetch` segment exports.** Both Version History
    tables carry the literal placeholder `v16.x.x`. Same for `useOffline` (`v16.x.0`).
11. **A top-level (non-`experimental`) form of `serverActions`.** Not documented, despite the feature
    being called stable since v14.
12. **A deprecation marker on `fetch`'s `cache` / `next.revalidate` / `next.tags`.** They are only
    *discouraged* in the Cache Components migration guide, never marked deprecated in `fetch.md`.
13. **A deprecation row in `unstable_cache.md`'s Version History**, despite the "replaced by `use cache`"
    banner at the top of that same file.
14. **Whether `refresh()` invalidates any server-side cache.** `refresh.md` describes only client-router
    refresh; the client-cache-clearing effect is documented in `cacheLife.md` instead.
15. **A production-only restriction on `global-error`.** The opposite is recorded (`v15.2.0` "Also
    display `global-error` in development"), but no doc states the current behavior directly.

## Known contradictions inside the bundled docs

Flagged because copying either side blindly will bite you:

- **`default.js` requirement** — `parallel-routes.md` says 404, `default.md` and `version-16.md` say
  build error. Resolved from `next-app-loader/index.js`; see Breaking-changes §12.
- **`cacheLife('max').expire`** — docs say 1 year, `cache.d.ts` and `config-shared.js` say never
  (`INFINITE_CACHE`).
- **`unstable_cache`** — declared "replaced by `use cache`", yet still the documented answer for
  cross-deploy persistence in `use-cache.md` and `use-cache-remote.md`.
- **`connection()` vs `io()`** — `io.md` says prefer `io()`; `08-caching.md` still teaches `connection()`
  for the same job.
- **zod version** — `forms.md` uses v3 API, `authentication.md` uses v4 API.
- **`serverActions` config nesting** — page text says stable, snippets say `experimental`.
- **`themeColor`/`colorScheme`/`viewport` deprecation date** — prose says "as of Next.js 14", the Version
  History table says `v13.2.0`.
- **`--no-lint` help text on `next build`** — still says "linting will be removed from `next build` in
  Next 16", though it already has been.
