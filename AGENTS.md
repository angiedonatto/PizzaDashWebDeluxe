# Repository Guidelines

## Project Structure & Module Organization

This is a static browser game built with plain HTML, CSS, and JavaScript. There is no package manager or build pipeline.

- `index.html`: page structure, screens, HUD, and mobile controls.
- `styles.css`: responsive layout, overlays, HUD, menu, and touch controls.
- `game.js`: game state, level definitions, drawing, movement, collisions, audio, rival AI, and effects.
- `README.md`: user-facing run instructions.
- `.github/workflows/pages.yml`: GitHub Pages deployment workflow.
- `.nojekyll`: keeps GitHub Pages from processing the site with Jekyll.

There are currently no separate asset or test directories; visuals and sounds are generated in code.

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
node --check game.js
```

Do not run `npm install`; this project intentionally has no `package.json` or Node dependencies.

## Coding Style & Naming Conventions

Use two-space indentation in HTML, CSS, and JavaScript. Keep JavaScript functions small and grouped by responsibility: setup/state, updates, drawing, input binding. Prefer descriptive camelCase names such as `updateLightning`, `drawRival`, and `pizzasCarried`.

Avoid introducing dependencies unless the project direction changes. Keep gameplay constants near related logic, and update HUD text when adding mechanics.

## Testing Guidelines

There is no automated test suite yet. At minimum, run:

```bash
node --check game.js
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

Pull requests should include a concise summary, manual test notes, and screenshots or screen recordings for visual/mobile changes.

## Agent-Specific Instructions

Keep the game mobile-first. When changing collisions, verify the player cannot walk through houses but can still reach doors and the pizzeria refill zone. Do not overwrite unrelated local changes.
