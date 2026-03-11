import type { ParsedCommand } from '@/types';

/**
 * Normalize user input: trim, lowercase, strip accents/diacritics.
 */
export function normalizeInput(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const KEYWORDS = new Set(['hola', 'menu', 'pedir', 'cancelar', 'ayuda', 'si', 'no', 'listo']);

/**
 * Parse normalized input into a structured command.
 */
export function parseCommand(raw: string): ParsedCommand {
  const normalized = normalizeInput(raw);

  // Check for keyword match
  if (KEYWORDS.has(normalized)) {
    return { type: 'keyword', value: normalized };
  }

  // Check for plain number (e.g., "1", "03", "12")
  const numMatch = normalized.match(/^0*(\d+)$/);
  if (numMatch?.[1]) {
    const num = parseInt(numMatch[1], 10);
    return { type: 'number', value: numMatch[1], num };
  }

  // Fallback: plain text
  return { type: 'text', value: normalized };
}

/**
 * Parse quantity from user input. Recognizes:
 * - Plain numbers: "2" -> 2
 * - x-prefix: "x3" -> 3
 * - x-suffix: "2x" -> 2
 * Returns undefined if no quantity pattern found.
 */
export function parseQuantity(raw: string): number | undefined {
  const normalized = normalizeInput(raw);

  // "x3" or "x 3"
  const xPrefix = normalized.match(/^x\s*(\d+)$/);
  if (xPrefix?.[1]) return parseInt(xPrefix[1], 10);

  // "3x" or "3 x"
  const xSuffix = normalized.match(/^(\d+)\s*x$/);
  if (xSuffix?.[1]) return parseInt(xSuffix[1], 10);

  // Plain number
  const plain = normalized.match(/^(\d+)$/);
  if (plain?.[1]) return parseInt(plain[1], 10);

  return undefined;
}

/** Global keywords that restart the conversation */
export const RESTART_KEYWORDS = new Set(['hola', 'menu', 'pedir']);

/** Check if input is a restart keyword */
export function isRestartKeyword(normalized: string): boolean {
  return RESTART_KEYWORDS.has(normalizeInput(normalized));
}
