// PC Expert Domain - Zod Schema
// Date: October 14, 2025
// Purpose: Validate structured JSON output from LLM for pc-expert domain
//
// This schema enforces that LLM responses include:
// - parts_list: Array of PC components
// - power_calculation: Wattage breakdown
// - assumptions: List of assumptions made
// - total_price: Optional total cost

import { z } from 'zod';

/**
 * PC Part Schema
 * Individual component in a build
 */
export const PCPartSchema = z.object({
  name: z.string().min(1, 'Part name is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z.number().positive().optional(),
  url: z.string().url().optional(),
  category: z.enum([
    'cpu', 'gpu', 'motherboard', 'ram', 'storage',
    'psu', 'case', 'cooling', 'monitor', 'peripherals', 'other'
  ]).optional(),
});

/**
 * Power Calculation Schema
 * Breakdown of wattage usage
 */
export const PowerCalculationSchema = z.object({
  total_watts: z.number().positive('Total watts must be positive'),
  recommended_psu: z.number().positive('Recommended PSU wattage must be positive'),
  breakdown: z.record(z.string(), z.number()),
});

/**
 * PC Expert Output Schema
 * Enforces structured output for PC building queries
 */
export const PCExpertSchema = z.object({
  parts_list: z.array(PCPartSchema).min(1, 'At least one part must be specified'),

  power_calculation: PowerCalculationSchema,

  assumptions: z.array(z.string()).default([]),

  warnings: z.array(z.string()).optional(),

  total_price: z.number().positive().optional(),

  reasoning: z.string().optional(),
});

/**
 * Type inference from schema
 */
export type PCExpertOutput = z.infer<typeof PCExpertSchema>;
export type PCPart = z.infer<typeof PCPartSchema>;
export type PowerCalculation = z.infer<typeof PowerCalculationSchema>;

/**
 * Validation helper
 * Returns { success: true, data } or { success: false, error }
 */
export function validatePCExpertOutput(data: unknown) {
  return PCExpertSchema.safeParse(data);
}

/**
 * Example usage:
 *
 * const llmOutput = {
 *   parts_list: [
 *     { name: "AMD Ryzen 9 7950X", quantity: 1, price: 699, category: "cpu" },
 *     { name: "NVIDIA RTX 4090", quantity: 1, price: 1599, category: "gpu" }
 *   ],
 *   power_calculation: {
 *     total_watts: 650,
 *     recommended_psu: 850,
 *     breakdown: { cpu: 170, gpu: 450, motherboard: 30 }
 *   },
 *   assumptions: ["Gaming workload", "Standard cooling"],
 *   total_price: 2298
 * };
 *
 * const result = validatePCExpertOutput(llmOutput);
 * if (result.success) {
 *   console.log("Valid output:", result.data);
 * } else {
 *   console.error("Validation errors:", result.error.errors);
 * }
 */
