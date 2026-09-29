# Working agreement for this globe

- The user is the designer and makes the final visual judgment. Implement their design direction without unsolicited screenshots, browser comparisons, or aesthetic verdicts.
- For a simple colour edit to an existing, known value or token, change the value and report it briefly. Do not start a preview server or run browser checks, visual checks, tests, or routine syntax checks for that edit.
- Treat the portfolio palette as guidance for a cohesive look, not a list of colours to copy literally, unless the user asks for an exact match.
- Run focused checks when a change could affect behaviour or rendering correctness, such as interaction logic, canvas drawing, layering, geometry, responsive layout, data loading, or build configuration. Use a browser only when that risk calls for it or the user requests one; keep the check narrow.
- When preparing to push to GitHub, run the relevant checks once for the accumulated changes. Fix any failures and rerun the affected checks before pushing. Do not repeat passing checks after every small edit unless a new change or failure gives a concrete reason.
- If a visual choice is open to interpretation, make a reasonable edit from the user's latest feedback and let them review it. Ask only when the missing detail prevents a sensible change.

## Releasing to the portfolio

- This repository owns the globe assets. The Vercel portfolio is a separate repository, `joshsimpson94/josh-simpson-portfolio-2026`, and pins an immutable Globe-App commit in `src/components/site/global-search-sample.tsx`. Pushing or merging here alone does not update the portfolio.
- After the user approves a globe release, commit and merge its changes to Globe-App `main`. Record the resulting `main` commit SHA and confirm jsDelivr serves the JavaScript, CSS, and three topology files at `https://cdn.jsdelivr.net/gh/joshsimpson94/globe-app@<sha>/`. Use the current lowercase repository name for new releases.
- Update the portfolio in a separate branch and commit: change its `globeCommit` pin and the matching exact-SHA assertion in `tests/e2e/responsive-pages.spec.ts`. Preserve the portfolio's iframe markup, sandbox, preloads, CSS overrides, media-query mapping, cursor behavior, sizing, and page layout unless the user explicitly asks to change them. Do not replace that component with `embed-snippet.html`.
- Follow the portfolio's own `AGENTS.md` for checks, preview review, and Vercel deployment. Merge the portfolio change only after its relevant checks and preview pass; verify `/how-i-use-ai` after Vercel publishes. Report both the Globe-App release SHA and the portfolio deployment commit.
- `embed-snippet.html` is an optional standalone/Webflow example. Updating it is not a substitute for updating the portfolio pin.
