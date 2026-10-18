// Copies text to the clipboard. Returns false when the browser refuses (or has no clipboard), so the caller can say so.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
