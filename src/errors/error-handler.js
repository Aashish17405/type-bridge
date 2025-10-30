/**
 * Error Handler
 * 
 * Provides helpful error messages with:
 * - Error codes
 * - Actionable suggestions
 * - Documentation links
 */

const chalk = require('chalk');

/**
 * Error codes and messages
 */
const ERROR_CODES = {
  E1001: {
    message: 'No supported ORM detected',
    suggestions: [
      'Install one of the supported ORMs:',
      '  - Prisma: npm install prisma @prisma/client',
      '  - Mongoose: npm install mongoose',
      'Verify package.json includes the ORM dependency'
    ],
    docsUrl: 'https://github.com/type-bridge/type-bridge#supported-orms'
  },
  
  E1002: {
    message: 'No models found',
    suggestions: [
      'For Prisma: Check that schema.prisma exists and has model definitions',
      'For Mongoose: Check that modelsPath points to correct directory',
      'Verify models directory contains .js or .ts files',
      'Check exclude patterns in config'
    ],
    docsUrl: 'https://github.com/type-bridge/type-bridge#configuration'
  },
  
  E1003: {
    message: 'Invalid configuration',
    suggestions: [
      'Check type-bridge.config.json syntax',
      'Verify all required fields are present',
      'Run: npx type-bridge init to create valid config'
    ],
    docsUrl: 'https://github.com/type-bridge/type-bridge#configuration'
  },
  
  E1004: {
    message: 'No write permission',
    suggestions: [
      'Check output directory permissions',
      'Ensure directory exists or type-bridge has permission to create it',
      'Try running with appropriate permissions'
    ]
  },
  
  E1005: {
    message: 'Schema parsing failed',
    suggestions: [
      'Check for syntax errors in schema files',
      'Verify schema uses supported patterns',
      'Check file can be required/imported without errors'
    ],
    docsUrl: 'https://github.com/type-bridge/type-bridge#supported-patterns'
  },
  
  E1006: {
    message: 'Schema validation failed',
    suggestions: [
      'Check schema has valid model name',
      'Verify all fields have names and types',
      'Review validation errors for details'
    ]
  },
  
  E1007: {
    message: 'File write failed',
    suggestions: [
      'Check disk space',
      'Verify output path is writable',
      'Ensure no other process is using the file'
    ]
  },
  
  E1008: {
    message: 'Unsupported ORM',
    suggestions: [
      'Currently supported ORMs:',
      '  - Prisma',
      '  - Mongoose',
      'More ORMs coming soon!',
      'Check documentation for updates'
    ],
    docsUrl: 'https://github.com/type-bridge/type-bridge#supported-orms'
  }
};

/**
 * Custom error class
 */
class TypeBridgeError extends Error {
  constructor(code, details = {}) {
    const errorInfo = ERROR_CODES[code];
    
    if (!errorInfo) {
      super(`Unknown error code: ${code}`);
      this.code = 'E0000';
      return;
    }

    super(errorInfo.message);
    this.code = code;
    this.suggestions = errorInfo.suggestions;
    this.docsUrl = errorInfo.docsUrl;
    this.details = details;
    this.name = 'TypeBridgeError';
  }
}

/**
 * Format error message for console
 * @param {Error} error - Error object
 * @returns {string} Formatted error message
 */
function formatError(error) {
  const lines = [];

  // Error header
  if (error instanceof TypeBridgeError) {
    lines.push('');
    lines.push(chalk.red.bold(`❌ Error (${error.code}): ${error.message}`));
    lines.push('');

    // Suggestions
    if (error.suggestions && error.suggestions.length > 0) {
      lines.push(chalk.yellow('💡 Suggestions:'));
      error.suggestions.forEach(suggestion => {
        lines.push(chalk.yellow(`  ${suggestion}`));
      });
      lines.push('');
    }

    // Details
    if (error.details && Object.keys(error.details).length > 0) {
      lines.push(chalk.gray('Details:'));
      Object.entries(error.details).forEach(([key, value]) => {
        lines.push(chalk.gray(`  ${key}: ${value}`));
      });
      lines.push('');
    }

    // Documentation link
    if (error.docsUrl) {
      lines.push(chalk.blue(`📖 Documentation: ${error.docsUrl}`));
      lines.push('');
    }
  } else {
    // Generic error
    lines.push('');
    lines.push(chalk.red.bold(`❌ Error: ${error.message}`));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Log error to console
 * @param {Error} error - Error to log
 * @param {Object} options - Logging options
 */
function logError(error, options = {}) {
  const { verbose = false } = options;

  const formatted = formatError(error);
  console.error(formatted);

  // Show stack trace in verbose mode
  if (verbose && error.stack) {
    console.error(chalk.gray('Stack trace:'));
    console.error(chalk.gray(error.stack));
  }
}

/**
 * Handle promise rejection
 * @param {Error} error - Error from rejected promise
 * @param {Object} options - Options
 */
function handleError(error, options = {}) {
  logError(error, options);
  
  // Exit process if not in test environment
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

/**
 * Wrap async function with error handling
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
function withErrorHandling(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error);
    }
  };
}

/**
 * Create error from code
 * @param {string} code - Error code
 * @param {Object} details - Error details
 * @returns {TypeBridgeError} Error instance
 */
function createError(code, details = {}) {
  return new TypeBridgeError(code, details);
}

/**
 * Assert condition or throw error
 * @param {boolean} condition - Condition to assert
 * @param {string} code - Error code if assertion fails
 * @param {Object} details - Error details
 */
function assert(condition, code, details = {}) {
  if (!condition) {
    throw createError(code, details);
  }
}

module.exports = {
  TypeBridgeError,
  ERROR_CODES,
  formatError,
  logError,
  handleError,
  withErrorHandling,
  createError,
  assert
};
