import babelPlugin from '@rolldown/plugin-babel';
import babelPluginAxye from './babel-plugin.js';

function axyePreset(options = {}) {
  return {
    preset: () => ({
      plugins: [[babelPluginAxye, options]],
    }),
    rolldown: {
      filter: {
        code: /\buseAxye\b/,
      },
    },
  };
}

export default function vitePluginAxye() {
  return babelPlugin({
    babelrc: false,
    configFile: false,
    browserslistConfigFile: false,
    presets: [axyePreset()],
  });
}
