import type { CSSProperties } from "react";

export type QuestionBankProgress = "complete" | "in-progress" | "not-started";

export function questionBankProgress(completed: number, total: number, attempted: number): QuestionBankProgress {
  if (total > 0 && completed >= total) return "complete";
  if (completed > 0 || attempted > 0) return "in-progress";
  return "not-started";
}

export function questionBankProgressClass(progress: QuestionBankProgress): string {
  return `bankProgress-${progress}`;
}

export function questionBankProgressStyle(completed: number, total: number, attempted: number): CSSProperties {
  const questionCount = Math.max(total, 0);
  if (!questionCount) {
    return {
      "--bank-solved-width": "0%",
      "--bank-attempted-width": "0%",
    } as CSSProperties;
  }
  const solvedWidth = Math.min(Math.max(completed, 0), questionCount) / questionCount * 100;
  const attemptedWidth = Math.min(Math.max(attempted, completed, 0), questionCount) / questionCount * 100;
  return {
    "--bank-solved-width": `${solvedWidth}%`,
    "--bank-attempted-width": `${attemptedWidth}%`,
  } as CSSProperties;
}

export function questionBankProgressLabel(progress: QuestionBankProgress): string {
  if (progress === "complete") return "Complete";
  if (progress === "in-progress") return "In progress";
  return "Not started";
}
