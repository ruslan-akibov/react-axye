import babelPlugin from '@rolldown/plugin-babel';
import babelPluginAxye from './babel-plugin.js';

export default function vitePluginAxye() {
  return babelPlugin({
    babelrc: false,
    configFile: false,
    browserslistConfigFile: false,

    exclude: 'node_modules/**',

    plugins: [ babelPluginAxye ]
  });
}
