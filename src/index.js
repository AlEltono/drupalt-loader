import 'loader-utils';
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

/**
 * Webpack plugin to extract the Drupal.t strings used in a JS project.
 */
export default class DrupalTWebpackPlugin {

  /**
   * Create new instance of DrupalTWebpackPlugin.
   */
  constructor ({
    filename = 'drupal-t.js',
    extensions = ['js']
  }) {
    this.options = {
      filename,
      extensions
    };

    this.storage = {};
  }

  /**
   * Run the plugin against a webpack compiler instance.
   */
  apply (compiler) {
    let drupalstring,
        filestoscan = [],
        content;

    // Filter the files with passed in extensions.
    let regex = new RegExp('(\.' + this.options.extensions.join('$|\.') + '$)');

    compiler.plugin('emit', (compilation, callback) => {

      // We must set promises in order to get the final drupal string.
      compilation.chunks.map((chunk) => {

        chunk.modules.map((module) => {

          // FailSafe
          module.fileDependencies = module.fileDependencies || [];

          if (module.fileDependencies.length === 0) {
            return;
          }

          let files = module.fileDependencies.filter((name) => regex.test(name) &&
            (/^((?!node_modules).)*$/).test(name))

          if (files.length === 0) {
            return;
          }

          // Add the filepath to the global array.
          filestoscan = filestoscan.concat(files);

        });

      });

      let promise = this.readAllFileAsync(filestoscan);

      promise.then((files) => {
        let drupalString = '';

        files.map((file) => {
          drupalString += this.getDrupalT(file);
        });

        compilation.assets[this.options.filename] = {
          source: () => `/** ${drupalString} **/`,
          size: () => drupalString.length
        };

        callback();
      });

    });

  }

  getDrupalT (source) {
    // Regex to get strings translated with vueJS drupal filter.
    let regex = /(?:{{\s+'(.*)'\s+\|\s+drupalT(?:\(?(.*)\))?\s+}}|(?:filters\.drupalT|Drupal\.t)[^(]*\('([^)']*)[^)](?:\,\s(.*))?\))/g;

    // Object result.
    let result = {
      text: '',
      args: {}
    };

    // Content.
    let content = '';
    let m;

    // Failsafe.
    source = source || '';

    while ((m = regex.exec(source)) !== null) {

        result = {
          text: '',
          args: '{}'
        };

        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }

        // The result can be accessed through the `m`-variable.
        m.forEach((match, groupIndex) => {
          if (typeof match === 'undefined') {
            return;
          }

          switch (groupIndex) {
            case 1:
            case 3:
              result.text = match;
              break;

            default:
              return;
          }

        });

      // Format the output and pass it to data if not already done.
      if (!this.isInBin(result.text)) {
        content += `Drupal.t('${result.text}', ${result.args}, {context: 'Front-end'});` + '\r\n';
      }

    }

    return content;
  }

  readAllFileAsync (filepaths) {
    let getDrupalT = this.getDrupalT;
    let promises = [];

    for (var i = 0; i <= filepaths.length; i++) {
      let path = filepaths[i];
      if (typeof path !== 'string') {
        continue;
      }

      promises.push(fs.readFileAsync(path));
    }

    return Promise.all(promises);
  }

  isInBin(string) {
    if (typeof this.storage[string] !== 'undefined') {
      return true;
    }

    this.storage[string] = true;
    return false;
  }
}
