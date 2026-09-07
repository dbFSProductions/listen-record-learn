// The print sheet as a PDF the app writes itself.
//
// The browser's print dialog was the PDF for one release, and on the phone it
// cannot be: iOS Safari writes the URL, the date and the page number into the
// margin of every page and no longer offers a way to turn that off — not a
// setting, and not `@page { margin: 0 }` either, which Chrome honours and
// WebKit ignores. Apple's own answer is a real PDF, which prints clean. So
// this lays the same sheet out itself — A4, two columns, the deck's colour
// on its heading and its phrases, Listen for in the link blue — through
// jsPDF, and hands the file to the share sheet (Save to Files, Print, Mail)
// or to a download where there is no share sheet.
//
// jsPDF and the fonts are loaded only when the print page opens, never at
// boot: together they are half a megabyte, and the service worker keeps
// them once fetched, as it does the Azure SDK.

import { NUNITO_REGULAR, NUNITO_BOLD, DEJAVU_SANS } from "../vendor/fonts/pdf-fonts.js";

const PAGE = { width: 210, height: 297 };
const MARGIN = { top: 10, right: 10, bottom: 12, left: 10 };
const COLUMN_GAP = 7;
const COLUMNS = 2;
const COLUMN_WIDTH = (PAGE.width - MARGIN.left - MARGIN.right - COLUMN_GAP * (COLUMNS - 1)) / COLUMNS;
const BOTTOM = PAGE.height - MARGIN.bottom;
const PT = 25.4 / 72; // one point, in mm

/* The sheet's type, in points, and its colours — the print stylesheet's
   values, so the PDF is the preview. */
const TYPE = {
  deck: { size: 12, bold: true, leading: 1.25 },
  count: { size: 9.6, bold: false },
  text: { size: 11, bold: true, leading: 1.25 },
  translation: { size: 10, bold: false, leading: 1.25 },
  note: { size: 9, bold: false, leading: 1.3 },
};
const INK = {
  translation: "#111111",
  note: "#222222",
  label: "#0d7db4", // Listen for — the link blue it wears in the app
  count: "#444444",
  rule: "#cccccc",
  gender: { m: "#1cb0f6", f: "#ff70b8" },
};
const DECK_GAP = 3; // between decks, mm
const HEADING_PAD = 1; // under the heading, above its rule
const HEADING_RULE = 0.5;
const CARD_PAD = 1.4;
const CARD_RULE = 0.2;
const NOTE_GAP = 0.4;
const DOT_RADIUS = 1.2;
const DOT_GAP = 1.4;

/* Characters Nunito has not got, set in DejaVu Sans instead. Anything outside
   the ranges the Nunito subset was cut to also goes there, so an unexpected
   character prints as itself rather than as nothing. */
const NUNITO_RANGES = [
  [0x20, 0x7e], [0xa0, 0xff], [0x100, 0x17f], [0x250, 0x2af], [0x2b0, 0x2ff],
  [0x391, 0x3c9], [0x2010, 0x2027], [0x2030, 0x205e], [0x20ac, 0x20ac], [0x2122, 0x2122],
];
const NUNITO_MISSING = new Set(["ɛ", "β"]);
function fontFor(char) {
  if (NUNITO_MISSING.has(char)) return "DejaVu";
  const code = char.codePointAt(0);
  return NUNITO_RANGES.some(([lo, hi]) => code >= lo && code <= hi) ? "Nunito" : "DejaVu";
}

let loading = null;

/* jsPDF is a classic script, so it is loaded the way the Azure SDK is: a
   script tag, once. Calling this when the print page opens means the button
   press itself has nothing to wait for — which matters on iOS, where the
   share sheet only opens inside the tap that asked for it. */
export function preloadPDF() {
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      if (window.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
      const script = document.createElement("script");
      script.src = "vendor/jspdf/jspdf.umd.min.js";
      script.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error("jsPDF did not load")));
      script.onerror = () => reject(new Error("Couldn't load the PDF writer"));
      document.head.appendChild(script);
    }).catch((error) => {
      loading = null; // so the next press tries again rather than failing forever
      throw error;
    });
  }
  return loading;
}

/** A deck on the sheet: its name, its ink colour, and its cards. */
// { name, ink, cards: [{ text, translation, note, gender }] }
export async function buildPrintPDF(decks, { title = "fin·o·lingo" } = {}) {
  const jsPDF = await preloadPDF();
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.addFileToVFS("Nunito-Regular.ttf", NUNITO_REGULAR);
  doc.addFileToVFS("Nunito-Bold.ttf", NUNITO_BOLD);
  doc.addFileToVFS("DejaVuSans.ttf", DEJAVU_SANS);
  doc.addFont("Nunito-Regular.ttf", "Nunito", "normal");
  doc.addFont("Nunito-Bold.ttf", "Nunito", "bold");
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFont("DejaVuSans.ttf", "DejaVu", "bold");
  doc.setProperties({ title });

  const layout = new Layout(doc);
  for (const deck of decks) layout.deck(deck);
  return doc.output("blob");
}

/* Two columns, filled top to bottom then left to right, a card never split
   across a column or a page, a heading never left at the foot of a column
   without its first card. */
class Layout {
  constructor(doc) {
    this.doc = doc;
    this.column = 0;
    this.y = MARGIN.top;
    this.fresh = true; // nothing drawn in this column yet
  }

  get x() {
    return MARGIN.left + this.column * (COLUMN_WIDTH + COLUMN_GAP);
  }

  nextColumn() {
    this.column += 1;
    if (this.column >= COLUMNS) {
      this.doc.addPage();
      this.column = 0;
    }
    this.y = MARGIN.top;
    this.fresh = true;
  }

  deck({ name, ink, cards }) {
    const heading = this.headingBlock(name, cards.length, ink);
    const blocks = cards.map((card) => this.cardBlock(card, ink));
    // The heading goes with its first card, or the two go together to the top
    // of the next column.
    const first = blocks[0]?.height ?? 0;
    if (!this.fresh && this.y + DECK_GAP + heading.height + first > BOTTOM) this.nextColumn();
    if (!this.fresh) this.y += DECK_GAP;
    heading.draw(this.x, this.y);
    this.y += heading.height;
    this.fresh = false;
    blocks.forEach((block, index) => {
      if (this.y + block.height > BOTTOM) this.nextColumn();
      block.draw(this.x, this.y, index === blocks.length - 1);
      this.y += block.height;
      this.fresh = false;
    });
  }

  headingBlock(name, count, ink) {
    const doc = this.doc;
    const nameLines = this.wrap([...words(name, true)], TYPE.deck.size, COLUMN_WIDTH);
    const lineHeight = TYPE.deck.size * TYPE.deck.leading * PT;
    const height = nameLines.length * lineHeight + HEADING_PAD + HEADING_RULE + 1;
    return {
      height,
      draw: (x, y) => {
        let cursor = y;
        nameLines.forEach((line, index) => {
          const end = this.drawLine(line, x, cursor, TYPE.deck.size, ink);
          if (index === nameLines.length - 1) {
            this.setFont(false, "Nunito");
            doc.setFontSize(TYPE.count.size);
            doc.setTextColor(INK.count);
            doc.text(String(count), end + 1.2, cursor + (TYPE.deck.size - TYPE.count.size) * PT, { baseline: "top" });
          }
          cursor += lineHeight;
        });
        cursor += HEADING_PAD;
        doc.setDrawColor(ink);
        doc.setLineWidth(HEADING_RULE);
        doc.line(x, cursor + HEADING_RULE / 2, x + COLUMN_WIDTH, cursor + HEADING_RULE / 2);
      },
    };
  }

  cardBlock({ text, translation, note, gender }, ink) {
    const doc = this.doc;
    const dotWidth = gender ? DOT_RADIUS * 2 + DOT_GAP : 0;
    const textLines = this.wrap([...words(text || "—", true)], TYPE.text.size, COLUMN_WIDTH, dotWidth);
    const translationLines = translation ? this.wrap([...words(translation, false)], TYPE.translation.size, COLUMN_WIDTH) : [];
    const noteLines = note
      ? this.wrap([...words("Listen for", true), ...words(note, false)], TYPE.note.size, COLUMN_WIDTH)
      : [];
    const lh = (type) => type.size * type.leading * PT;
    const height =
      CARD_PAD +
      textLines.length * lh(TYPE.text) +
      translationLines.length * lh(TYPE.translation) +
      (noteLines.length ? NOTE_GAP + noteLines.length * lh(TYPE.note) : 0) +
      CARD_PAD +
      CARD_RULE;
    return {
      height,
      draw: (x, y, last) => {
        let cursor = y + CARD_PAD;
        textLines.forEach((line, index) => {
          let start = x;
          if (gender && index === 0) {
            doc.setFillColor(INK.gender[gender]);
            doc.circle(x + DOT_RADIUS, cursor + (TYPE.text.size * PT) / 2 + 0.3, DOT_RADIUS, "F");
            start = x + dotWidth;
          }
          this.drawLine(line, start, cursor, TYPE.text.size, ink);
          cursor += lh(TYPE.text);
        });
        translationLines.forEach((line) => {
          this.drawLine(line, x, cursor, TYPE.translation.size, INK.translation);
          cursor += lh(TYPE.translation);
        });
        if (noteLines.length) {
          cursor += NOTE_GAP;
          noteLines.forEach((line) => {
            this.drawLine(line, x, cursor, TYPE.note.size, INK.note, INK.label);
            cursor += lh(TYPE.note);
          });
        }
        if (!last) {
          const ruleY = y + height - CARD_RULE / 2;
          doc.setDrawColor(INK.rule);
          doc.setLineWidth(CARD_RULE);
          doc.line(x, ruleY, x + COLUMN_WIDTH, ruleY);
        }
      },
    };
  }

  setFont(bold, family) {
    this.doc.setFont(family, bold ? "bold" : "normal");
  }

  /* A word's width at a size, run by run — a word with a β in it is measured
     in two fonts. */
  width(word, size) {
    this.doc.setFontSize(size);
    return word.runs.reduce((total, run) => {
      this.setFont(word.bold, run.font);
      return total + this.doc.getTextWidth(run.text);
    }, 0);
  }

  /* Greedy wrapping over words; a word wider than the column is set on a
     line of its own and overflows rather than being broken. `indent` is
     room taken at the start of the first line — the gender dot. */
  wrap(wordList, size, maxWidth, indent = 0) {
    const lines = [];
    let line = [];
    let used = indent;
    const spaceWidth = this.spaceWidth(size);
    for (const word of wordList) {
      const w = this.width(word, size);
      const needed = (line.length ? spaceWidth : 0) + w;
      if (line.length && used + needed > maxWidth) {
        lines.push(line);
        line = [];
        used = 0;
      }
      line.push({ ...word, width: w });
      used += (line.length > 1 ? spaceWidth : 0) + w;
    }
    if (line.length) lines.push(line);
    return lines;
  }

  spaceWidth(size) {
    this.doc.setFontSize(size);
    this.setFont(false, "Nunito");
    return this.doc.getTextWidth(" ");
  }

  /* Draws one wrapped line, word by word, run by run, and returns where it
     ended. Bold words take `boldInk` when given — the Listen for label. */
  drawLine(line, x, y, size, ink, boldInk = ink) {
    const doc = this.doc;
    const spaceWidth = this.spaceWidth(size);
    let cursor = x;
    line.forEach((word, index) => {
      if (index) cursor += spaceWidth;
      doc.setFontSize(size);
      doc.setTextColor(word.bold ? boldInk : ink);
      for (const run of word.runs) {
        this.setFont(word.bold, run.font);
        doc.text(run.text, cursor, y, { baseline: "top" });
        cursor += doc.getTextWidth(run.text);
      }
    });
    return cursor;
  }
}

/* Words with their font runs. */
function* words(text, bold) {
  for (const raw of String(text).split(/\s+/)) {
    if (!raw) continue;
    const runs = [];
    for (const char of raw) {
      const font = fontFor(char);
      const last = runs[runs.length - 1];
      if (last && last.font === font) last.text += char;
      else runs.push({ font, text: char });
    }
    yield { bold, runs };
  }
}

/* Hands the file over: the share sheet where there is one that takes files
   (iOS: Save to Files, Print, Mail), a download everywhere else. Must be
   called inside the tap, which is why the PDF is built before this and not
   after a script load. */
export async function deliverPDF(blob, filename) {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
      // Fall through to the download on any other failure.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
