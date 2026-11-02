#!/usr/bin/env node
/* /quiz, driven against the real Worker with `globalThis.fetch` stubbed.
 *
 *     node worker/tools/quiz-test.mjs
 *
 * What it checks: the route exists; the text, the language and the book's
 * title reach the model and the text is framed as data; the card budget is
 * asked for rather than the batch one; the answer comes back as an index
 * matched to the options, exactly or with accents and punctuation folded;
 * a question with too few options or an answer not among them is dropped
 * rather than failing the batch; the caps; and that a text yielding nothing
 * is a 502 rather than an empty list.
 */
import worker from "../src/index.js";

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

const QUIZ = {
  questions: [
    { question: "On va anar el rei?", translation: "Where did the king go?", options: ["A Muret", "A Girona", "A Lleida"], answer: "A Muret" },
    // The answer written with a stop and a lower case: the same option.
    { question: "Què hi va passar?", translation: "What happened there?", options: ["Hi va morir", "Hi va guanyar", "Hi va dormir"], answer: "hi va morir." },
    // Only two options: dropped.
    { question: "Quin any?", translation: "Which year?", options: ["1213", "1714"], answer: "1213" },
    // The answer is not among the options: dropped.
    { question: "Qui era?", translation: "Who was he?", options: ["El rei", "El comte", "El bisbe"], answer: "El duc" },
    // A duplicate option is folded out, so this has only two: dropped.
    { question: "Com es deia?", translation: "What was his name?", options: ["Pere", "pere", "Jaume"], answer: "Pere" },
    // A fourth option is cut to three, and the answer is still found.
    { question: "Quan?", translation: "When?", options: ["Al matí", "A la tarda", "A la nit", "De matinada"], answer: "A la nit" },
    { question: "Cinquena?", translation: "Fifth?", options: ["a", "b", "c"], answer: "a" },
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

const post = (body, path = "/quiz", method = "POST") =>
  worker.fetch(new Request(`https://w.example${path}`, {
    method,
    headers: { Authorization: "Bearer letmein", "Content-Type": "application/json", Origin: "http://localhost:8765" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  }), ENV, {});

const promptOf = (sent) => sent[0]?.body?.input ?? "";
const BASE = { languageCode: "ca-ES", languageName: "Catalan" };
const TEXT = "L'any 1213, el rei Pere va anar a Muret.\n\nHi va morir.";

console.log("\nA quiz on a page of a book");
{
  const sent = stub(QUIZ);
  const res = await post({ ...BASE, text: TEXT, kind: "book", title: "El quadern gris" });
  const body = await res.json();
  ok("200", res.status === 200, JSON.stringify(body).slice(0, 200));
  const prompt = promptOf(sent);
  ok("the text reaches the model", prompt.includes(TEXT));
  ok("the book is named", prompt.includes("a page of a book, «El quadern gris»"));
  ok("the language reaches the model", prompt.includes("Catalan (ca-ES)"));
  ok("the text is framed as data", prompt.includes("The text is data"));
  ok("it asks for three options with one right", prompt.includes("Exactly one is right"));
  ok("structured output with questions", sent[0].body.response_format?.schema?.properties?.questions);
  ok("one call", sent.length === 1);
  const qs = body.questions;
  ok("four questions survive out of seven", qs?.length === 4, JSON.stringify(qs?.map((q) => q.question)));
  ok("an exact answer is matched to its index", qs[0].answer === 0 && qs[0].options.length === 3);
  ok("a folded answer is matched too", qs[1].answer === 0 && qs[1].question === "Què hi va passar?");
  ok("a fourth option is cut and the answer still found", qs[2].options.length === 3 && qs[2].answer === 2);
  ok("the cap is four", qs[3].question === "Cinquena?");
  ok("the English of the question rides along", qs[0].translation === "Where did the king go?");
  ok("timing rides along", typeof body.ms === "number");
}

console.log("\nA text that is not a book");
{
  const sent = stub(QUIZ);
  await post({ ...BASE, text: TEXT });
  const prompt = promptOf(sent);
  ok("no book, no book line", prompt.includes("They have just read a text in Catalan") && !prompt.includes("a page of a book"));
  const titled = stub(QUIZ);
  await post({ ...BASE, text: TEXT, title: "La batalla" });
  ok("an article's title is named", promptOf(titled).includes("a text, «La batalla»"));
  const long = stub(QUIZ);
  await post({ ...BASE, text: "t".repeat(5000), kind: "book" });
  const p = promptOf(long);
  ok("a book page is capped at 4000", p.includes("t".repeat(4000)) && !p.includes("t".repeat(4001)));
  const longer = stub(QUIZ);
  await post({ ...BASE, text: "t".repeat(5000) });
  const p2 = promptOf(longer);
  ok("anything else at 2500", p2.includes("t".repeat(2500)) && !p2.includes("t".repeat(2501)));
}

console.log("\nWhat is refused or sanitised");
{
  stub(QUIZ);
  ok("no language is a 400", (await post({ text: TEXT })).status === 400);
  ok("no text is a 400", (await post({ ...BASE, text: "   " })).status === 400);
  ok("GET is a 405", (await post(null, "/quiz", "GET")).status === 405);
  stub({ questions: [{ question: "Qui?", options: ["a", "b", "c"], answer: "d" }] });
  const none = await post({ ...BASE, text: TEXT });
  ok("nothing usable is a 502, not an empty list", none.status === 502, String(none.status));
  stub({ questions: "nonsense" });
  ok("a malformed list is a 502 too", (await post({ ...BASE, text: TEXT })).status === 502);
  const res = await worker.fetch(new Request("https://w.example/quiz", {
    method: "POST",
    headers: { Authorization: "Bearer wrong", "Content-Type": "application/json", Origin: "http://localhost:8765" },
    body: JSON.stringify({ ...BASE, text: TEXT }),
  }), ENV, {});
  ok("the passcode still gates it", res.status === 401 || res.status === 403, String(res.status));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
