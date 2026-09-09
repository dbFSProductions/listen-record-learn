/* Reading an EPUB on the device, with nothing vendored.

   An EPUB is a ZIP of XHTML, and the two things needed to open one are both
   in the browser already: `DecompressionStream("deflate-raw")` for the
   entries and `DOMParser` for the markup. So this file is the whole importer
   — no JSZip, no epub.js, no build step — which is the same call `vendor/`
   makes in the other direction for the Azure SDK and jsPDF: vendor a library
   when the platform genuinely hasn't got the thing, write it when it has.

   What comes out is a book split into pages, and the split has to be
   *deterministic*: the same file imported again must produce the same pages
   with the same text, because a page's glosses are cached against a hash of
   its text. Get that wrong and re-importing after iOS has evicted the
   storage silently pays for the whole book a second time. Nothing here may
   depend on the clock, on Map iteration order, or on anything but the bytes. */

const ZIP_EOCD = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_LOCAL = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;

/* A page is sized to a sitting rather than to a budget. The gloss for a page
   scales with its text, so cost per word read is nearly flat whatever this
   is; only the prompt overhead doesn't amortise, and that is small enough to
   ignore. Two or three minutes of reading is the useful unit. */
export const PAGE_CHARS = 1200;
/* A paragraph longer than this is split at sentence boundaries rather than
   being allowed to become a page of its own. Some books open a chapter with
   a single very long paragraph, and the Worker refuses anything over its own
   4000-character cap. */
const PARAGRAPH_MAX = PAGE_CHARS * 2;
/* A page shorter than this is a runt — a chapter that is nothing but its own
   heading, a half-line of front matter, the tail of a short chapter. Left
   alone they are most of what a spine of forty-odd documents produces, and
   each one is a page to swipe past and, worse, a Worker call to pay for a
   page with three words on it. So a runt is joined to the page after it. */
const MIN_PAGE = 250;

// ------------------------------------------------------------------ the zip

function findEOCD(view) {
  /* The end-of-central-directory record is last, but a trailing comment of up
     to 64KB may follow it, so it is searched for backwards. */
  const from = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let at = view.byteLength - 22; at >= from; at--) {
    if (view.getUint32(at, true) === ZIP_EOCD) return at;
  }
  throw new Error("That doesn't look like an EPUB — no zip directory in it.");
}

/* The central directory, as a map of filename to what is needed to read it.
   Read from the directory rather than by walking local headers, because only
   the directory is authoritative about sizes. */
function readDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEOCD(view);
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== ZIP_CENTRAL) break;
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const uncompressed = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    /* Zip64 puts the real numbers in an extra field. No EPUB a person reads
       is near 4GB, so say so plainly rather than half-supporting it. */
    if (offset === 0xffffffff || compressed === 0xffffffff) {
      throw new Error("That EPUB uses zip64, which this reader can't open.");
    }
    entries.set(name, { method, compressed, uncompressed, offset });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* One entry's bytes. The local header repeats the name and extra-field
   lengths and they can differ from the directory's, so the data offset is
   computed from the local header rather than assumed. */
async function readEntry(bytes, entry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(entry.offset, true) !== ZIP_LOCAL) throw new Error("The EPUB's zip entries are damaged.");
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const from = entry.offset + 30 + nameLength + extraLength;
  const raw = bytes.subarray(from, from + entry.compressed);
  if (entry.method === STORED) return raw;
  if (entry.method === DEFLATED) return inflate(raw);
  throw new Error(`The EPUB uses a compression this reader can't open (${entry.method}).`);
}

async function readText(bytes, entries, name) {
  const entry = entries.get(name);
  if (!entry) return null;
  return new TextDecoder("utf-8").decode(await readEntry(bytes, entry));
}

// ----------------------------------------------------------------- the book

/* Paths inside an EPUB are relative to the file that names them, so an OPF at
   OEBPS/content.opf pointing at "pit-11.xhtml" means OEBPS/pit-11.xhtml. Zip
   names have no leading slash and are always forward-slashed. */
function resolvePath(base, href) {
  const target = decodeURIComponent(String(href).split("#")[0]);
  if (!target) return "";
  const parts = base.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function parseXML(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("The EPUB's index is malformed.");
  return doc;
}

/* Element lookup that ignores namespaces. EPUBs are inconsistent about
   prefixes — `<opf:manifest>` and `<manifest>` are both common — and
   querySelector on a namespaced document is a poor way to ask. */
function byTag(root, name) {
  return [...root.getElementsByTagName("*")].filter((el) => el.localName === name);
}

/* The spine's documents, in reading order, as plain text.

   Only the text matters here: the app's own reading page draws the words, so
   the book's styling, its images and its page furniture are all dropped. What
   is kept is the paragraph structure, because that is what the page splitter
   works in and what makes a page readable when it lands. */
function documentText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const el of doc.querySelectorAll("script, style, svg, nav, header, footer")) el.remove();
  const body = doc.body;
  if (!body) return [];
  const blocks = body.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, dd, dt");
  const paragraphs = [];
  if (blocks.length) {
    for (const block of blocks) {
      /* A <p> inside a <blockquote> would otherwise be read twice. */
      if (block.parentElement?.closest("p, li, blockquote, dd, dt") && block.tagName === "P") continue;
      const text = tidy(block.textContent);
      if (text) paragraphs.push(text);
    }
  } else {
    for (const line of tidy(body.textContent).split("\n")) {
      const text = tidy(line);
      if (text) paragraphs.push(text);
    }
  }
  return paragraphs;
}

/* Collapse the whitespace an EPUB's indented markup leaves behind, and
   normalise the space characters a typesetter uses, so that the same
   paragraph always hashes to the same thing. */
function tidy(text) {
  return String(text ?? "")
    .replace(/ | | /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Split a paragraph too long to be a page on its own. Sentence ends first;
   if it has none — a list of names, a table read as prose — fall back to
   splitting on spaces, so a pathological paragraph can't defeat the cap. */
function splitLong(paragraph) {
  const pieces = [];
  let rest = paragraph;
  while (rest.length > PARAGRAPH_MAX) {
    let cut = -1;
    const window = rest.slice(0, PARAGRAPH_MAX);
    for (const match of window.matchAll(/[.!?…»"]\s/g)) cut = match.index + match[0].length;
    if (cut <= 0) cut = window.lastIndexOf(" ") + 1;
    if (cut <= 0) cut = PARAGRAPH_MAX;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/* Paragraphs into pages, one chapter at a time.

   A page never spans two chapters: a chapter break is the one place a book
   itself says "stop here", and honouring it costs only a short last page.
   A paragraph is never split across pages unless it is longer than a page
   twice over, because a page that opens mid-sentence is exactly what the
   pasted-snapshot workflow was bad at.

   Deterministic by construction — it reads the paragraphs and nothing else. */
export function chunkChapters(chapters, target = PAGE_CHARS) {
  const pages = [];
  for (const chapter of chapters) {
    let current = [];
    let length = 0;
    const flush = () => {
      if (!current.length) return;
      pages.push({ text: current.join("\n\n"), chapter: chapter.title });
      current = [];
      length = 0;
    };
    for (const paragraph of chapter.paragraphs) {
      for (const piece of paragraph.length > PARAGRAPH_MAX ? splitLong(paragraph) : [paragraph]) {
        if (length && length + piece.length > target) flush();
        current.push(piece);
        length += piece.length + 2;
      }
    }
    flush();
  }
  return mergeRunts(pages);
}

/* Join each too-short page to the one after it, and the last to the one
   before. This is the single place a page may span a chapter break, and it
   earns the exception: a chapter consisting of the word "II" is a heading,
   not a chapter, and reading it as its own page is worse than reading it at
   the top of the next one. Bounded by PARAGRAPH_MAX so a merge can never
   build a page the Worker would refuse, and deterministic like the rest. */
function mergeRunts(pages) {
  const out = [];
  let held = null;
  for (const page of pages) {
    if (held) {
      if (held.text.length + page.text.length + 2 <= PARAGRAPH_MAX) {
        out.push({ text: `${held.text}\n\n${page.text}`, chapter: held.chapter });
        held = null;
        continue;
      }
      out.push(held);
      held = null;
    }
    if (page.text.length < MIN_PAGE) held = page;
    else out.push(page);
  }
  if (held) {
    const last = out.pop();
    if (last && last.text.length + held.text.length + 2 <= PARAGRAPH_MAX) {
      out.push({ text: `${last.text}\n\n${held.text}`, chapter: last.chapter });
    } else {
      if (last) out.push(last);
      out.push(held);
    }
  }
  return out;
}

/* A stable content hash, so a page's cached gloss survives a re-import after
   the browser has evicted the storage. Two 32-bit FNV-1a passes with
   different offsets, printed as hex — 64 bits of key for a few hundred
   pages, which is more than enough, and it needs no crypto and no await. */
export function pageHash(text) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x811c9dc5) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/* Open an EPUB file and hand back its metadata and its pages.

   Throws with a sentence fit to print: this runs off a file picker, and
   everything that can go wrong here — a DRM'd file, a zip64 file, something
   that isn't an EPUB at all — is something the reader has to be told in
   words rather than left with a spinner. */
export async function readEpub(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = readDirectory(bytes);

  /* An Adobe-DRM'd EPUB is still a zip and still has a container.xml; what it
     has as well is META-INF/encryption.xml, and its content documents are
     ciphertext. Say so, rather than importing a book of mojibake. */
  if (entries.has("META-INF/encryption.xml")) {
    throw new Error("That EPUB is DRM-protected, so its text can't be read. A watermarked or DRM-free copy will work.");
  }

  const containerText = await readText(bytes, entries, "META-INF/container.xml");
  if (!containerText) throw new Error("That doesn't look like an EPUB — no META-INF/container.xml.");
  const rootPath = parseXML(containerText).querySelector("rootfile")?.getAttribute("full-path");
  if (!rootPath) throw new Error("That EPUB doesn't say where its index is.");

  const opfText = await readText(bytes, entries, rootPath);
  if (!opfText) throw new Error("That EPUB's index is missing.");
  const opf = parseXML(opfText);

  const meta = (name) => byTag(opf, name)[0]?.textContent?.trim() ?? "";
  const title = meta("title") || file.name.replace(/\.epub$/i, "");
  const author = meta("creator");
  const language = meta("language");

  const manifest = new Map();
  for (const item of byTag(opf, "item")) {
    manifest.set(item.getAttribute("id"), {
      href: item.getAttribute("href") ?? "",
      type: item.getAttribute("media-type") ?? "",
      properties: item.getAttribute("properties") ?? "",
    });
  }

  const chapters = [];
  for (const ref of byTag(opf, "itemref")) {
    const item = manifest.get(ref.getAttribute("idref"));
    if (!item || !/xhtml|html/i.test(item.type)) continue;
    /* The navigation document is a table of contents, not reading. */
    if (/\bnav\b/.test(item.properties)) continue;
    const path = resolvePath(rootPath, item.href);
    const html = await readText(bytes, entries, path);
    if (!html) continue;
    const paragraphs = documentText(html);
    if (!paragraphs.length) continue;
    chapters.push({ path, title: paragraphs[0].slice(0, 60), paragraphs });
  }

  if (!chapters.length) throw new Error("No readable text came out of that EPUB.");
  return { title, author, language, chapters };
}
