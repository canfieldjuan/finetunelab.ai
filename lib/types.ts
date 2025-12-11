/**
 * Shared Type Definitions
 * Date: 2025-11-13
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];
