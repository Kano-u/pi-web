/**
 * Remembers the thinking blocks the reader has expanded, so opening one survives
 * the render hops that recreate the block.
 *
 * A streaming assistant message is rendered from `streamState`, then re-rendered
 * from `messages` after `message_end`, and re-keyed twice more: the message
 * wrapper once `entryIds` arrive from the session file, and the block inside the
 * message, which `MessageView` keys on `entryId ?? "stream"`. Each hop remounts
 * `ThinkingBlock`, so plain component state collapses the block the reader just
 * opened — the same trap `lib/tool-call-expansion.ts` documents for tool cards.
 *
 * A tool card has a stable `toolCallId` to key on; a thinking block has no id of
 * its own, and the streaming render is handed neither a session id nor an entry
 * id. The decision is therefore keyed by the block's index inside its message and
 * guarded by the block's own text: the thinking text of that one block always
 * keeps the opening it had when the reader clicked, while another message's block
 * at the same index starts differently. The guard is why an empty block records
 * nothing — an empty opening would match every later block at that index.
 *
 * The opening is `getThinkingPreview`'s first line, not the raw text: reading a
 * committed turn back replaces a block's text with exactly that preview
 * (`lib/session-reader.ts`), and a raw-text guard stopped matching the moment the
 * turn was saved — the block collapsed again as the answer arrived.
 */
const THINKING_PREFIX_LENGTH = 32;

const expansions = new Map<number, { expanded: boolean; prefix: string }>();

function textOpening(text: string): string {
  // The first line, the same shape `getThinkingPreview` gives a historical
  // thinking block (`lib/message-display.ts`): reading a committed turn back
  // replaces the block's text with that preview, and a raw-text key stopped
  // matching the moment the turn was saved. Mirrored here so this module stays
  // importable from a plain `node --test` run.
  return text.trimStart().match(/^[^\r\n]*/u)?.[0].trimEnd().slice(0, THINKING_PREFIX_LENGTH) ?? "";
}

/**
 * The reader's own choice for this block, or `undefined` when there is none and
 * the block should follow the remembered preference instead.
 */
export function getThinkingExpansion(blockIndex: number, text: string): boolean | undefined {
  const expansion = expansions.get(blockIndex);
  if (!expansion) return undefined;
  return textOpening(text).startsWith(expansion.prefix) ? expansion.expanded : undefined;
}

export function setThinkingExpansion(blockIndex: number, text: string, expanded: boolean): void {
  const prefix = textOpening(text);
  if (!prefix) return;
  expansions.set(blockIndex, { expanded, prefix });
}

export function clearThinkingExpansions(): void {
  expansions.clear();
}

/**
 * Whether the reader opened the thinking content of one of these process blocks.
 * `ChatWindow` asks this to keep a turn's process section open: it collapses by
 * default once the turn has an answer, which would hide a block the reader had
 * just opened while the turn was still streaming.
 */
export function hasOpenedThinking(blocks: readonly { type?: string; thinking?: string }[]): boolean {
  return blocks.some((block, blockIndex) => (
    block.type === "thinking"
    && typeof block.thinking === "string"
    && getThinkingExpansion(blockIndex, block.thinking) === true
  ));
}
