/**
 * Marker-based injection into agent config files.
 * Supports per-library namespaced markers so multiple indexes coexist.
 */

function startMarker(name: string): string {
  return `<!-- DOCS-AGENTS-MD:${name}-START -->`;
}

function endMarker(name: string): string {
  return `<!-- DOCS-AGENTS-MD:${name}-END -->`;
}

/**
 * Check if content already has an index block for the given library name.
 */
export function hasExistingIndex(content: string, name: string): boolean {
  return content.includes(startMarker(name));
}

/**
 * Inject index content into a file, using namespaced markers.
 * - If markers exist: replaces content between them
 * - If no markers: appends to end with proper spacing
 * - Idempotent: running twice produces the same result
 */
export function injectIndex(
  existingContent: string,
  indexContent: string,
  name: string,
): string {
  const start = startMarker(name);
  const end = endMarker(name);
  const wrappedContent = `${start}${indexContent}${end}`;

  if (hasExistingIndex(existingContent, name)) {
    const startIdx = existingContent.indexOf(start);
    const endIdx = existingContent.indexOf(end) + end.length;

    // Guard against missing END marker (START exists, END doesn't)
    if (existingContent.indexOf(end) === -1) {
      const cleaned = existingContent.replace(start, "");
      return injectIndex(cleaned, indexContent, name);
    }

    // Guard against corrupted marker order (END before START)
    if (endIdx <= startIdx) {
      // Markers are malformed — remove both and re-append cleanly
      const cleaned = existingContent
        .replace(start, "")
        .replace(endMarker(name), "");
      return injectIndex(cleaned, indexContent, name);
    }

    return (
      existingContent.slice(0, startIdx) +
      wrappedContent +
      existingContent.slice(endIdx)
    );
  }

  // Append to end with proper spacing
  if (existingContent === "") {
    return wrappedContent + "\n";
  }
  const separator = existingContent.endsWith("\n") ? "\n" : "\n\n";
  return existingContent + separator + wrappedContent + "\n";
}

/**
 * Remove an index block for the given library name.
 * Returns the content with the block removed.
 */
export function removeIndex(content: string, name: string): string {
  if (!hasExistingIndex(content, name)) return content;

  const start = startMarker(name);
  const end = endMarker(name);

  const startIdx = content.indexOf(start);
  const endIdx = content.indexOf(end) + end.length;

  // Guard against missing END marker
  if (content.indexOf(end) === -1) {
    return content.replace(start, "");
  }

  // Guard against corrupted marker order (END before START)
  if (endIdx <= startIdx) {
    // Markers are malformed — remove both individually
    return content.replace(start, "").replace(endMarker(name), "");
  }

  // Also remove surrounding blank lines
  let removeStart = startIdx;
  let removeEnd = endIdx;

  // Only remove a preceding blank line (\n\n), not a trailing content newline
  if (
    removeStart >= 2 &&
    content[removeStart - 1] === "\n" &&
    content[removeStart - 2] === "\n"
  ) {
    removeStart -= 2;
  }

  // Remove trailing newline if present
  if (removeEnd < content.length && content[removeEnd] === "\n") {
    removeEnd++;
  }

  return content.slice(0, removeStart) + content.slice(removeEnd);
}
