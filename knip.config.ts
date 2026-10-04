import architecture from './.droneey/constitution/presets/typescript/knip/architecture/core.mjs';
import betterleaks from './.droneey/constitution/presets/typescript/knip/foundation/betterleaks.mjs';
import core from './.droneey/constitution/presets/typescript/knip/foundation/core.mjs';
import lsLint from './.droneey/constitution/presets/typescript/knip/foundation/ls-lint.mjs';
import mise from './.droneey/constitution/presets/typescript/knip/foundation/mise.mjs';
import osvScanner from './.droneey/constitution/presets/typescript/knip/foundation/osv-scanner.mjs';
import uv from './.droneey/constitution/presets/typescript/knip/foundation/uv.mjs';

export default {
  workspaces: {
    '.': {
      entry: [
        'libs/__tests__/sandbox.fixtures.ts',
      ],
      project: [
        'libs/**/*.ts',
        'packages/*/common/__tests__/**/*.ts',
      ],
    },
    'packages/*/typescript/*': {
      entry: [
        ...core.entry,
        ...architecture.entry,
      ],
      project: core.project,
    },
  },
  ignoreBinaries: [
    ...betterleaks.ignoreBinaries,
    ...lsLint.ignoreBinaries,
    ...mise.ignoreBinaries,
    ...osvScanner.ignoreBinaries,
    ...uv.ignoreBinaries,
  ],
  ignoreDependencies: [
    // The archive's mutation-check runs the stryker binary, which knip does not see.
    '@stryker-mutator/core',
    '@stryker-mutator/command-runner',
    // dependency-cruiser's preset parses with swc, which knip does not see.
    '@swc/core',
  ],
};
