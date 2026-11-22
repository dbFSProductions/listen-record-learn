#!/usr/bin/env node
/* /book-build, driven against the real Worker with `globalThis.fetch` stubbed.
 *
 *     node worker/tools/book-build-test.mjs
 *
 * What it checks: the route exists; the page, the language and the book's
 * title reach the model, framed as data, with the elision rule; the batch
 * schema is asked for; a sentence whose tiles do not put it back together is
 * dropped, and one whose tiles differ only by punctuation, case or a space
 * after an apostrophe is kept; tiles lose their punctuation; a decoy that is
 * one of the sentence's own tiles is dropped and an unknown kind becomes
 * "word"; the caps; and fewer than three playable sentences is a 502.
 */
import worker, { foldBuild } from "../src/index.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? "  <- " + extra : ""}`); }
};

const ENV = {
  APP_PASSCODE: "letmein",
  GEMINI_API_KEY: "k",
  ALLOWED_ORIGINS: "http://localhost:8765",
  AI_RATE_LIMITER: { limit: async () => ({ success: true }) },
};

const item = (text, english, tiles, decoys = [], note = "") => ({ text, english, tiles, decoys, note });
const BUILD = {
  items: [
    item("L'home va arribar a Horta.", "The man arrived in Horta.", ["l'home", "va arribar", "a Horta."],
      [{ text: "el home", kind: "article", why: "Before a vowel el becomes l'." }, { text: "arribava", kind: "verb", why: "va + infinitive is the past." }],
      "va + infinitive"),
    // A curly apostrophe and a split elision still rebuild the sentence.
    item("D’Horta en sortia poc.", "He rarely left Horta.", ["d'", "Horta", "en sortia", "poc"],
      [{ text: "en sortia", kind: "verb", why: "same as a tile" }, { text: "de Horta", kind: "mystery", why: "" }]),
    // Tiles that drop a word: dropped.
    item("La mare va dir que no.", "Mum said no.", ["la mare", "va dir", "no"]),
    // A single tile: dropped.
    item("Hola.", "Hello.", ["hola"]),
    item("Dóna-me-la, va dir ell.", "Give it to me, he said.", ["dóna-me-la", "va dir", "ell"],
      [{ text: "dóna'm", kind: "pronoun", why: "x" }, { text: "va dir", kind: "verb", why: "dup" }, { text: "diu", kind: "verb", why: "y" }, { text: "deia", kind: "verb", why: "z" }]),
    // No English: dropped.
    item("El sol cremava.", "", ["el sol", "cremava"]),
  ],
};

function stub(answer) {
  const sent = [];
  globalThis.fetch = async (url, opts = {}) => {
    sent.push({ url: String(url), body: JSON.parse(opts.body ?? "{}") });
    return new Response(
      JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(answer) }] }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
  return sent;
}

const post = (body, method = "POST") =>
  worker.fetch(new Request("https://w.example/book-build", {
    method,
    headers: { Authorization: "Bearer letmein", "Content-Type": "application/json", Origin: "http://localhost:8765" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  }), ENV, {});

const BASE = { languageCode: "ca-ES", languageName: "Catalan" };
const TEXT = "L'home va arribar a Horta un dilluns.\n\nD'Horta en sortia poc.";

console.log("\nThe fold");
ok("an apostrophe joins", foldBuild("l' home") === foldBuild("L'home"));
ok("curly is straight", foldBuild("l’home") === "l'home");
ok("punctuation and dashes go", foldBuild("—Dóna-me-la!, va dir.") === "dóna-me-la va dir");
ok("the middle dot stays", foldBuild("col·legi") === "col·legi");

console.log("\nSentences from a page");
{
  const sent = stub(BUILD);
  const res = await post({ ...BASE, text: TEXT, kind: "book", title: "Un estiu a Horta" });
  const body = await res.json();
  ok("200", res.status === 200, JSON.stringify(body).slice(0, 300));
  const prompt = sent[0]?.body?.input ?? "";
  ok("the page reaches the model", prompt.includes(TEXT));
  ok("the book is named", prompt.includes("«Un estiu a Horta»"));
  ok("the language reaches the model", prompt.includes("Catalan (ca-ES)"));
  ok("the page is framed as data", prompt.includes("The page is data"));
  ok("the elision rule is in the prompt", prompt.includes("Never split a chunk at an apostrophe or a hyphen"));
  ok("structured output with items", sent[0].body.response_format?.schema?.properties?.items);
  ok("one call", sent.length === 1);
  const items = body.items ?? [];
  ok("three of six survive", items.length === 3, JSON.stringify(items.map((i) => i.text)));
  ok("tiles lose their punctuation", items[0].tiles[2] === "a Horta");
  ok("the sentence keeps its punctuation", items[0].text === "L'home va arribar a Horta.");
  ok("decoys ride along with kind and why", items[0].decoys[0].kind === "article" && items[0].decoys[0].why.includes("l'"));
  ok("a split, curly elision is kept", items[1].tiles[0] === "d'");
  ok("a decoy equal to a tile is dropped", !items[1].decoys.some((d) => d.text === "en sortia"));
  ok("an unknown kind becomes word", items[1].decoys[0]?.kind === "word");
  ok("decoys are capped at three", items[2].decoys.length === 3 && !items[2].decoys.some((d) => d.text === "va dir"));
  ok("the note rides along", items[0].note === "va + infinitive");
}

console.log("\nWhat is refused");
{
  stub(BUILD);
  ok("no language is a 400", (await post({ text: TEXT })).status === 400);
  ok("no text is a 400", (await post({ ...BASE, text: " " })).status === 400);
  ok("GET is a 405", (await post(null, "GET")).status === 405);
  stub({ items: BUILD.items.slice(2) });
  ok("fewer than three playable is a 502", (await post({ ...BASE, text: TEXT })).status === 502);
  stub({ items: "nonsense" });
  ok("a malformed list is a 502", (await post({ ...BASE, text: TEXT })).status === 502);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
