export default {
  extends: [
    './.droneey/constitution/presets/typescript/dependency-cruiser/foundation/self.mjs',
    './.droneey/constitution/presets/typescript/dependency-cruiser/foundation/bun.mjs',
    './.droneey/constitution/presets/typescript/dependency-cruiser/foundation/core.mjs',
    './.droneey/constitution/presets/typescript/dependency-cruiser/foundation/typescript.mjs',
    './.droneey/constitution/presets/typescript/dependency-cruiser/architecture/package.mjs',
    './.droneey/constitution/presets/typescript/dependency-cruiser/architecture/core.mjs',
  ],
  options: {
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    // A package of this repository has no main field, only exports, which the resolver skips by default.
    enhancedResolveOptions: {
      exportsFields: [
        'exports',
      ],
      conditionNames: [
        'import',
        'default',
      ],
    },
  },
};
