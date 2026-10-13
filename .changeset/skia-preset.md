---
"vitest-native": minor
---

A `skia` preset for Skia, which threw at import in tests ("Native Skia Module failed to correctly install JSI Bindings"). It covers both of Skia's package names, `react-native-skia` (2.15.0 and 3.x) and `@shopify/react-native-skia` (up to 2.14.0), shadows whichever is installed, and works under both engines.

- It loads CanvasKit, Skia compiled to WebAssembly, and serves Skia's own test mock over it, so the `Skia` API computes with real Skia, and `Canvas` and its drawing render as Views.
- Its named exports are read from the installed version's ESM build, since Skia's API changes between releases.
- It adds Skia's Reanimated helpers (`usePathValue`, `useTexture`, …), which the mock leaves out, and makes `matchFont` return a font.

Presets can now declare an async `prepare()`, which completes before any setup file or test file of the user's loads, and a preset module can declare `exportsFor()`, which reads its named exports from the installed package (or returns `null` when it is not installed, leaving it unshadowed).
