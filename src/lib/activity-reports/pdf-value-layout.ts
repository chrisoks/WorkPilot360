type MeasureText = (text: string, fontSize: number) => number;

type PdfValueLayoutOptions = {
  maxWidth: number;
  preferredFontSize?: number;
  minimumFontSize?: number;
  maxLines?: number;
};

export type PdfValueLayout = {
  lines: string[];
  fontSize: number;
};

function wrapWords(text: string, fontSize: number, maxWidth: number, measureText: MeasureText) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (measureText(word, fontSize) > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      let wordPart = "";
      for (const character of word) {
        const candidate = `${wordPart}${character}`;
        if (wordPart && measureText(candidate, fontSize) > maxWidth) {
          lines.push(wordPart);
          wordPart = character;
        } else {
          wordPart = candidate;
        }
      }
      currentLine = wordPart;
      continue;
    }

    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (!currentLine || measureText(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

export function layoutPdfValue(
  value: string,
  measureText: MeasureText,
  options: PdfValueLayoutOptions
): PdfValueLayout {
  const text = value.trim().replace(/\s+/g, " ") || "-";
  const preferredFontSize = options.preferredFontSize ?? 8.5;
  const minimumFontSize = options.minimumFontSize ?? 7.25;
  const maxLines = options.maxLines ?? 2;

  for (let fontSize = preferredFontSize; fontSize >= minimumFontSize; fontSize -= 0.25) {
    const lines = wrapWords(text, fontSize, options.maxWidth, measureText);
    if (lines.length <= maxLines && lines.every((line) => measureText(line, fontSize) <= options.maxWidth)) {
      return { lines, fontSize };
    }
  }

  for (let fontSize = minimumFontSize - 0.25; fontSize >= 4; fontSize -= 0.25) {
    const lines = wrapWords(text, fontSize, options.maxWidth, measureText);
    if (lines.length <= maxLines && lines.every((line) => measureText(line, fontSize) <= options.maxWidth)) {
      return { lines, fontSize };
    }
  }

  return { lines: wrapWords(text, 4, options.maxWidth, measureText), fontSize: 4 };
}
