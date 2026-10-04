import bun from './.droneey/constitution/presets/typescript/syncpack/foundation/bun.mjs';
import foundationPackage from './.droneey/constitution/presets/typescript/syncpack/foundation/package.mjs';
import self from './.droneey/constitution/presets/typescript/syncpack/foundation/self.mjs';
import typescript from './.droneey/constitution/presets/typescript/syncpack/foundation/typescript.mjs';
import workflowPackage from './.droneey/constitution/presets/typescript/syncpack/workflow/package.mjs';

export default {
  ...self,
  ...typescript,
  customTypes: workflowPackage.customTypes,
  versionGroups: [
    ...bun.versionGroups,
    ...foundationPackage.versionGroups,
    ...workflowPackage.versionGroups,
  ],
};
