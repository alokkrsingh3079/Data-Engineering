export function validateDatasetCodingInput(input: unknown, columns: string[], caseName: string): string | null {
  if (!Array.isArray(input) || input.length === 0 || input.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    return `Test case "${caseName}" must use a non-empty list of dataset records`;
  }

  const expectedColumns = new Set(columns);
  for (let index = 0; index < input.length; index++) {
    const row = input[index] as Record<string, unknown>;
    const rowColumns = Object.keys(row);
    const missing = columns.filter((column) => !Object.hasOwn(row, column));
    const unknown = rowColumns.filter((column) => !expectedColumns.has(column));
    if (missing.length || unknown.length) {
      const details = [
        missing.length ? `missing dataset columns: ${missing.join(", ")}` : "",
        unknown.length ? `unknown columns: ${unknown.join(", ")}` : ""
      ].filter(Boolean).join("; ");
      return `Test case "${caseName}", record ${index + 1} must match the selected table schema (${details})`;
    }
  }

  return null;
}
