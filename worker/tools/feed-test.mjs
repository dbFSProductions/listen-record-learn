#!/usr/bin/env node
/* /feed, driven against the real Worker with `globalThis.fetch` stubbed to
 * hand back RSS. No network, no key. What it checks: only the allowlisted
 * sources are served; the second URL is tried when the first fails; the
 * parser reads title, link, date, summary, body, the audio enclosure and the
 * duration out of CDATA'd, entity-laden, HTML-bearing RSS; an image
 * enclosure is not audio; the route needs no Gemini key and skips the AI rate
 * limiter; and the passcode still gates it.
 *
 *     node worker/tools/feed-test.mjs
 */
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? "  <- " + extra : ""}`); }
};

// No GEMINI_API_KEY on purpose: the feeds must not need one.
const ENV = {
  APP_PASSCODE: "letmein",
  ALLOWED_ORIGINS: "http://localhost:8765",
  AI_RATE_LIMITER: { limit: async () => { throw new Error("the rate limiter must not be consulted for a feed"); } },
};

const PODCAST = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<title><![CDATA[En guàrdia!]]></title>
<link>https://www.ccma.cat/catradio/en-guardia/</link>
<item>
  <title><![CDATA[1011 - La batalla de Muret]]></title>
  <link>https://www.ccma.cat/catradio/alacarta/en-guardia/1011/audio/1234/</link>
  <pubDate>Sun, 31 Aug 2026 15:00:00 +0200</pubDate>
  <description><![CDATA[<p>El 12 de setembre de 1213, Pere el Cat&ograve;lic va morir a Muret.</p><p>Amb l&#39;historiador &amp; escriptor Josep Maria Sol&eacute;.</p>]]></description>
  <enclosure url="https://mp3.ccma.cat/en-guardia/1011.mp3" length="52000000" type="audio/mpeg"/>
  <itunes:duration>00:55:12</itunes:duration>
</item>
<item>
  <title>1010 - Els almog&agrave;vers</title>
  <link>https://www.ccma.cat/catradio/alacarta/en-guardia/1010/</link>
  <pubDate>Sun, 24 Aug 2026 15:00:00 +0200</pubDate>
  <description>Desperta ferro!</description>
  <enclosure url="https://mp3.ccma.cat/en-guardia/1010.mp3" type="audio/mpeg" />
  <itunes:duration>3300</itunes:duration>
</item>
</channel></rss>`;

const ARTICLES = `<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Sàpiens</title>
<item><title>Qui era Guifré el Pilós?</title><link>https://www.sapiens.cat/guifre</link><pubDate>Mon, 01 Sep 2026 08:00:00 +0000</pubDate>
<description><![CDATA[El comte que la llegenda fa fundador de Catalunya.]]></description>
<content:encoded><![CDATA[<img src="x.jpg"><p>El comte que la llegenda fa fundador de Catalunya.</p><p>Guifré va governar entre el 870 i el 897.</p>]]></content:encoded>
<enclosure url="https://www.sapiens.cat/guifre.jpg" type="image/jpeg"/>
</item></channel></rss>`;

function stub(byURL) {
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    const answer = byURL[String(url)];
    if (answer === undefined) return new Response("nope", { status: 404 });
    if (answer instanceof Error) throw answer;
    return new Response(answer, { status: 200, headers: { "Content-Type": "application/rss+xml" } });
  };
  return asked;
}

const post = (body, passcode = "letmein", path = "/feed") =>
  worker.fetch(new Request(`https://w.example${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${passcode}`, "Content-Type": "application/json", Origin: "http://localhost:8765" },
    body: JSON.stringify(body),
  }), ENV, {});

console.log("\nEn guàrdia!");
{
  const asked = stub({ "https://dinamics.ccma.cat/public/podcast/catradio/xml/4/4/podprograma944.xml": PODCAST });
  const res = await post({ source: "en-guardia" });
  const body = await res.json();
  ok("200 with no Gemini key", res.status === 200, JSON.stringify(body).slice(0, 200));
  ok("the channel title is read", body.title === "En guàrdia!", body.title);
  ok("it is a podcast", body.kind === "podcast");
  ok("two items", body.items?.length === 2);
  const [first, second] = body.items ?? [];
  ok("CDATA title", first?.title === "1011 - La batalla de Muret", first?.title);
  ok("link and date", first?.link.endsWith("/1234/") && first?.date.startsWith("Sun, 31 Aug"));
  ok("HTML is stripped and entities decoded in the summary", first?.summary === "El 12 de setembre de 1213, Pere el Catòlic va morir a Muret.\nAmb l'historiador & escriptor Josep Maria Solé.", JSON.stringify(first?.summary));
  ok("the audio enclosure is read", first?.audio === "https://mp3.ccma.cat/en-guardia/1011.mp3", first?.audio);
  ok("and its duration", first?.duration === "00:55:12" && second?.duration === "3300");
  ok("an entity in a plain title is decoded", second?.title === "1010 - Els almogàvers", second?.title);
  ok("one fetch, the first URL", asked.length === 1);
}

console.log("\nSàpiens, and the second URL");
{
  const asked = stub({ "https://www.sapiens.cat/rss": ARTICLES });
  const res = await post({ source: "sapiens" });
  const body = await res.json();
  ok("200", res.status === 200, JSON.stringify(body).slice(0, 200));
  ok("the first URL failed and the second was tried", asked[0] === "https://www.sapiens.cat/feed" && asked[1] === "https://www.sapiens.cat/rss", asked.join(" "));
  ok("it is articles", body.kind === "articles");
  const item = body.items?.[0];
  ok("the summary is the description", item?.summary === "El comte que la llegenda fa fundador de Catalunya.", item?.summary);
  ok("the body is the longer content:encoded, stripped", item?.body === "El comte que la llegenda fa fundador de Catalunya.\nGuifré va governar entre el 870 i el 897.", JSON.stringify(item?.body));
  ok("an image enclosure is not audio", item?.audio === "");
}

console.log("\nWhat is refused");
{
  stub({});
  ok("an unknown source is a 404", (await post({ source: "bbc" })).status === 404);
  ok("no source is a 404", (await post({})).status === 404);
  ok("the wrong passcode is a 401", (await post({ source: "sapiens" }, "wrong")).status === 401);
  const res = await post({ source: "sapiens" });
  ok("every URL failing is a 502", res.status === 502, String(res.status));
  ok("and says which feed", (await res.json()).error.includes("Sàpiens"));
  stub({ "https://www.sapiens.cat/feed": "<rss><channel><title>x</title></channel></rss>", "https://www.sapiens.cat/rss": ARTICLES });
  ok("an empty feed falls through to the next URL", (await post({ source: "sapiens" })).status === 200);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
