export async function copyExtractedText(text: string): Promise<void> {
 await navigator.clipboard.writeText(text);
}
