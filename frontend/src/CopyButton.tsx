import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyButton({ value }: { value: string }) {
  const [status, setStatus] = useState<"" | "copied" | "failed">("");

  useEffect(() => setStatus(""), [value]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return <button className="solutionCopyButton" type="button" onClick={() => void copy()} aria-live="polite" aria-label={status === "copied" ? "Copied to clipboard" : status === "failed" ? "Copy failed" : "Copy solution"} title={status === "failed" ? "Clipboard access failed" : undefined}>
    {status === "copied" ? <Check size={14} /> : <Copy size={14} />}
    {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy"}
  </button>;
}