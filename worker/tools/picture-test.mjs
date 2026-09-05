#!/usr/bin/env node
/* What /picture does, asserted against the real Worker.
 *
 * Drives `worker.fetch` with `globalThis.fetch` stubbed, importing src/index.js
 * rather than reimplementing any of it — so a pass here is a pass for the
 * deployed code and not for a copy of it. No key and no network: this is the
 * half of the drawing path that CAN be checked without spending anything.
 * The other half — whether the picture is any good — is worker/tools/draw-one.mjs,
 * which needs a real token.
 *
 *     node worker/tools/picture-test.mjs
 *
 * It also runs under macOS's JavaScriptCore with a handful of Workers-runtime
 * shims; that is how it was written, there being no node on that machine.
 */
import worker from "../src/index.js";

let pass = 0, fail = 0;
const say = typeof print === "function" ? print : console.log;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; say(`  ok   ${name}`); }
  else { fail++; say(`  FAIL ${name}${extra ? "  <- " + extra : ""}`); }
};

const ENV = {
  APP_PASSCODE: "letmein",
  GEMINI_API_KEY: "not-used-on-this-path",
  ALLOWED_ORIGINS: "http://localhost:8765",
  REPLICATE_API_TOKEN: "r8_fake",
  AI_RATE_LIMITER: { limit: async () => ({ success: true }) },
};

const CARD = {
  languageCode: "es-ES",
  languageName: "Spanish (Spain)",
  card: {
    text: "el tenedor", translation: "the fork", sounds: "ten-a-door",
    picture: "A ten-dollar bill nailed to your front door — and the nail is a fork.",
  },
};

const req = (body) => new Request("https://w.example/picture", {
  method: "POST",
  headers: { Authorization: "Bearer letmein", "Content-Type": "application/json",
             Origin: "http://localhost:8765" },
  body: JSON.stringify(body ?? CARD),
});

/* 1 MB, which is both a realistic drawing (seedream-4 handed back 977 KB) and
   past the point where String.fromCharCode(...bytes) throws RangeError — so
   this is the fixture that actually holds base64OfBytes's chunking down.
   At 70 KB the naive version passes and the assertion proves nothing. */
const BIG = new Uint8Array(1_000_000);
for (let i = 0; i < BIG.length; i++) BIG[i] = i % 256;

function stub(handler) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    return handler(String(url), opts, calls.length);
  };
  return calls;
}
const jsonRes = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
const bytesRes = (bytes, type = "image/jpeg") =>
  new Response(bytes, { status: 200, headers: { "Content-Type": type } });

say("\nReplicate path");
{
  const calls = stub((url) =>
    url.includes("api.replicate.com")
      ? jsonRes({ status: "succeeded", output: "https://replicate.delivery/out-0.jpg" })
      : bytesRes(BIG));
  const res = await worker.fetch(req(), ENV, {});
  const body = await res.json();

  ok("200", res.status === 200, `got ${res.status} ${JSON.stringify(body).slice(0,160)}`);
  ok("no Gemini call", !calls.some((c) => c.url.includes("googleapis.com")),
     calls.map(c=>c.url).join(" | "));
  ok("posts to the model's predictions endpoint",
     calls[0].url === "https://api.replicate.com/v1/models/google/nano-banana-2/predictions", calls[0].url);
  ok("sends Prefer: wait=45", calls[0].opts.headers.Prefer === "wait=45");
  ok("sends the bearer token", calls[0].opts.headers.Authorization === "Bearer r8_fake");
  const sent = JSON.parse(calls[0].opts.body);
  ok("sends the default input fields",
     sent.input.aspect_ratio === "1:1" && sent.input.resolution === "1K" && sent.input.output_format === "jpg",
     JSON.stringify(sent.input).slice(0,120));
  ok("prompt carries the scene", sent.input.prompt.includes("nailed to your front door"));
  ok("prompt still forbids lettering", sent.input.prompt.includes("No lettering"));
  ok("fetches the output url", calls[1].url === "https://replicate.delivery/out-0.jpg");
  ok("mimeType from the file response", body.image.mimeType === "image/jpeg", body.image?.mimeType);
  ok("base64 round-trips over the 32k chunk boundary", (() => {
      const bin = atob(body.image.data);
      if (bin.length !== BIG.length) return false;
      for (let i = 0; i < BIG.length; i += 997) if (bin.charCodeAt(i) !== BIG[i]) return false;
      return true;
    })(), `len ${atob(body.image?.data ?? "").length} vs ${BIG.length}`);
  ok("reports the model it used", body.model === "google/nano-banana-2", body.model);
}

say("\nOutput shapes");
/* The whole URL, not merely "something was fetched": read as `output[0]`, a
   bare string yields "h" — which a lenient stub will happily serve and a
   weaker assertion will happily pass. */
for (const [label, output, want] of [
  ["array (flux)", ["https://replicate.delivery/a.webp"], "https://replicate.delivery/a.webp"],
  ["string (nano-banana)", "https://replicate.delivery/b.jpg", "https://replicate.delivery/b.jpg"],
]) {
  const calls = stub((url) => url.includes("api.replicate.com")
    ? jsonRes({ status: "succeeded", output }) : bytesRes(BIG));
  const res = await worker.fetch(req(), ENV, {});
  ok(`handles ${label}`, res.status === 200 && calls.length === 2 && calls[1].url === want,
     `status ${res.status}, fetched ${calls[1]?.url}`);
}

say("\nErrors are reported as themselves");
for (const [status, detail, want, needle] of [
  [401, "", 502, "token is wrong"],
  [402, "Insufficient credit.", 502, "Insufficient credit"],
  [404, "", 502, "No such Replicate model"],
  [429, "", 503, "rate-limiting"],
]) {
  stub(() => jsonRes({ detail }, status));
  const res = await worker.fetch(req(), ENV, {});
  const body = await res.json();
  ok(`${status} -> ${want} "${needle}"`,
     res.status === want && body.error.includes(needle), `${res.status} ${body.error}`);
}
{
  stub(() => jsonRes({ status: "processing", output: null }));
  const res = await worker.fetch(req(), ENV, {});
  const body = await res.json();
  ok("unfinished prediction -> 504", res.status === 504 && body.error.includes("taking too long"),
     `${res.status} ${body.error}`);
}
/* The Worker's own deadline on the prediction request, going first. This was
   the way a slow render actually failed: the wait was 45s under a 40s abort, so
   Replicate's "processing" answer never arrived, the abort was not a
   PublicError, and the phone got the generic "couldn't answer that". Both slow
   paths now say the same thing. */
{
  stub(() => { const e = new Error("The operation was aborted due to timeout"); e.name = "TimeoutError"; throw e; });
  const res = await worker.fetch(req(), ENV, {});
  const body = await res.json();
  ok("our own abort -> 504, same words as processing",
     res.status === 504 && body.error.includes("taking too long"), `${res.status} ${body.error}`);
}
{
  stub(() => { throw new TypeError("fetch failed"); });
  const res = await worker.fetch(req(), ENV, {});
  const body = await res.json();
  ok("network failure to Replicate -> 502, named",
     res.status === 502 && body.error.includes("reach Replicate"), `${res.status} ${body.error}`);
}
{
  stub((url) => {
    if (url.includes("api.replicate.com")) return jsonRes({ status: "succeeded", output: "https://replicate.delivery/slow.jpg" });
    const e = new Error("timeout"); e.name = "TimeoutError"; throw e;
  });
  const res = await worker.fetch(req(), ENV, {});
  const body = await res.json();
  ok("file fetch aborting -> 502 'could not be fetched'",
     res.status === 502 && body.error.includes("could not be fetched"), `${res.status} ${body.error}`);
}
{
  stub((url) => url.includes("api.replicate.com")
    ? jsonRes({ status: "succeeded", output: "https://replicate.delivery/huge.jpg" })
    : bytesRes(new Uint8Array(3_100_000)));
  const res = await worker.fetch(req(), ENV, {});
  ok("oversize drawing refused", res.status === 502, String(res.status));
}
{
  stub((url) => url.includes("api.replicate.com")
    ? jsonRes({ status: "succeeded", output: "https://replicate.delivery/gone.jpg" })
    : new Response("nope", { status: 404 }));
  const res = await worker.fetch(req(), ENV, {});
  const body = await res.json();
  ok("unfetchable drawing refused", res.status === 502 && body.error.includes("could not be fetched"),
     `${res.status} ${body.error}`);
}

say("\nConfig");
{
  const calls = stub((url) => url.includes("api.replicate.com")
    ? jsonRes({ status: "succeeded", output: "u" }) : bytesRes(BIG));
  await worker.fetch(req(), { ...ENV, REPLICATE_MODEL: "black-forest-labs/flux-schnell",
                              REPLICATE_INPUT: '{"megapixels":"0.25"}' }, {});
  ok("REPLICATE_MODEL swaps the endpoint",
     calls[0].url.includes("/models/black-forest-labs/flux-schnell/predictions"), calls[0].url);
  const sent = JSON.parse(calls[0].opts.body);
  ok("REPLICATE_INPUT replaces the defaults",
     sent.input.megapixels === "0.25" && sent.input.resolution === undefined,
     JSON.stringify(sent.input).slice(0,120));
}
{
  const calls = stub((url) => url.includes("api.replicate.com")
    ? jsonRes({ status: "succeeded", output: "u" }) : bytesRes(BIG));
  const res = await worker.fetch(req(), { ...ENV, REPLICATE_INPUT: "{not json" }, {});
  const sent = JSON.parse(calls[0].opts.body);
  ok("bad REPLICATE_INPUT degrades to prompt-only, not a 500",
     res.status === 200 && Object.keys(sent.input).length === 1 && sent.input.prompt,
     `${res.status} ${JSON.stringify(sent.input).slice(0,80)}`);
}
{
  // No Replicate token: the old Gemini path, untouched.
  const calls = stub(() => jsonRes({ steps: [{ type: "model_output",
    content: [{ type: "image", inline_data: { data: "AAAA", mime_type: "image/png" } }] }] }));
  const res = await worker.fetch(req(), { ...ENV, REPLICATE_API_TOKEN: "" }, {});
  const body = await res.json();
  ok("no token -> Gemini path still works",
     res.status === 200 && body.image.data === "AAAA", `${res.status} ${JSON.stringify(body).slice(0,120)}`);
  ok("no token -> talks to Google, not Replicate",
     calls[0].url.includes("googleapis.com"), calls[0].url);
}

say("\nValidation still bites");
{
  stub(() => jsonRes({}));
  const res = await worker.fetch(req({ ...CARD, card: { ...CARD.card, picture: "" } }), ENV, {});
  const body = await res.json();
  ok("no scene -> 400", res.status === 400 && body.error.includes("Write the picture first"),
     `${res.status} ${body.error}`);
}

say(`\n${pass} passed, ${fail} failed`);
if (fail) throw new Error(`${fail} failing assertions`);
