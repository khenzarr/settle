"use client";

export function CopyButton({ text }: { text: string }) {
  return <button className="copy-button" type="button" onClick={() => void navigator.clipboard?.writeText(text)} aria-label={`Copy ${text}`}>Copy</button>;
}