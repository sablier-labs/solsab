/**
 * @type {import("lint-staged").Configuration}
 */
module.exports = {
  "*.{js,json,jsonc,ts}": "na biome check --no-errors-on-unmatched --write",
  "*.{js,ts}": "na biome lint --no-errors-on-unmatched --unsafe --write --only correctness/noUnusedImports",
  "*.{md,yml}": "na prettier --cache --write",
};
