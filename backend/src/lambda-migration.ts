import { loadLambdaSecrets } from "./lambda-secrets.js";

export async function handler(): Promise<void> {
  await loadLambdaSecrets();
  const { initializeBackend } = await import("./server.js");
  await initializeBackend();
}
