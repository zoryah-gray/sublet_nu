# Architectural Decision Record (ADR) Template

Title: ShadcnUI vs HeadlessUI
Date: 05/22/26

## Summary:

Issue and Context:

> Deciding between using HeadlessUI vs ShadcnUI library for the app.

Decision:

> Use shadcn/UI as the component library for SubletNU, initialized for Tailwind v4.

Status
proposed | rejected | **accepted** | deprecated

## Details

### Context and Problem Statement

> The UI of the app is not complicated, and want to prioritize efficient production, accessible features, and intuitiveness for our users. Thus, we need to decide a UI library that will scale with and match our needs.

### Considered Options

1. HeadlessUI
   1. Pros
      > A library built by TailwindCSS
      > Allows for customization
      > Accessible
   2. Cons
      > Will take longer to customize the UI
2. ShadcnUI
   1. Pros
      > Pre-styled with many options
      > Faster implementation
      > Built in zod validation
      > Accessible
   2. Cons
      > Upkeep and updating is our responsibility

### Decision outcome

### **Chosen option**: shadcn/UI

**Justification:** The full feature set of SubletNU (calendar, validated forms, toast notifications, dropdown menus, tooltips, dialog/lightbox) maps almost directly onto shadcn's component catalogue. HeadlessUI would require building the calendar, form validation wiring, and notification system from scratch on top of bare primitives. shadcn ships those integrations pre-wired (react-day-picker for Calendar, react-hook-form + zod for Form, Sonner for toasts) without sacrificing accessibility — both libraries use Radix UI primitives under the hood. The one-time Tailwind v4 setup cost is worth paying given the development velocity gained across every subsequent feature.

**Resolves:** the risk of duplicating infrastructure (form validation, toast system, date picking) that shadcn already provides, while maintaining full control over component code since shadcn copies source files into the repo rather than wrapping a black-box package.

### Consequences

**Easier:**
- Adding new interactive components (Calendar, Dialog, DropdownMenu, Tooltip, Form, Sheet) is a single `npx shadcn@latest add <component>` command that copies the component source directly into `app/components/ui/`.
- Forms (login, signup, contact lister) get built-in react-hook-form + zod validation with accessible error states.
- Notification toasts and banners have a pre-wired system (Sonner) rather than being built from scratch.
- The Dialog primitive handles the sublet gallery lightbox with blur backdrop out of the box.
- All components are in the repo and can be freely modified to match the indigo color palette and design language already established.

**More difficult / things to watch:**
- **Tailwind v4 setup (one-time cost):** shadcn was designed for Tailwind v3 and uses a `tailwind.config.js` for its CSS variable tokens. With Tailwind v4, there is no `tailwind.config.js` — configuration lives in `globals.css` under `@theme`. Setup requires:
  1. Running `npx shadcn@latest init` and selecting the "manual" or CSS-variable path so it does not try to write a `tailwind.config.js`.
  2. Pasting shadcn's HSL CSS variable block (`--background`, `--primary`, `--muted`, etc.) into the `:root` block in `globals.css` instead of into a config file.
  3. Installing `tailwind-merge` and `clsx` (clsx is already installed) and adding the `cn()` utility helper at `app/lib/utils.ts`.
  4. Verifying that any v3-style classes in generated components (`flex-shrink-0` → `shrink-0`, `bg-gradient-to-*` → `bg-linear-to-*`) are updated to their v4 canonical forms. The IDE linter flags these automatically.
- **Component ownership:** updates to shadcn components are not automatic. When shadcn releases a new version of a component, the diff must be reviewed and merged manually. For a small team this is manageable but requires discipline.
- **Masonry gallery and image lightbox:** shadcn provides the Dialog primitive for the lightbox wrapper, but the masonry grid layout and the scrollable image gallery inside the dialog are custom — no shadcn component covers these. Plan for a CSS `columns` or `grid` masonry implementation with `react-photo-album` or a similar library for the gallery scroll.

### Confirmation

When a new interactive component is needed, confirm it is sourced from shadcn (`npx shadcn@latest add`) rather than built from scratch or pulled from a third library. Components should live in `app/components/ui/`. At code review, check that:
- The component uses the project's `cn()` utility (not raw `clsx` or `twMerge` separately).
- Color tokens reference shadcn CSS variables (`--primary`, `--muted`, etc.) where applicable, keeping the palette consistent with the indigo theme set in `globals.css`.
- Any Tailwind v3 class names flagged by the IDE linter have been corrected to their v4 equivalents before merging.
