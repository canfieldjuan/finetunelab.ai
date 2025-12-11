// Tool Parameter Validator
// Validates tool parameters against schema before execution
// Date: 2025-01-XX

import { 
  ToolDefinition, 
  ToolParameterValidationResult, 
  ToolValidator 
} from './types';

/**
 * Default tool parameter validator implementation
 */
export class DefaultToolValidator implements ToolValidator {
  /**
   * Validate parameters against tool definition
   */
  validateParameters(
    params: Record<string, unknown>,
    toolDef: ToolDefinition
  ): ToolParameterValidationResult {
    const errors: string[] = [];

    // Check required parameters
    for (const requiredParam of toolDef.parameters.required) {
      if (!(requiredParam in params) || params[requiredParam] === undefined) {
        errors.push(`Missing required parameter: ${requiredParam}`);
      }
    }

    // Validate parameter types
    for (const [paramName, paramValue] of Object.entries(params)) {
      const paramDef = toolDef.parameters.properties[paramName];
      
      if (!paramDef) {
        errors.push(`Unknown parameter: ${paramName}`);
        continue;
      }

      // Type validation
      const actualType = typeof paramValue;
      const expectedType = paramDef.type;

      if (expectedType === 'string' && actualType !== 'string') {
        errors.push(`Parameter '${paramName}' must be a string, got ${actualType}`);
      } else if (expectedType === 'number' && actualType !== 'number') {
        errors.push(`Parameter '${paramName}' must be a number, got ${actualType}`);
      } else if (expectedType === 'boolean' && actualType !== 'boolean') {
        errors.push(`Parameter '${paramName}' must be a boolean, got ${actualType}`);
      } else if (expectedType === 'array' && !Array.isArray(paramValue)) {
        errors.push(`Parameter '${paramName}' must be an array, got ${actualType}`);
      } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(paramValue) || paramValue === null)) {
        errors.push(`Parameter '${paramName}' must be an object, got ${actualType}`);
      }

      // Enum validation
      if (paramDef.enum && paramDef.enum.length > 0) {
        if (!paramDef.enum.includes(paramValue as string)) {
          errors.push(`Parameter '${paramName}' must be one of: ${paramDef.enum.join(', ')}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Global validator instance
 */
export const toolValidator = new DefaultToolValidator();
