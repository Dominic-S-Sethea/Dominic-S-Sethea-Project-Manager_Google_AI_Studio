
const REDACTED = "[REDACTED]";

export const SECRET_KEY_PATTERNS: readonly RegExp[] = [
  /^(?:password|passwd|pwd|secret|token|jwt|authorization|cookie)$/i,
  /^(?:api[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret)$/i,
  /^(?:private[-_]?key|password[-_]?hash|api[-_]?key[-_]?hash)$/i,
  /^(?:reference|credential[-_]?reference)$/i,
];

const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
];

const PII_KEY_PATTERNS: readonly RegExp[] = [
  /^email$/i,
  /^username$/i,
  /^ip_address$/i,
  /^device_fingerprint$/i,
  /^user_agent$/i,
];

const FINANCIAL_KEY_PATTERN =
  /(?:billing|payment|invoice|card_number|account_number|bank_account|balance|amount|cost|price)/i;

const INTERNAL_KEY_PATTERN =
  /^(?:stack|stacktrace|file_path|absolute_path|filesystem_path|sql|query_text)$/i;

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function containsSecretValue(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function maskIpAddress(value: string): string {
  if (value.includes(".")) {
    const parts = value.split(".");
    if (parts.length === 4) {
      return `${parts[0] ?? "***"}.${parts[1] ?? "***"}.***.***`;
    }
  }

  if (value.includes(":")) {
    const parts = value.split(":");
    return `${parts.slice(0, 2).join(":")}:****:****`;
  }

  return REDACTED;
}

export function maskEmail(email: string): string {
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || separator === email.length - 1) {
    return REDACTED;
  }

  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Recursive public/audit serializer.
 *
 * Credential references, raw secrets, hashes and token-like values are
 * replaced before serialization. PII is masked by default. Internal paths,
 * SQL and stack traces are never returned from public serializers.
 */
export function redact(value: unknown): unknown {
  const seen = new WeakSet<object>();

  const visit = (current: unknown, key = ""): unknown => {
    if (key && isSecretKey(key)) return REDACTED;
    if (key && FINANCIAL_KEY_PATTERN.test(key)) return REDACTED;
    if (key && INTERNAL_KEY_PATTERN.test(key)) return REDACTED;

    if (typeof current === "string") {
      if (containsSecretValue(current)) return REDACTED;

      if (/^email$/i.test(key)) return maskEmail(current);
      if (/^username$/i.test(key)) return "***";
      if (/^ip_address$/i.test(key)) return maskIpAddress(current);
      if (/^(?:device_fingerprint|user_agent)$/i.test(key)) return REDACTED;

      return current;
    }

    if (
      current === null ||
      typeof current === "number" ||
      typeof current === "boolean"
    ) {
      return current;
    }

    if (typeof current === "bigint") {
      return current.toString();
    }

    if (typeof current === "undefined") {
      return null;
    }

    if (current instanceof Date) {
      return current.toISOString();
    }

    if (current instanceof Error) {
      return {
        name: current.name,
        message: visit(current.message, "message"),
      };
    }

    if (typeof current !== "object") {
      return REDACTED;
    }

    if (seen.has(current)) {
      return "[CIRCULAR]";
    }
    seen.add(current);

    if (Array.isArray(current)) {
      return current.map((entry) => visit(entry));
    }

    const result: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(current)) {
      result[entryKey] = visit(entryValue, entryKey);
    }
    return result;
  };

  return visit(value);
}

/**
 * Redacts only secret-bearing keys and recognizable secret values.
 * Used during startup compatibility cleanup so non-secret legacy connector
 * settings are not unnecessarily discarded.
 */
export function redactSecrets(value: unknown): unknown {
  const seen = new WeakSet<object>();

  const visit = (current: unknown, key = ""): unknown => {
    if (key && isSecretKey(key)) return REDACTED;

    if (typeof current === "string") {
      return containsSecretValue(current) ? REDACTED : current;
    }

    if (
      current === null ||
      typeof current === "number" ||
      typeof current === "boolean"
    ) {
      return current;
    }

    if (typeof current === "undefined") return null;
    if (current instanceof Date) return current.toISOString();
    if (typeof current === "bigint") return current.toString();

    if (typeof current !== "object") return REDACTED;
    if (seen.has(current)) return "[CIRCULAR]";
    seen.add(current);

    if (Array.isArray(current)) {
      return current.map((entry) => visit(entry));
    }

    const result: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(current)) {
      result[entryKey] = visit(entryValue, entryKey);
    }
    return result;
  };

  return visit(value);
}

/**
 * Returns a redacted JSON snapshot suitable for audit storage.
 * Null/undefined snapshots remain SQL NULL.
 */
export function redactForAudit(value: unknown): string | null {
  if (value === null || typeof value === "undefined") return null;

  try {
    const serialized = JSON.stringify(redact(value));
    return typeof serialized === "string" ? serialized : null;
  } catch {
    return JSON.stringify({ value: REDACTED });
  }
}

/**
 * Detects secret-bearing keys or recognizable token/private-key patterns.
 * The credential_ref and credential_reference_id identifiers are deliberately
 * not classified as secret values; they identify a reference record, not its
 * stored secret-store pointer.
 */
export function containsSecretMaterial(value: unknown): boolean {
  const seen = new WeakSet<object>();

  const visit = (current: unknown, key = ""): boolean => {
    if (key && isSecretKey(key)) return true;

    if (typeof current === "string") {
      return containsSecretValue(current);
    }

    if (
      current === null ||
      typeof current === "number" ||
      typeof current === "boolean" ||
      typeof current === "undefined"
    ) {
      return false;
    }

    if (typeof current !== "object") return false;
    if (seen.has(current)) return false;
    seen.add(current);

    if (Array.isArray(current)) {
      return current.some((entry) => visit(entry));
    }

    return Object.entries(current).some(([entryKey, entryValue]) =>
      visit(entryValue, entryKey),
    );
  };

  return visit(value);
}

export function isSecretConfigKey(key: string): boolean {
  return isSecretKey(key);
}

export function hasSecretValuePattern(value: string): boolean {
  return containsSecretValue(value);
}
