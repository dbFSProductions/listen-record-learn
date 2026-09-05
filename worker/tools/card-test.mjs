#!/usr/bin/env node
/* What /complete-card sends to the model, asserted against the real Worker.
 *
 * Same shape as picture-test.mjs: `worker.fetch` driven with `globalThis.fetch`
 * stubbed, importing src/index.js rather than reimplementing it. No key and no
 * network.
 *
 *     node worker/tools/card-test.mjs
 *
 * The assertion that matters most here is the *first* one. This Worker serves
 * three apps from one deployment, and only Xerra sends `ask`. So the prompt a
 * caller without one produces has to be unchanged, character for character —
 * that is what makes the Quick tab additive rather than a change to
 * Deb-o-lingo's and Mum-o-lingo's card generation. It is checked against the
 * committed previous version of the file, not against a copy of the string:
 *
 *     git show HEAD:worker/src/index.js > /tmp/before.js
 *     BEFORE=/tmp/before.js node worker/tools/card-test.mjs
 *
 * Without BEFORE set that one check is skipped and the rest still run.
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

// The shape both sister apps send, and have always sent.
const SISTER = {
  target: "", english: "a beer please", situation: "in a bar",
  deck: "Bebidas", languageCode: "es-ES", languageName: "Spanish (Spain)",
};
// What Xerra's Quick tab sends: no card, one line asking for one.
const QUICK = {
  target: "", english: "", situation: "",
  ask: "I'm about to walk into a pharmacy, how do I ask if they have my medicine?",
  deck: "Quick", languageCode: "ca-ES", languageName: "Catalan",
};

const CARD = {
  text: "Tenen la meva medicació?", translation: "Do you have my medication?",
  situation: "At the pharmacy counter", usageNote: "Neutral and polite.",
  focusNote: "me-di-ka-si-O.", reviewNote: "Built from what you asked for.",
};

function stub() {
  const sent = [];
  globalThis.fetch = async (url, opts = {}) => {
    sent.push({ url: String(url), body: JSON.parse(opts.body ?? "{}") });
    return new Response(
      JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(CARD) }] }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
  return sent;
}

const post = (body, path = "/complete-card") =>
  worker.fetch(new Request(`https://w.example${path}`, {
    method: "POST",
    headers: { Authorization: "Bearer letmein", "Content-Type": "application/json",
               Origin: "http://localhost:8765" },
    body: JSON.stringify(body),
  }), ENV, {});

const promptOf = (sent) => sent[0]?.body?.input ?? "";

console.log("\nA caller that sends no `ask` is untouched");
{
  const sent = stub();
  const res = await post(SISTER);
  ok("200", res.status === 200, String(res.status));
  const now = promptOf(sent);
  ok("no ask paragraph", !now.includes("they are asking you for it"));
  ok("the draft JSON carries no `ask` key", !now.includes('"ask"'), now.slice(-200));

  if (process.env.BEFORE) {
    const before = await import(process.env.BEFORE);
    const oldSent = stub();
    await before.default.fetch(new Request("https://w.example/complete-card", {
      method: "POST",
      headers: { Authorization: "Bearer letmein", "Content-Type": "application/json",
                 Origin: "http://localhost:8765" },
      body: JSON.stringify(SISTER),
    }), ENV, {});
    ok("byte-identical to the previous version", promptOf(oldSent) === now,
       `${promptOf(oldSent).length} vs ${now.length}`);
  } else {
    console.log("  --   byte-identity check skipped (set BEFORE=/path/to/old/index.js)");
  }
}

console.log("\nQuick's one line");
{
  const sent = stub();
  const res = await post(QUICK);
  const body = await res.json();
  ok("200", res.status === 200, JSON.stringify(body).slice(0, 200));
  const prompt = promptOf(sent);
  ok("the ask paragraph is there", prompt.includes("they are asking you for it"));
  ok("and says not to translate it", prompt.includes("never as text to translate"));
  ok("the line itself reaches the model", prompt.includes("walk into a pharmacy"));
  ok("a card comes back", body.text === CARD.text, JSON.stringify(body).slice(0, 120));
}

console.log("\nWhat is still refused");
{
  stub();
  const res = await post({ ...SISTER, english: "", target: "" });
  ok("nothing to work from is a 400", res.status === 400, String(res.status));
  stub();
  const res2 = await post({ ...QUICK, deck: "" });
  ok("no deck is still a 400", res2.status === 400, String(res2.status));
  stub();
  const sent = stub();
  await post({ ...QUICK, ask: "x".repeat(5000) });
  ok("an oversized ask is cut, not refused", promptOf(sent).includes("x".repeat(1000)) &&
     !promptOf(sent).includes("x".repeat(1001)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
