# 3D Model Attribution

## BMW M4 Competition M Package

- **Author:** [𝙎𝙍𝙏 𝙋𝙚𝙧𝙛𝙤𝙢𝙖𝙣𝙘𝙚™](https://sketchfab.com/TheRealSRT)
- **Source:** [BMW M4 Competition M Package on Sketchfab](https://sketchfab.com/3d-models/bmw-m4-competition-m-package-5c0a2dafb1ad408d9fc9eeef9aee531b)
- **License:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](http://creativecommons.org/licenses/by/4.0/)
- **Files:** `bmw-m4.glb`, `bmw-m4.optimized.glb`, `bmw-m4.web.glb`
- **Changes:** The optimized derivative uses Meshopt geometry compression and WebP texture compression, with textures limited to 1024 px. Geometry simplification is disabled.
- **Web derivative:** The runtime derivative additionally removes four cabin/engine meshes hidden in the closed-car configurator, removes three textures replaced by runtime materials, and limits remaining textures to 512 px. Geometry simplification remains disabled.

The source GLB embeds the following attribution metadata in `asset.extras`:

```text
author: 𝙎𝙍𝙏 𝙋𝙚𝙧𝙛𝙤𝙢𝙖𝙣𝙘𝙚™ (https://sketchfab.com/TheRealSRT)
license: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
source: https://sketchfab.com/3d-models/bmw-m4-competition-m-package-5c0a2dafb1ad408d9fc9eeef9aee531b
title: BMW M4 Competition M Package
```

Both derivative GLBs retain this embedded `asset.extras` attribution.

## Asset Integrity

| File | Size (bytes) | SHA-256 |
| --- | ---: | --- |
| `bmw-m4.glb` | 22,739,084 | `913ac951ba2645777c91393b86aed2def2433a807e57e626b203908aa474b8fb` |
| `bmw-m4.optimized.glb` | 5,790,016 | `9379539798ba1a3d79ebe52d52469778af6334e8261e834536d5cd4726c720a5` |
| `bmw-m4.web.glb` | 3,886,832 | `1a072ff0aee180b1c13d60c0ae47c93e7c151240c532b60101449a651531b3e1` |

Regenerate the derivative without overwriting the source file:

```bash
./scripts/optimize-model.sh \
  public/models/bmw-m4.glb \
  public/models/bmw-m4.optimized.glb
```

Regenerate the web runtime derivative:

```bash
./scripts/build-web-model.sh \
  public/models/bmw-m4.glb \
  /tmp/bmw-m4.web.glb
```
