type ToonPrimitive = string | number | boolean | null;
type ToonArray = ToonValue[];
interface ToonObject {
  [key: string]: ToonValue;
}
type ToonValue = ToonPrimitive | ToonObject | ToonArray;

function isPrimitive(value: ToonValue): value is ToonPrimitive {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isObject(value: ToonValue): value is ToonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrimitiveArray(values: ToonValue[]): values is ToonPrimitive[] {
  return values.every(isPrimitive);
}

function shouldQuoteString(value: string): boolean {
  return value.length === 0 || /[\n\r,:{}\[\]"\\]|^\s|\s$/.test(value);
}

function formatPrimitive(value: ToonPrimitive): string {
  if (typeof value === "string") {
    return shouldQuoteString(value) ? JSON.stringify(value) : value;
  }

  if (value === null) {
    return "null";
  }

  return String(value);
}

function hasUniformObjectShape(values: ToonValue[]): values is ToonObject[] {
  const objects = values.filter(isObject);

  if (values.length === 0 || objects.length !== values.length) {
    return false;
  }

  const keys = Object.keys(objects[0]);

  return objects.every((value) => {
    const currentKeys = Object.keys(value);
    return (
      currentKeys.length === keys.length &&
      currentKeys.every((key, index) => key === keys[index]) &&
      currentKeys.every((key) => isPrimitive(value[key]))
    );
  });
}

function appendObject(lines: string[], object: ToonObject, indent = ""): void {
  for (const [key, value] of Object.entries(object)) {
    appendEntry(lines, key, value, indent);
  }
}

function appendPrimitiveArray(lines: string[], key: string, values: ToonPrimitive[], indent: string): void {
  lines.push(`${indent}${key}[${values.length}]: ${values.map(formatPrimitive).join(",")}`);
}

function appendTabularArray(lines: string[], key: string, values: ToonObject[], indent: string): void {
  const columns = Object.keys(values[0]);
  lines.push(`${indent}${key}[${values.length}]{${columns.join(",")}}:`);

  const rowIndent = `${indent}  `;
  for (const value of values) {
    lines.push(`${rowIndent}${columns.map((column) => formatPrimitive(value[column] as ToonPrimitive)).join(",")}`);
  }
}

function appendArray(lines: string[], key: string, values: ToonValue[], indent: string): void {
  if (isPrimitiveArray(values)) {
    appendPrimitiveArray(lines, key, values, indent);
    return;
  }

  if (hasUniformObjectShape(values)) {
    appendTabularArray(lines, key, values, indent);
    return;
  }

  lines.push(`${indent}${key}[${values.length}]:`);
  const childIndent = `${indent}  `;

  for (const value of values) {
    if (isPrimitive(value)) {
      lines.push(`${childIndent}- ${formatPrimitive(value)}`);
      continue;
    }

    if (Array.isArray(value)) {
      lines.push(`${childIndent}-`);
      appendArray(lines, "items", value, `${childIndent}  `);
      continue;
    }

    lines.push(`${childIndent}-`);
    appendObject(lines, value, `${childIndent}  `);
  }
}

function appendEntry(lines: string[], key: string, value: ToonValue, indent: string): void {
  if (isPrimitive(value)) {
    lines.push(`${indent}${key}: ${formatPrimitive(value)}`);
    return;
  }

  if (Array.isArray(value)) {
    appendArray(lines, key, value, indent);
    return;
  }

  lines.push(`${indent}${key}:`);
  appendObject(lines, value, `${indent}  `);
}

export async function encodeToon(input: unknown): Promise<string> {
  const normalized = input as ToonValue;

  if (isPrimitive(normalized)) {
    return formatPrimitive(normalized);
  }

  if (Array.isArray(normalized)) {
    const lines: string[] = [];
    appendArray(lines, "items", normalized, "");
    return lines.join("\n");
  }

  const lines: string[] = [];
  appendObject(lines, normalized, "");
  return lines.join("\n");
}
