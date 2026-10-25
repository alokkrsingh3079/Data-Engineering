export type NoteCodeLanguage = "plaintext" | "sql" | "python" | "pyspark" | "json";

const templates: Record<NoteCodeLanguage, string> = {
  sql: `-- Purpose: Replace this query with your transformation.
WITH source_data AS (
    SELECT
        id,
        value
    FROM your_source_table
),
transformed AS (
    SELECT
        id,
        value
    FROM source_data
    WHERE value IS NOT NULL
)
SELECT
    id,
    value
FROM transformed;`,
  python: `def transform_records(records):
    """Validate and transform a batch of source records."""
    transformed = []

    for record in records:
        if record.get("value") is None:
            continue

        transformed.append({
            "id": record["id"],
            "value": record["value"],
        })

    return transformed


result = transform_records(source_records)`,
  pyspark: `from pyspark.sql import functions as F

# Use the existing Spark session in Databricks.
source_df = spark.read.option("header", True).csv("/path/to/input.csv")

transformed_df = (
    source_df
    .filter(F.col("value").isNotNull())
    .select("id", "value")
)

display(transformed_df)`,
  json: `{
  "id": "replace-with-source-id",
  "value": "replace-with-transformed-value",
  "is_valid": true
}`,
  plaintext: `# Purpose: Describe the code or data transformation.
# Inputs: List the source data and required fields.
# Steps: Explain validation and transformation logic.
# Output: Describe the expected result.`,
};

export function preferredNoteCodeLanguage(subject: string): NoteCodeLanguage {
  const normalized = subject.toLowerCase();
  if (normalized.includes("sql")) return "sql";
  if (normalized.includes("spark") || normalized.includes("databricks")) return "pyspark";
  if (normalized.includes("python") || normalized.includes("etl")) return "python";
  return "python";
}

export function noteCodeTemplate(language: NoteCodeLanguage): string {
  return `\`\`\`${language === "plaintext" ? "" : language}\n${templates[language]}\n\`\`\``;
}
