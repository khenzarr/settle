"use client";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  return <button className="copy-button" type="button" onClick={() => void navigator.clipboard?.writeText(text)} aria-label={label ?? `Copy ${text}`}>Copy</button>;
}