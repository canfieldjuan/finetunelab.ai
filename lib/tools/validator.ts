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
      const expectedTypes = Array.isArray(paramDef.type) ? paramDef.type : [paramDef.type];

      const typeMatches = expectedTypes.some((expectedType) => {
        if (expectedType === 'array') return Array.isArray(paramValue);
        if (expectedType === 'object') return actualType === 'object' && !Array.isArray(paramValue) && paramValue !== null;
        return actualType === expectedType;
      });

      if (!typeMatches) {
        errors.push(`Parameter '${paramName}' must be ${expectedTypes.join(' or ')}, got ${actualType}`);
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
