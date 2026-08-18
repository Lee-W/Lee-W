# Vendored third-party code

## qrcode.mjs

- Package: [`qrcode-generator`](https://www.npmjs.com/package/qrcode-generator) 2.0.4 (`dist/qrcode.mjs`)
- Author: Kazuhiko Arase — <http://www.d-project.com/>
- License: MIT (notice retained at the top of the file)
- Source tarball: <https://registry.npmjs.org/qrcode-generator/-/qrcode-generator-2.0.4.tgz>
- Tarball integrity (as published by the npm registry, verified on download):
  `sha512-mZSiP6RnbHl4xL2Ap5HfkjLnmxfKcPWpWe/c+5XxCuetEenqmNFf1FH/ftXPCtFG5/TDobjsjz6sSNL0Sr8Z9g==`

Kept byte-for-byte identical to the published file so the checksum above stays
verifiable. Do not edit it; to upgrade, download the new tarball, check its
integrity against the registry, and replace the file wholesale.

Loaded lazily by `js/card.js` — only when the campaign field in present mode is
actually used, so ordinary visitors never download it.
