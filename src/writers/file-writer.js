/**
 * File Writer
 * 
 * Safely writes generated types to filesystem with:
 * - Automatic backups
 * - Atomic operations
 * - Rollback on error
 * - Permission validation
 */

const fs = require('fs-extra');
const path = require('path');

/**
 * Ensure directory exists, create if needed
 * @param {string} dirPath - Directory path
 */
async function ensureDirectory(dirPath) {
  await fs.ensureDir(dirPath);
}

/**
 * Create backup of existing file
 * @param {string} filePath - Path to file
 * @returns {Promise<string|null>} Backup path or null if no file exists
 */
async function createBackup(filePath) {
  if (!(await fs.pathExists(filePath))) {
    return null;
  }

  const backupPath = `${filePath}.backup`;
  await fs.copy(filePath, backupPath);
  return backupPath;
}

/**
 * Restore from backup
 * @param {string} backupPath - Path to backup file
 * @param {string} originalPath - Original file path
 */
async function restoreBackup(backupPath, originalPath) {
  if (await fs.pathExists(backupPath)) {
    await fs.copy(backupPath, originalPath);
    await fs.remove(backupPath);
  }
}

/**
 * Remove backup file
 * @param {string} backupPath - Path to backup file
 */
async function removeBackup(backupPath) {
  if (backupPath && (await fs.pathExists(backupPath))) {
    await fs.remove(backupPath);
  }
}

/**
 * Check if we have write permissions for a path
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>} True if writable
 */
async function checkWritePermission(filePath) {
  try {
    const dir = path.dirname(filePath);
    await fs.access(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write content to file safely with backup
 * @param {string} filePath - Destination file path
 * @param {string} content - Content to write
 * @param {Object} options - Write options
 * @returns {Promise<Object>} Result with success status
 */
async function writeFileSafe(filePath, content, options = {}) {
  const {
    createBackup: shouldBackup = true,
    encoding = 'utf-8'
  } = options;

  let backupPath = null;

  try {
    // Ensure parent directory exists
    await ensureDirectory(path.dirname(filePath));

    // Check write permission
    const canWrite = await checkWritePermission(filePath);
    if (!canWrite) {
      throw new Error(`No write permission for ${filePath}`);
    }

    // Create backup if file exists and backup is enabled
    if (shouldBackup) {
      backupPath = await createBackup(filePath);
    }

    // Write file atomically (write to temp, then rename)
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, content, { encoding });
    await fs.rename(tempPath, filePath);

    // Remove backup on success
    if (backupPath) {
      await removeBackup(backupPath);
    }

    return {
      success: true,
      filePath,
      backupCreated: backupPath !== null
    };

  } catch (error) {
    // Restore backup on error
    if (backupPath) {
      try {
        await restoreBackup(backupPath, filePath);
      } catch (restoreError) {
        console.error('Failed to restore backup:', restoreError.message);
      }
    }

    return {
      success: false,
      error: error.message,
      filePath
    };
  }
}

/**
 * Write multiple files safely
 * @param {Object[]} files - Array of {path, content} objects
 * @param {Object} options - Write options
 * @returns {Promise<Object>} Results for all files
 */
async function writeMultipleFiles(files, options = {}) {
  const results = [];

  for (const file of files) {
    const result = await writeFileSafe(file.path, file.content, options);
    results.push(result);
  }

  const allSuccess = results.every(r => r.success);
  const successCount = results.filter(r => r.success).length;

  return {
    success: allSuccess,
    total: files.length,
    successful: successCount,
    failed: files.length - successCount,
    results
  };
}

/**
 * Write types organized by model (one file per model)
 * @param {Object[]} models - Array of normalized models with generated code
 * @param {string} outputDir - Output directory
 * @param {Object} options - Write options
 * @returns {Promise<Object>} Write results
 */
async function writeTypesByModel(models, outputDir, options = {}) {
  const files = models.map(model => ({
    path: path.join(outputDir, `${model.modelName}.ts`),
    content: model.generatedCode
  }));

  return await writeMultipleFiles(files, options);
}

/**
 * Write all types to single index file
 * @param {string} content - Generated TypeScript content
 * @param {string} outputPath - Output file path
 * @param {Object} options - Write options
 * @returns {Promise<Object>} Write result
 */
async function writeSingleFile(content, outputPath, options = {}) {
  return await writeFileSafe(outputPath, content, options);
}

/**
 * Clean generated files (remove all .ts files in output directory)
 * @param {string} outputDir - Output directory to clean
 * @param {Object} options - Clean options
 */
async function cleanGeneratedFiles(outputDir, options = {}) {
  const { dryRun = false } = options;

  try {
    if (!(await fs.pathExists(outputDir))) {
      return { success: true, message: 'Output directory does not exist' };
    }

    const files = await fs.readdir(outputDir);
    const tsFiles = files.filter(f => f.endsWith('.ts'));

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        files: tsFiles,
        message: `Would delete ${tsFiles.length} files`
      };
    }

    // Delete all .ts files
    for (const file of tsFiles) {
      await fs.remove(path.join(outputDir, file));
    }

    return {
      success: true,
      deletedCount: tsFiles.length,
      message: `Deleted ${tsFiles.length} generated files`
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  ensureDirectory,
  writeFileSafe,
  writeMultipleFiles,
  writeTypesByModel,
  writeSingleFile,
  cleanGeneratedFiles,
  checkWritePermission
};
