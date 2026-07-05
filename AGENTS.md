# Repository Guidelines

## Release Process

This package is published by GitHub Actions, not by running `npm publish` locally.

Release steps:

1. Bump the package version from the repository root, for example:

   ```bash
   npm version patch --no-git-tag-version
   ```

2. Build and prepare the ignored `dist/` package locally to verify the publish output:

   ```bash
   npm run build
   node scripts/prepare-publish.mjs
   npm publish ./dist --dry-run
   ```

3. Commit the source changes, including `package.json` and `package-lock.json`.

4. Create and push a matching version tag:

   ```bash
   git tag vX.Y.Z
   git push origin main
   git push origin vX.Y.Z
   ```

The workflow at `.github/workflows/publish.yml` runs on `v*` tag pushes and publishes with:

```bash
npm publish ./dist --access public
```

Do not run a real local `npm publish` for this repo. If a manual package check is needed, use dry-run only.
