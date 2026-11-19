import { configure } from "@codegenie/serverless-express";
import { loadLambdaSecrets } from "./lambda-secrets.js";

let proxy: ReturnType<typeof configure> | undefined;

export async function handler(event: unknown, context: unknown) {
  await loadLambdaSecrets();
  const { app, initializeRuntime } = await import("./server.js");
  await initializeRuntime();
  proxy ??= configure({ app });
  return proxy(event, context);
}
