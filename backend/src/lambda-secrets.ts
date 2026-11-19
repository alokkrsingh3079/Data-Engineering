import { GetParametersByPathCommand, SSMClient } from "@aws-sdk/client-ssm";

const parameterNames = new Set([
  "MONGODB_URI",
  "MONGODB_DATABASE",
  "DATABASE_URL",
  "PRACTICE_DATABASE_URL",
  "AUTH_SECRET",
  "PRACTICE_ROLE_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "ADMIN_NAME",
  "GEMENI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GEMENI_MODEL",
  "GEMINI_MODEL",
  "ALLOWED_ORIGIN",
  "PYTHON_RUNNER_URL",
  "PYTHON_RUNNER_TOKEN",
  "SPARK_RUNNER_URL",
  "SPARK_RUNNER_TOKEN",
  "SPARK_RUNNER_ALLOW_PRIVATE_HTTP",
  "RATE_LIMIT_PER_MINUTE",
  "SESSION_DAYS",
  "DB_POOL_SIZE"
]);

const ssm = new SSMClient({});
let loadPromise: Promise<void> | undefined;

export function loadLambdaSecrets(): Promise<void> {
  if (!process.env.SSM_PARAMETER_PREFIX) return Promise.resolve();
  loadPromise ??= loadParameters().catch(error => {
    loadPromise = undefined;
    throw error;
  });
  return loadPromise;
}

async function loadParameters(): Promise<void> {
  const prefix = process.env.SSM_PARAMETER_PREFIX!.replace(/\/+$/, "");
  const path = `${prefix}/`;
  let nextToken: string | undefined;

  do {
    const result = await ssm.send(new GetParametersByPathCommand({
      Path: path,
      Recursive: true,
      WithDecryption: true,
      NextToken: nextToken
    }));

    for (const parameter of result.Parameters ?? []) {
      if (!parameter.Name || parameter.Value === undefined || !parameter.Name.startsWith(path)) continue;
      const name = parameter.Name.slice(path.length).split("/").at(-1)?.toUpperCase();
      if (name && parameterNames.has(name) && !process.env[name]) process.env[name] = parameter.Value;
    }
    nextToken = result.NextToken;
  } while (nextToken);
}
