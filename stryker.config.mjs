import architecture from './.droneey/constitution/presets/typescript/stryker/architecture/core.mjs';
import bunTest from './.droneey/constitution/presets/typescript/stryker/foundation/bun-test.mjs';
import core from './.droneey/constitution/presets/typescript/stryker/foundation/core.mjs';
import mise from './.droneey/constitution/presets/typescript/stryker/foundation/mise.mjs';
import self from './.droneey/constitution/presets/typescript/stryker/foundation/self.mjs';

const PACKAGES = 'packages/*/typescript/*/';

// The presets name paths from a package's root; the check runs from the repository's.
const inPackages = (pattern) =>
  pattern.startsWith('!') ? `!${PACKAGES}${pattern.slice(1)}` : `${PACKAGES}${pattern}`;

export default {
  ...self,
  ...mise,
  ...bunTest,
  ...core,
  ignorePatterns: [
    ...mise.ignorePatterns,
    '.venv',
    'packages/*/python',
  ],
  mutate: [
    ...core.mutate,
    ...architecture.mutate,
  ].map(inPackages),
};
