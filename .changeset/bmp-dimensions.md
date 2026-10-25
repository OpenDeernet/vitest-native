---
"vitest-native": patch
---

Under the native engine, an imported BMP image's `width` and `height` are read as Metro 0.87.1 reads them. An OS/2 bitmap (12-byte header) now has its real dimensions instead of a misread width, and a file whose header size is not a bitmap's registers without dimensions, as other unreadable images do.
