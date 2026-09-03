# Testing Strategy

> Verified 09/02/26 against happy-dom 20.9.0 (the pinned version). Re-verify
> this file's claims if the happy-dom or Vitest version changes.

Current suite: Vitest + Testing Library, `environment: 'happy-dom'`
(`vitest.config.mts:8`). `vitest.setup.ts` imports `@testing-library/jest-dom`
custom matchers only. It previously carried manual shims for `ResizeObserver`
and pointer-capture, added back when this repo ran on jsdom (which didn't
implement either) — removed 09/02/26 after confirming happy-dom implements
both natively and the full suite passes identically without them (24/24
tests passing, before and after removal). The `jsdom` devDependency itself,
unreferenced anywhere once that comment is gone, was removed the same day
(`npm uninstall jsdom`).

## Vitest Browser Mode (documented option, not adopted)

https://vitest.dev/guide/browser/component-testing describes an alternative
that runs tests in a real browser instead of a simulated DOM (Playwright or
WebdriverIO as the provider). It exists to close the class of gap a
simulated DOM approximates rather than implements — real CSS layout, real
browser API behavior, accurate event propagation, real focus/a11y semantics.
Nothing in this suite has hit that gap yet; happy-dom's native API coverage
has been sufficient for everything so far, the ResizeObserver/pointer-capture
shims above included.

- **Locators**, not raw DOM queries: `page.getByRole()`, `getByLabelText()`,
  `getByText()`, `getByTestId()`, with `.click()` / `.fill()` /
  `.selectOptions()` and `userEvent.keyboard()` for interaction.
- **Auto-retrying assertions**: `expect.element(...)` retries until the
  element appears (or the matcher passes), reducing the timing-based
  flakiness the `getByText()` + manual `waitFor()` pattern can produce.
- **React support** via `vitest-browser-react` (official package); Vue,
  Svelte, Lit, Preact, Qwik, Solid, Marko also have first-party adapters.
- Sits between unit tests and full end-to-end tests — same "mount a
  component and interact with it" shape as today's Testing Library tests,
  just against a real rendering engine.

**Not a migration plan.** This repo's suite stays on happy-dom + Testing
Library for now — switching environments is a separate decision with its
own cost (slower runs, a browser dependency in CI). Reach for Browser Mode
if a future bug turns out to be a simulated-DOM gap happy-dom doesn't cover,
rather than porting the existing suite wholesale.
