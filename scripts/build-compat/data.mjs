/* https://github.com/import-js/eslint-plugin-import/issues/2181 */
import { dataWithIgnored as data, ignored, modules } from 'core-js-compat/src/data.mjs';
import external from 'core-js-compat/src/external.mjs';
import mappings from 'core-js-compat/src/mapping.mjs';
import helpers from 'core-js-compat/helpers.js';

const { compare, has, semver, sortObjectByKey } = helpers;

for (const scope of [data, external]) {
  for (const [key, module] of Object.entries(scope)) {
    const { chrome, ie } = module;

    function map(mappingKey) {
      const [engine, targetKey] = mappingKey.split('To')
        .map(it => it.replace(/([a-z])([A-Z])/, (_, a, b) => `${ a }_${ b }`).toLowerCase());
      const version = module[engine];
      if (!version || has(module, targetKey)) return;
      const mapping = mappings[mappingKey];
      if (typeof mapping == 'function') {
        return module[targetKey] = String(mapping(version));
      }
      const source = semver(version);
      for (const [from, to] of mapping) {
        if (compare(source, '<=', from)) {
          return module[targetKey] = String(to);
        }
      }
    }

    map('ChromeToAndroid');
    if (!has(module, 'android') && chrome) {
      module.android = String(Math.max(chrome, 37));
    }
    if (key.startsWith('es')) {
      map('ChromeToDeno');
    }
    if (/^(?:es|esnext|web)\./.test(key)) {
      map('ChromeToElectron');
    }
    if (!has(module, 'edge')) {
      if (ie && !key.includes('immediate')) {
        module.edge = '12';
      } else if (chrome) {
        module.edge = String(Math.max(chrome, 79));
      }
    }
    if (key.startsWith('es')) {
      map('ChromeToNode');
    }
    map('ChromeToOpera');
    if (!has(module, 'opera_mobile') && module.opera <= 42) {
      module.opera_mobile = module.opera;
    } else {
      map('ChromeToOperaMobile');
    }
    map('ChromeToSamsung');
    map('AndroidToOculus');
    if (/^(?:es|esnext)\./.test(key)) {
      map('SafariToBun');
    }
    map('SafariToIOS');
    if (!has(module, 'ios') && has(module, 'safari') && semver(module.safari).major >= 15) {
      module.ios = module.safari;
    }
    map('SafariToPhantom');

    for (const [engine, version] of Object.entries(module)) {
      if (!version) delete module[engine];
    }

    scope[key] = sortObjectByKey(module);
  }
}

function write(filename, content) {
  return fs.writeJson(`packages/core-js-compat/${ filename }.json`, content, { spaces: '  ' });
}

const dataWithoutIgnored = { ...data };

for (const ignore of ignored) delete dataWithoutIgnored[ignore];

await Promise.all([
  write('data', dataWithoutIgnored),
  write('modules', modules),
  write('external', external),
  // version for compat data tests
  fs.writeFile('tests/compat/compat-data.js', `;(typeof global != 'undefined' ? global : Function('return this')()).data = ${
    JSON.stringify(data, null, '  ')
  }`),
]);

echo(chalk.green('compat data rebuilt'));
