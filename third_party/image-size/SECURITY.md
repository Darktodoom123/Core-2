# Core-2 `image-size` fork

This directory is an in-tree fork of the `image-size` 1.2.1 npm package. It is
kept local because the upstream advisory database currently reports no patched
upstream release for the ICNS, JXL, and HEIF infinite-loop advisories:

- [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)
- [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)

The fork version `2.0.3-core2.0.0` is intentionally distinct from upstream
versions. It is not an upstream release and must not be replaced with a plain
version bump. Metro consumes it through the root `package.json` direct file
dependency and the `metro`-scoped override.

The hardening adds bounded header and length checks plus forward-progress checks
to the ICNS, JXL, HEIF, and generic box parsers. Run the tracked regression
command from the repository root after changing this package:

```text
npm run security:image-size
```

When upstream publishes a release that contains equivalent fixes, replace this
fork only after verifying its source, lockfile, regression fixtures, and
`npm audit --omit=dev` result.
