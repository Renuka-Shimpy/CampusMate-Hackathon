const sentencePattern = /[^.!?\n]+[.!?]?/g;

export function createLocalSummary(text) {
  const sentences = (text.match(sentencePattern) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const points = [];
  const addFirstMatching = (pattern) => {
    const match = sentences.find((sentence) => pattern.test(sentence));
    if (match && !points.includes(match)) points.push(match);
  };

  addFirstMatching(/\b(due|deadline|submit|submission|last date|by\s+\d)/i);
  addFirstMatching(/\b(date|on\s+\d|at\s+\d|from\s+\d|until|between)\b/i);
  addFirstMatching(/\b(required|mandatory|must|bring|carry|eligible|venue|room|auditorium)\b/i);

  for (const sentence of sentences) {
    if (points.length >= 3) break;
    if (!points.includes(sentence)) points.push(sentence);
  }

  return points.slice(0, 3);
}
