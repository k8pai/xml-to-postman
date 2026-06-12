# xml-to-postman

## 1.1.0

### Minor Changes

- - Added configurable output folder support through `postman.outputDirectory`, defaulting to `postman_collection`.
  - Updated collection and environment file generation so all generated Postman files are written into the configured output directory.
  - Preserved explicit `--outfile` paths while routing simple output filenames into the configured output folder.
  - Added typed variable support for `collection` and `environment` scopes.
  - Changed environment variables to use per-environment `values` maps, generating one Postman environment file per detected environment.
  - Added module-level Postman folder grouping support via `postman.moduleFolders`.
  - Updated query parameter generation to respect `mandatory="true"` by enabling required query params by default.
  - Added configurable XSD schema loading for request body and response example generation.
  - Fixed ESM runtime imports in generated `dist` usage.
  - Updated README, config types, and test entrypoint for the new configuration shape.

## 1.0.5

### Patch Changes

- cli tool includes verbose support

## 1.0.4

### Patch Changes

- updated package reference files to fix typesafe issues.

## 1.0.3

### Patch Changes

- updated package name @k8pai/xml-to-postman

## 1.0.1

### Patch Changes

- 44079bc: initial change
