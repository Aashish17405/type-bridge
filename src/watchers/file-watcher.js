/**
 * File Watcher
 * 
 * Watches schema files and auto-regenerates types on changes
 */

const chokidar = require('chokidar');
const path = require('path');
const chalk = require('chalk');
const { generateTypes } = require('../core/generator');

/**
 * Debounce function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timeoutId;
  
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Watch files and regenerate on changes
 * @param {Object} config - Configuration object
 * @param {Object} options - Watch options
 * @returns {Object} Watcher instance with control methods
 */
function watchFiles(config, options = {}) {
  const {
    onRegenerate = null,
    onError = null,
    debounceDelay = config.watchDebounce || 300
  } = options;

  let watcher;
  let isRegenerating = false;

  // Determine what to watch based on ORM
  const watchPaths = [];
  
  if (config.orm === 'prisma') {
    watchPaths.push(config.schemaPath || './prisma/schema.prisma');
  } else if (config.orm === 'mongoose') {
    watchPaths.push(path.join(config.modelsPath || './models', '**/*.{js,ts}'));
  }

  /**
   * Regenerate types
   */
  const regenerate = debounce(async (changedPath) => {
    if (isRegenerating) return;

    try {
      isRegenerating = true;
      
      console.log(chalk.blue(`\n🔄 Change detected: ${path.basename(changedPath)}`));
      console.log(chalk.gray('Regenerating types...'));

      const result = await generateTypes(config);

      if (result.success) {
        console.log(chalk.green('✅ Types updated successfully!'));
        
        if (onRegenerate) {
          onRegenerate(result);
        }
      } else {
        console.error(chalk.red(`❌ Generation failed: ${result.error}`));
        
        if (onError) {
          onError(new Error(result.error));
        }
      }

    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      
      if (onError) {
        onError(error);
      }
    } finally {
      isRegenerating = false;
    }
  }, debounceDelay);

  /**
   * Start watching
   */
  function start() {
    console.log(chalk.cyan('\n👀 Watching for changes...'));
    console.log(chalk.gray(`Watching: ${watchPaths.join(', ')}\n`));

    watcher = chokidar.watch(watchPaths, {
      ignored: config.exclude || [],
      persistent: true,
      ignoreInitial: true
    });

    watcher
      .on('change', (filePath) => {
        regenerate(filePath);
      })
      .on('add', (filePath) => {
        console.log(chalk.blue(`\n➕ New file: ${path.basename(filePath)}`));
        regenerate(filePath);
      })
      .on('unlink', (filePath) => {
        console.log(chalk.yellow(`\n➖ File deleted: ${path.basename(filePath)}`));
        regenerate(filePath);
      })
      .on('error', (error) => {
        console.error(chalk.red(`\n❌ Watcher error: ${error.message}`));
        if (onError) {
          onError(error);
        }
      });

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log(chalk.yellow('\n\n👋 Shutting down watcher...'));
      await stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    return watcher;
  }

  /**
   * Stop watching
   */
  async function stop() {
    if (watcher) {
      await watcher.close();
      console.log(chalk.gray('Watcher stopped'));
    }
  }

  /**
   * Restart watching
   */
  async function restart() {
    await stop();
    return start();
  }

  return {
    start,
    stop,
    restart,
    get isWatching() {
      return watcher !== undefined;
    }
  };
}

/**
 * Watch with automatic initial generation
 * @param {Object} config - Configuration
 * @param {Object} options - Watch options
 */
async function watchWithGeneration(config, options = {}) {
  // Generate initially
  console.log(chalk.cyan('🚀 Initial generation...\n'));
  
  const result = await generateTypes(config);
  
  if (!result.success) {
    console.error(chalk.red(`❌ Initial generation failed: ${result.error}`));
    throw new Error(result.error);
  }

  console.log(chalk.green('✅ Initial generation complete!'));

  // Start watching
  const watcher = watchFiles(config, options);
  watcher.start();

  return watcher;
}

module.exports = {
  watchFiles,
  watchWithGeneration,
  debounce
};
