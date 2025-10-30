/**
 * Main entry point for type-bridge
 * Exports the core API for programmatic use
 */

const { generateTypes } = require('./core/generator');
const { watchFiles } = require('./watchers/file-watcher');
const { loadConfig } = require('./config/config-manager');

module.exports = {
  generateTypes,
  watchFiles,
  loadConfig
};
