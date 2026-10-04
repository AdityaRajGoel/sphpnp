const NOTE = "\n[Data truncated]\n\n";

/**
 * Cut a prompt to `max` characters without losing its last section.
 *
 * Prompts put the data first and the instruction last (a chat turn ends with
 * "## Client's Question"). A plain head cut drops exactly the part the model
 * must answer, so this trims the data before `marker` and keeps everything
 * from `marker` on. Without the marker it is a plain head cut.
 */
export function trimPromptKeepingTail(prompt: string, max: number, marker: string): string {
  if (prompt.length <= max) return prompt;
  const at = prompt.lastIndexOf(marker);
  if (at < 0) return prompt.slice(0, max - NOTE.length) + NOTE.trimEnd();
  const tail = prompt.slice(at);
  const room = Math.max(0, max - tail.length - NOTE.length);
  return prompt.slice(0, room) + NOTE + tail;
}
