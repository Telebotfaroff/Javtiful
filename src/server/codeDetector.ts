/**
 * JAV Code Detection and Normalization Utility
 * Supports various formats:
 * - "016DHT-0881", "016DHT_0881", "016DHT 0881", "016dht-0881"
 * - "200GANA-2385", "116SHH-039"
 * - "SSIS-892", "SSIS 892", "ssis892"
 * - Embedded in text: "Check out [016DHT-0881] Hatano Yui"
 */

export interface DetectedCode {
  raw: string;
  prefix: string;
  number: string;
  canonical: string; // e.g. "016DHT-0881", "SSIS-892"
}

export function detectJavCode(text: string): DetectedCode | null {
  if (!text || typeof text !== 'string') return null;

  // Trim and limit to 4000 characters to prevent ReDoS on massive captions
  // Replace brackets, parentheses, and hashtags with whitespace
  const sanitized = text
    .slice(0, 4000)
    .replace(/[#\[\]()【】]/g, ' ')
    .trim();

  if (!sanitized) return null;

  // Pattern 1: Alphanumeric prefix + separator (- or _ or space) + numbers
  // Matches: 016DHT-0881, 200GANA-2385, SSIS-892, MIDE_920, IPX 741
  const sepPattern = /(?:^|[^\w])([0-9]{3}[A-Z]{2,6}|[A-Z]{2,10})[-_ ]([0-9]{2,5})(?:[^\w]|$)/i;
  const sepMatch = sanitized.match(sepPattern);
  if (sepMatch) {
    const prefix = sepMatch[1].toUpperCase();
    const number = sepMatch[2];
    return {
      raw: `${sepMatch[1]}-${number}`,
      prefix,
      number,
      canonical: `${prefix}-${number}`,
    };
  }

  // Pattern 2: Compact format without separator
  // Matches: 016DHT0881, 200GANA2385, SSIS892, MIDE920
  const compactPattern = /(?:^|[^\w])([0-9]{3}[A-Z]{2,6}|[A-Z]{2,10})([0-9]{3,5})(?:[^\w]|$)/i;
  const compactMatch = text.match(compactPattern);
  if (compactMatch) {
    const prefix = compactMatch[1].toUpperCase();
    const number = compactMatch[2];
    return {
      raw: `${compactMatch[1]}${number}`,
      prefix,
      number,
      canonical: `${prefix}-${number}`,
    };
  }

  // Pattern 3: Generalized standard code: 2-5 letters followed by 2-5 digits
  const genPattern = /(?:^|[^\w])([A-Z]{2,6})[-_ ]?([0-9]{3,5})(?:[^\w]|$)/i;
  const genMatch = text.match(genPattern);
  if (genMatch) {
    const prefix = genMatch[1].toUpperCase();
    const number = genMatch[2];
    return {
      raw: `${genMatch[1]}-${number}`,
      prefix,
      number,
      canonical: `${prefix}-${number}`,
    };
  }

  return null;
}
