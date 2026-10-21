import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = path.resolve(HERE, "..", "..", "schemas");

const schemaCache = new Map();
function getSchema(schemaName) {
  if (!schemaCache.has(schemaName)) {
    const filePath = path.join(SCHEMAS_DIR, `${schemaName}.schema.json`);
    schemaCache.set(schemaName, JSON.parse(fs.readFileSync(filePath, "utf8")));
  }
  return schemaCache.get(schemaName);
}

export function stripFences(text) {
  const trimmed = String(text ?? "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

export function parseStructuredOutput(rawText, schemaName) {
  const inner = stripFences(rawText);
  if (!inner) {
    return {
      parsed: null,
      parseError: "Empty output from model.",
      rawOutput: rawText ?? ""
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(inner);
  } catch (err) {
    return {
      parsed: null,
      parseError: `JSON parse failed: ${err.message}`,
      rawOutput: rawText
    };
  }
  const validationErrors = validate(parsed, getSchema(schemaName), "");
  if (validationErrors.length > 0) {
    return {
      parsed: null,
      parseError: `Schema validation failed: ${validationErrors.join("; ")}`,
      rawOutput: rawText
    };
  }
  return { parsed, parseError: null, rawOutput: rawText };
}

// The review prompt requires a source for a `supported` verdict, but the
// schema does not check it. Such a claim becomes `uncertain`, with the reason,
// and a `trustworthy` overall becomes `mixed`. The other claims stay as they are.
// Only an http(s) URL, after trimming, counts as a source.
const UNSOURCED_NOTE = "[The plugin changed this verdict from supported: no source URL was cited.]";

export function isSourceUrl(source) {
  if (typeof source !== "string") return false;
  try {
    return ["http:", "https:"].includes(new URL(source.trim()).protocol);
  } catch {
    return false;
  }
}

export function parseReviewOutput(rawText) {
  const out = parseStructuredOutput(rawText, "review-output");
  if (!out.parsed) return out;
  let changed = false;
  for (const claim of out.parsed.claims) {
    if (claim.verdict === "supported" && !(claim.sources ?? []).some(isSourceUrl)) {
      claim.verdict = "uncertain";
      claim.reasoning = `${claim.reasoning} ${UNSOURCED_NOTE}`;
      changed = true;
    }
  }
  if (changed && out.parsed.overall === "trustworthy") out.parsed.overall = "mixed";
  return out;
}

// The keywords that `validate` checks, and ones that only describe.
export const SUPPORTED_SCHEMA_KEYWORDS = [
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "minimum",
  "description",
  "title",
  "$schema"
];

/** The keywords in a caller's schema that `validate` would skip, so it cannot check them. */
export function unsupportedSchemaKeywords(schema) {
  const found = new Set();
  const walk = (node) => {
    if (node === null || typeof node !== "object" || Array.isArray(node)) {
      found.add("(a schema that is not an object)");
      return;
    }
    // validate checks properties and items only under their own type.
    const has = (k) => Object.hasOwn(node, k);
    if ((has("properties") || has("required") || has("additionalProperties")) && node.type !== "object") {
      found.add('properties without "type": "object"');
    }
    if (has("items") && node.type !== "array") found.add('items without "type": "array"');
    for (const [key, value] of Object.entries(node)) {
      if (!SUPPORTED_SCHEMA_KEYWORDS.includes(key)) found.add(key);
      else if (key === "type" && typeof value !== "string") found.add("type with a list of types");
      else if (key === "properties") Object.values(value ?? {}).forEach(walk);
      else if (key === "items") walk(value);
      else if (key === "additionalProperties" && typeof value !== "boolean") found.add("additionalProperties with a schema");
    }
  };
  walk(schema);
  return [...found];
}

/** Like parseStructuredOutput, for a schema that the caller passed in. */
export function parseAgainstSchema(rawText, schema) {
  const inner = stripFences(rawText);
  if (!inner) return { parsed: null, parseError: "Empty output from model.", rawOutput: rawText ?? "" };
  let parsed;
  try {
    parsed = JSON.parse(inner);
  } catch (err) {
    return { parsed: null, parseError: `JSON parse failed: ${err.message}`, rawOutput: rawText };
  }
  const errors = validate(parsed, schema, "");
  if (errors.length > 0) return { parsed: null, parseError: `Schema validation failed: ${errors.join("; ")}`, rawOutput: rawText };
  return { parsed, parseError: null, rawOutput: rawText };
}

function validate(value, schema, pathStr) {
  const errors = [];
  const location = pathStr || "(root)";

  if (schema.enum) {
    if (!schema.enum.some((option) => sameJson(option, value))) {
      errors.push(`${location}: expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`);
      return errors;
    }
  }

  if (schema.type) {
    const actualType = jsonType(value);
    if (schema.type === "integer") {
      if (actualType !== "number" || !Number.isInteger(value)) {
        errors.push(`${location}: expected integer, got ${actualType}`);
        return errors;
      }
    } else if (actualType !== schema.type) {
      errors.push(`${location}: expected ${schema.type}, got ${actualType}`);
      return errors;
    }
  }

  if (typeof schema.minimum === "number" && typeof value === "number") {
    if (value < schema.minimum) {
      errors.push(`${location}: expected >= ${schema.minimum}, got ${value}`);
    }
  }

  if (schema.type === "object" && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const required = schema.required ?? [];
    for (const key of required) {
      if (!Object.hasOwn(value, key)) {
        errors.push(`${location}: missing required property "${key}"`);
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
          errors.push(`${location}: unexpected property "${key}"`);
        }
      }
    }
    if (schema.properties) {
      for (const [key, childSchema] of Object.entries(schema.properties)) {
        if (Object.hasOwn(value, key)) {
          errors.push(...validate(value[key], childSchema, joinPath(pathStr, key)));
        }
      }
    }
  }

  if (schema.type === "array" && Array.isArray(value)) {
    if (schema.items) {
      value.forEach((item, i) => {
        errors.push(...validate(item, schema.items, `${pathStr}[${i}]`));
      });
    }
  }

  return errors;
}

// True when two JSON values are equal: by value, also for objects and arrays.
function sameJson(a, b) {
  if (a === b) return true;
  if (jsonType(a) !== jsonType(b) || a === null || typeof a !== "object") return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => sameJson(x, b[i]));
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && sameJson(a[k], b[k]));
}

function jsonType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function joinPath(parent, key) {
  return parent ? `${parent}.${key}` : key;
}

export const internals = { stripFences, validate };
