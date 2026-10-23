const WORD_SPLIT = /[\s,.;:()[\]/\\+&-]+/;

export const searchWords = (text: string) => text.trim().toLowerCase().split(WORD_SPLIT).filter(Boolean);

export function wordMatch(text: string, query: string): 0 | 1 | null {
  const words = searchWords(query);
  if (words.length === 0) {
    return 1;
  }
  const lower = text.toLowerCase();
  const textWords = lower.split(WORD_SPLIT);
  if (!words.every((word) => textWords.some((textWord) => textWord.startsWith(word)))) {
    return null;
  }
  return lower.startsWith(query.trim().toLowerCase()) ? 0 : 1;
}
