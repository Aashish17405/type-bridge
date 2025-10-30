/**
 * Configuration Manager
 * 
 * Handles type-bridge.config.json configuration file
 */

const fs = require('fs-extra');
const path = require('path');

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  orm: 'auto', // Auto-detect or 'prisma', 'mongoose', 'typeorm', 'sequelize'
  modelsPath: './models', // For Mongoose, TypeORM, Sequelize
  schemaPath: './prisma/schema.prisma', // For Prisma
  outputPath: './types',
  outputMode: 'single', // 'single' file or 'separate' files
  watch: false,
  watchDebounce: 300, // ms
  includeComments: true,
  exportType: 'export', // 'export' or 'export default'
  readonly: false,
  namingConvention: 'PascalCase', // Model name casing
  exclude: [
    '**/node_modules/**',
    '**/*.test.{js,ts}',
    '**/*.spec.{js,ts}',
    '**/__tests__/**'
  ],
  customTypeMap: {}, // Custom type mappings
  resolveReferences: false, // Import and use actual types for references
  generateIndex: true // Generate index.ts
};

/**
 * Config file name
 */
const CONFIG_FILE_NAME = 'type-bridge.config.json';

/**
 * Find config file in directory hierarchy
 * @param {string} startDir - Starting directory
 * @returns {Promise<string|null>} Config file path or null
 */
async function findConfigFile(startDir = process.cwd()) {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const configPath = path.join(currentDir, CONFIG_FILE_NAME);
    
    if (await fs.pathExists(configPath)) {
      return configPath;
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return null;
}

/**
 * Load configuration from file
 * @param {string} configPath - Path to config file
 * @returns {Promise<Object>} Configuration object
 */
async function loadConfigFile(configPath) {
  try {
    const content = await fs.readJson(configPath);
    return content;
  } catch (error) {
    throw new Error(`Failed to load config file: ${error.message}`);
  }
}

/**
 * Save configuration to file
 * @param {string} configPath - Path to config file
 * @param {Object} config - Configuration object
 */
async function saveConfigFile(configPath, config) {
  try {
    await fs.writeJson(configPath, config, { spaces: 2 });
  } catch (error) {
    throw new Error(`Failed to save config file: ${error.message}`);
  }
}

/**
 * Merge configurations (defaults + file + overrides)
 * @param {Object[]} configs - Array of config objects to merge
 * @returns {Object} Merged configuration
 */
function mergeConfigs(...configs) {
  // Filter out undefined values from configs to prevent overwriting
  const filtered = configs.map(config => {
    const clean = {};
    for (const [key, value] of Object.entries(config || {})) {
      if (value !== undefined) {
        clean[key] = value;
      }
    }
    return clean;
  });
  
  return Object.assign({}, DEFAULT_CONFIG, ...filtered);
}

/**
 * Validate configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateConfig(config) {
  const errors = [];

  // Validate outputPath (now optional, can be defaulted)
  // if (!config.outputPath) {
  //   errors.push('outputPath is required');
  // }

  // Validate outputMode
  if (config.outputMode && !['single', 'separate'].includes(config.outputMode)) {
    errors.push('outputMode must be "single" or "separate"');
  }

  // Validate exportType
  if (!['export', 'export default'].includes(config.exportType)) {
    errors.push('exportType must be "export" or "export default"');
  }

  // Validate ORM
  const validOrms = ['auto', 'prisma', 'mongoose', 'typeorm', 'sequelize'];
  if (!validOrms.includes(config.orm)) {
    errors.push(`orm must be one of: ${validOrms.join(', ')}`);
  }

  // Validate paths exist
  if (config.orm === 'mongoose' && config.modelsPath) {
    // Will be validated at runtime
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Resolve paths relative to project root
 * @param {Object} config - Configuration object
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Config with resolved paths
 */
function resolvePaths(config, projectRoot) {
  const resolved = { ...config };

  // Resolve paths that should be absolute
  const pathKeys = ['modelsPath', 'schemaPath', 'outputPath'];
  
  for (const key of pathKeys) {
    if (resolved[key] && !path.isAbsolute(resolved[key])) {
      resolved[key] = path.resolve(projectRoot, resolved[key]);
    }
  }

  return resolved;
}

/**
 * Load complete configuration
 * @param {Object} options - Load options
 * @returns {Promise<Object>} Final configuration
 */
async function loadConfig(options = {}) {
  const {
    configPath,
    projectRoot = process.cwd(),
    overrides = {}
  } = options;

  try {
    // Find or use provided config file
    const foundConfigPath = configPath || await findConfigFile(projectRoot);
    
    let fileConfig = {};
    if (foundConfigPath) {
      fileConfig = await loadConfigFile(foundConfigPath);
    }

    // Merge all configs
    const merged = mergeConfigs(fileConfig, overrides);

    // Resolve paths
    const resolved = resolvePaths(merged, projectRoot);

    // Validate
    const validation = validateConfig(resolved);
    if (!validation.valid) {
      throw new Error(`Invalid configuration:\n${validation.errors.join('\n')}`);
    }

    return {
      ...resolved,
      configPath: foundConfigPath,
      projectRoot
    };

  } catch (error) {
    throw new Error(`Failed to load configuration: ${error.message}`);
  }
}

/**
 * Create default config file
 * @param {string} projectRoot - Project root directory
 * @param {Object} customConfig - Custom configuration values
 * @returns {Promise<string>} Path to created config file
 */
async function createConfigFile(projectRoot, customConfig = {}) {
  const configPath = path.join(projectRoot, CONFIG_FILE_NAME);

  // Check if already exists
  if (await fs.pathExists(configPath)) {
    throw new Error('Config file already exists');
  }

  // Merge with defaults
  const config = mergeConfigs(customConfig);

  // Save
  await saveConfigFile(configPath, config);

  return configPath;
}

/**
 * Update existing config file
 * @param {string} configPath - Path to config file
 * @param {Object} updates - Configuration updates
 */
async function updateConfigFile(configPath, updates) {
  // Load existing config
  const existing = await loadConfigFile(configPath);

  // Merge updates
  const updated = { ...existing, ...updates };

  // Save
  await saveConfigFile(configPath, updated);
}

module.exports = {
  DEFAULT_CONFIG,
  CONFIG_FILE_NAME,
  loadConfig,
  findConfigFile,
  loadConfigFile,
  saveConfigFile,
  createConfigFile,
  updateConfigFile,
  validateConfig,
  mergeConfigs,
  resolvePaths
};
