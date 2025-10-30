/**
 * Schema Normalizer
 * 
 * All ORM parsers output this STANDARD format.
 * This is the secret to supporting multiple ORMs easily.
 * 
 * Example normalized schema:
 * {
 *   modelName: "User",
 *   fields: [
 *     { name: "id", type: "string", required: true, isPrimary: true },
 *     { name: "email", type: "string", required: true },
 *     { name: "age", type: "number", required: false }
 *   ]
 * }
 */

/**
 * Standard field types supported across all ORMs
 */
const STANDARD_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  DATE: 'Date',
  ARRAY: 'array',
  OBJECT: 'object',
  ANY: 'any',
  NULL: 'null',
  UNDEFINED: 'undefined'
};

/**
 * Normalize a field definition to standard format
 * @param {Object} field - Field definition from ORM parser
 * @returns {Object} Normalized field
 */
function normalizeField(field) {
  return {
    name: field.name,
    type: field.type || STANDARD_TYPES.ANY,
    required: field.required !== false, // Default to required
    isPrimary: field.isPrimary || false,
    isArray: field.isArray || false,
    arrayOf: field.arrayOf || null,
    isEnum: field.isEnum || false,
    enumValues: field.enumValues || null,
    isReference: field.isReference || false,
    referenceTo: field.referenceTo || null,
    defaultValue: field.defaultValue || null,
    description: field.description || null,
    nested: field.nested || null // For nested objects
  };
}

/**
 * Normalize a model/schema to standard format
 * @param {Object} model - Model definition from ORM parser
 * @returns {Object} Normalized model
 */
function normalizeModel(model) {
  return {
    modelName: model.modelName,
    tableName: model.tableName || model.modelName,
    fields: (model.fields || []).map(normalizeField),
    description: model.description || null,
    source: model.source || 'unknown', // 'prisma', 'mongoose', 'typeorm', 'sequelize'
    filePath: model.filePath || null
  };
}

/**
 * Validate normalized schema
 * @param {Object} schema - Normalized schema
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateSchema(schema) {
  const errors = [];

  if (!schema.modelName) {
    errors.push('Model must have a name');
  }

  if (!Array.isArray(schema.fields)) {
    errors.push('Model must have fields array');
  }

  schema.fields?.forEach((field, index) => {
    if (!field.name) {
      errors.push(`Field at index ${index} must have a name`);
    }
    if (!field.type) {
      errors.push(`Field "${field.name}" must have a type`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  STANDARD_TYPES,
  normalizeField,
  normalizeModel,
  validateSchema
};
