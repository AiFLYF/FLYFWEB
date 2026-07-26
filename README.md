# Hello, I'm FLYF

**FLYF® — 创意开发者 / Creative Developer** · My personal site, built as an interactive WebGL experience.

70,000 GPU particles morph through four scroll-driven chapters — intro, about, work, contact — from a breathing sphere to the word **FLYF**, reshaped in real time by your scroll and cursor.

**Live: https://aiflyf.github.io/FLYFWEB/**

## Stack

- [Three.js](https://threejs.org) r160 — custom GLSL shaders (simplex-noise turbulence, morph targets, cursor repulsion)
- Vanilla JS — inertia smooth-scroll, velocity type-skew, custom cursor, scroll-driven chapter system
- [Lucide](https://lucide.dev) icons · Clash Display / Space Mono / Instrument Serif
- Zero build step, zero external requests — every dependency is vendored, deployed straight to GitHub Pages

## Run locally

```bash
python -m http.server 4173
# open http://localhost:4173
```

Licenses for vendored assets: [assets/vendor/LICENSES.md](assets/vendor/LICENSES.md)
