/**
 * The skia preset under the mock engine, zero-config: Skia is a devDependency under
 * both its names (`react-native-skia` 3.x, `@shopify/react-native-skia` 2.14), so the
 * preset is auto-detected. Its module needs CanvasKit, which
 * loads asynchronously; the mock engine's setup cannot await (it is also built as
 * CommonJS), so the virtual module for the package awaits the preparation instead.
 * The native engine's coverage is tests-native/skia.test.tsx.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react-native";
import { Canvas, Circle, Skia, matchFont } from "@shopify/react-native-skia";
import * as skia3 from "react-native-skia";
import { AUTO_DETECT_PRESETS, PRESET_MODULES } from "../src/preset-map.js";
import { untilPrepared } from "../src/preset-preparation.js";
import * as presets from "../src/presets/index.js";
import { skia } from "../src/presets/skia.js";

const SKIA = "@shopify/react-native-skia";
const SKIA_PACKAGES = ["react-native-skia", "@shopify/react-native-skia"];

describe("skia preset: wiring", () => {
  it("is auto-detected for both of Skia's names and shadows exactly them", () => {
    for (const name of SKIA_PACKAGES) expect(AUTO_DETECT_PRESETS[name]).toBe("skia");
    expect(Object.keys(skia().modules)).toEqual(SKIA_PACKAGES);
    expect([...PRESET_MODULES.skia]).toEqual(SKIA_PACKAGES);
  });

  it("names exactly the installed version's exports, each of which its mock provides", () => {
    const preset = skia();
    for (const name of SKIA_PACKAGES) {
      const module = preset.modules[name];
      const built = module.factory();
      expect(module.exports.length, name).toBeGreaterThan(200);
      expect(
        module.exports.filter((n) => !(n in built)),
        name,
      ).toEqual([]);
    }
    // 3.0 added SkiaGraphiteView, so a list read from one version is wrong for the other.
    expect(preset.modules["react-native-skia"].exports).toContain("SkiaGraphiteView");
    expect(preset.modules[SKIA].exports).not.toContain("SkiaGraphiteView");
  });

  it("keeps every preset's export names within one Windows environment variable", () => {
    // The plugin passes them to native workers as VITEST_NATIVE_PRESET_EXPORTS, and
    // Windows caps a variable at 32,767 characters. Every preset active is the worst case.
    const all: Record<string, string[]> = {};
    for (const factory of Object.values(presets)) {
      for (const [name, module] of Object.entries(factory().modules)) all[name] = module.exports;
    }
    expect(JSON.stringify(all).length).toBeLessThan(24_000);
  });

  it("says what to do when it cannot read the installed version's exports", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "vn-skia-layout-"));
    const dir = path.join(root, "node_modules/react-native-skia");
    fs.mkdirSync(path.join(dir, "lib/module"), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    fs.writeFileSync(path.join(dir, "package.json"), '{"name":"react-native-skia"}');
    fs.writeFileSync(path.join(dir, "lib/module/index.js"), 'export * from "./moved";');
    vi.stubEnv("VITEST_NATIVE_PROJECT_ROOT", root);
    try {
      expect(() => skia().modules["react-native-skia"].exports).toThrow(
        /could not read the named exports of the installed 'react-native-skia'[\s\S]*presets: \{ skia: false \}/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("says what to do when its module is built before CanvasKit loads", () => {
    const g = globalThis as any;
    const canvasKit = g.CanvasKit;
    delete g.CanvasKit;
    try {
      expect(() => skia().modules[SKIA].factory()).toThrow(/before CanvasKit loaded/);
    } finally {
      g.CanvasKit = canvasKit;
    }
  });
});

describe("skia preset under the mock engine", () => {
  it("computes with real Skia", () => {
    const bounds = Skia.Path.Rect(Skia.XYWHRect(0, 0, 10, 20)).computeTightBounds();
    expect([bounds.width, bounds.height]).toEqual([10, 20]);
  });

  it("renders a Canvas and its drawing", async () => {
    await render(
      <Canvas testID="canvas">
        <Circle cx={1} cy={1} r={1} />
      </Canvas>,
    );
    expect(screen.getByTestId("canvas")).toBeTruthy();
    expect(matchFont({ fontSize: 12 }).getSize()).toBe(12);
  });

  it("serves Skia under its 3.x name, react-native-skia", () => {
    const svgPath = skia3.Skia.Path.MakeFromSVGString("M0 0 L4 0 L4 4 Z")!;
    expect(svgPath.computeTightBounds().width).toBe(4);
    expect(skia3.SkiaGraphiteView).toBeDefined();
  });

  it("answers require() with the same module once prepared", () => {
    const required = createRequire(import.meta.url)(SKIA);
    expect(required.Skia).toBe(Skia);
    expect(required.Canvas).toBe(Canvas);
  });
});

describe("untilPrepared", () => {
  it("names the package and the fix before the module exists", () => {
    const module = untilPrepared("some-package", () => undefined);
    expect(() => module.anything).toThrow(
      /'some-package' was required before its preset finished preparing/,
    );
  });

  it("forwards reads, writes and key queries once the module exists", () => {
    let built: Record<string, any> | undefined;
    const module = untilPrepared("some-package", () => built);
    built = { a: 1 };
    expect(module.a).toBe(1);
    module.b = 2;
    expect(built.b).toBe(2);
    expect("a" in module).toBe(true);
    expect(Object.keys(module)).toEqual(["a", "b"]);
    expect({ ...module }).toEqual({ a: 1, b: 2 });
  });
});
