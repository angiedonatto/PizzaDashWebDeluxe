# Repository Guidelines

## Project Structure & Module Organization

This is a static browser game built with plain HTML, CSS, and JavaScript. There is no package manager or build pipeline.

- `index.html`: main menu, instructions, and level navigation only.
- `styles.css`: shared identity, menu, HUD, overlays, buttons, and touch controls.
- `assets/shared/progress.js`: small shared progress/star display logic.
- `assets/levels/level-N/index.html`: standalone page for a level.
- `assets/levels/level-N/game.js`: executable implementation for that level.
- `assets/levels/level-N/level.css`: level-specific style hooks.
- `assets/menu/`: reserved for menu-specific assets; current menu markup and styling remain in `index.html` and `styles.css`.
- `README.md`: user-facing run instructions.
- `.github/workflows/pages.yml`: GitHub Pages deployment workflow.
- `.nojekyll`: keeps GitHub Pages from processing the site with Jekyll.

Do not reintroduce a root `game.js` engine. Map construction, entities, traffic,
weather, rivals, obstacles, positions, and level rules belong inside each
`assets/levels/level-N/game.js`.

## Protected Level 3

`assets/levels/level-3/` is finished and frozen. Do not edit level 3 files for
any reason unless Angie explicitly asks for a level 3 change. This includes:

- `assets/levels/level-3/index.html`
- `assets/levels/level-3/game.js`
- `assets/levels/level-3/level.css`
- `assets/levels/level-3/src/`

If a shared change would affect level 3, stop and ask before continuing.

## Build, Test, and Development Commands

Run locally with a simple static server:

```bash
python3 -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

Check JavaScript syntax before committing:

```bash
node --check assets/levels/level-1/game.js
node --check assets/levels/level-2/game.js
node --check assets/levels/level-3/game.js
node --check assets/levels/level-4/game.js
```

Do not run `npm install`; this project intentionally has no `package.json` or Node dependencies.

## Coding Style & Naming Conventions

Use two-space indentation in HTML, CSS, and JavaScript. Keep JavaScript functions small and grouped by responsibility: setup/state, updates, drawing, input binding. Prefer descriptive camelCase names such as `updateLightning`, `drawRival`, and `pizzasCarried`.

Avoid introducing dependencies unless the project direction changes. Keep gameplay constants near related logic, and update HUD text when adding mechanics.

## Testing Guidelines

There is no automated test suite yet. At minimum, run:

```bash
node --check assets/levels/level-1/game.js
node --check assets/levels/level-2/game.js
node --check assets/levels/level-3/game.js
node --check assets/levels/level-4/game.js
```

Manual test on desktop and mobile widths. Verify: menu layout, touch controls, all three levels, delivery, refill at the pizzeria, rival behavior, lightning, pause/resume, and GitHub Pages after deployment.

## Commit & Pull Request Guidelines

Recent commits use short imperative messages, for example:

```text
Add pizza carrying limit and refill
Fix player movement blocking
Improve mobile responsive layout
```

Work on feature branches, not directly on `main`:

```bash
git checkout main
git pull origin main
git checkout -b your-name/short-feature
```

Before starting any change, make sure your local `main` is updated:

```bash
git checkout main
git pull origin main
```

If you already have a feature branch, update it from the latest `main` before
continuing work:

```bash
git checkout your-branch-name
git merge main
```

If Git reports conflicts, do not guess. Ask for help before editing conflicted
files.

Pull requests should include a concise summary, manual test notes, and screenshots or screen recordings for visual/mobile changes.

## Agent-Specific Instructions

Keep the game mobile-first. Keep `assets/shared/` small: progress, simple utilities, and visual identity only. Do not place level maps, entities, traffic, rivals, weather, collisions, or mechanics there. Do not overwrite unrelated local changes.
