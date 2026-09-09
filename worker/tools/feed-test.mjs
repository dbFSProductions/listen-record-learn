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
  const asked = stub({ "https://dinamics.3cat.cat/public/podcast/catradio/xml/4/4/podprograma944.xml": PODCAST });
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
  const asked = stub({ "https://www.sapiens.cat/feed": ARTICLES });
  const res = await post({ source: "sapiens" });
  const body = await res.json();
  ok("200", res.status === 200, JSON.stringify(body).slice(0, 200));
  ok("the first URL failed and the second was tried", asked[0] === "https://www.sapiens.cat/uploads/feeds/feed_sapiens_ca.xml" && asked[1] === "https://www.sapiens.cat/feed", asked.join(" "));
  ok("it is articles", body.kind === "articles");
  const item = body.items?.[0];
  ok("the summary is the description", item?.summary === "El comte que la llegenda fa fundador de Catalunya.", item?.summary);
  ok("the body is the longer content:encoded, stripped", item?.body === "El comte que la llegenda fa fundador de Catalunya.\nGuifré va governar entre el 870 i el 897.", JSON.stringify(item?.body));
  ok("an image enclosure is not audio", item?.audio === "");
}

console.log("\nThe everyday sources");
{
  const asked = stub({ "https://feeds.fireside.fm/easycatalan/rss": PODCAST });
  const res = await post({ source: "easy-catalan" });
  const body = await res.json();
  ok("Easy Catalan is served as a podcast", res.status === 200 && body.kind === "podcast", String(res.status));
  ok("from its first URL, the fireside feed", asked.length === 1 && asked[0] === "https://feeds.fireside.fm/easycatalan/rss", asked.join(" "));
  ok("with the audio on every item", body.items?.every((i) => i.audio));

  stub({ "https://beteve.cat/feed/": ARTICLES });
  const news = await (await post({ source: "beteve" })).json();
  ok("betevé's site feed is served as articles", news.kind === "articles" && news.items?.length === 1, JSON.stringify(news).slice(0, 120));

  /* The listening source must not be served the news. Every guess fails,
     discovery on the radio page finds the site's posts feed — no audio —
     and that is refused rather than shown as episodes without a play button. */
  const HOME = `<html><head><link rel="alternate" type="application/rss+xml" href="https://beteve.cat/feed/"></head></html>`;
  const tried = stub({ "https://beteve.cat/radio/": HOME, "https://beteve.cat/feed/": ARTICLES });
  const radio = await post({ source: "beteve-radio" });
  ok("a podcast source that finds a feed with no audio is a 502", radio.status === 502, String(radio.status));
  ok("having followed discovery to the posts feed", tried.includes("https://beteve.cat/radio/") && tried.at(-1) === "https://beteve.cat/feed/", tried.join(" "));
  stub({ "https://beteve.cat/radio/feed/": ARTICLES, "https://beteve.cat/podcast/feed/": PODCAST });
  const fell = await (await post({ source: "beteve-radio" })).json();
  ok("and an audio-less guess falls through to the next one", fell.kind === "podcast" && fell.url === "https://beteve.cat/podcast/feed/", fell.url);
  stub({ "https://beteve.cat/feed/": ARTICLES.replace('type="image/jpeg"', 'type="audio/mpeg"') });
  const still = await (await post({ source: "beteve" })).json();
  ok("the reading source is not held to audio", still.kind === "articles" && still.items?.length === 1);

  /* What betevé's radio feed actually carries, as fetched on 2026-09-09: no
     enclosure anywhere, and a Kaltura player embedded in the post. The audio
     URL is built from the embed's own attributes, only where the radio flag
     says the entry is audio, and only for the source that asked for it. */
  const RADIO = `<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>betevé &#187; ràdio</title>
<item><title>Gastronomia en català amb Mercè Bacardit del Termcat</title><link>https://beteve.cat/taula-per-a-dos/gastronomia/</link><pubDate>Wed, 03 Sep 2026 10:00:00 +0000</pubDate>
<description><![CDATA[<p>Com ho podem fer per què la gastronomia sigui respectuosa amb la llengua?</p>]]></description>
<content:encoded><![CDATA[<p>Com ho podem fer per què la gastronomia sigui respectuosa amb la llengua?</p>
<h4 class="wp-block-heading">Escolta el pòdcast aquí:</h4>
<div><div id="1_kx3mizto" style="position:absolute"
  data-kaltura-wid="_2346171"
  data-kaltura-uiconf="42601131"
  data-kaltura-entry="1_kx3mizto"
  data-kaltura-cache="1788957899"
  data-kaltura-radio="1"
  data-kaltura-dobleclick="&quot;doubleClick&quot;:{}"
></div></div>]]></content:encoded></item>
<item><title>Un programa de televisió</title><link>https://beteve.cat/tv/</link><pubDate>Tue, 02 Sep 2026 10:00:00 +0000</pubDate>
<content:encoded><![CDATA[<p>Vídeo.</p><div id="1_3dg6ovrd" data-kaltura-wid="_2346171" data-kaltura-entry="1_3dg6ovrd"></div>]]></content:encoded></item>
</channel></rss>`;
  stub({ "https://beteve.cat/radio/feed/": RADIO });
  const kaltura = await (await post({ source: "beteve-radio" })).json();
  ok("a Kaltura radio embed is read as the episode's audio", kaltura.kind === "podcast" && kaltura.items?.[0].audio === "https://cdnapi.kaltura.com/p/2346171/sp/234617100/playManifest/entryId/1_kx3mizto/format/url/protocol/https/a.mp4", JSON.stringify(kaltura).slice(0, 200));
  ok("the embed's markup is not in the summary", kaltura.items?.[0].summary === "Com ho podem fer per què la gastronomia sigui respectuosa amb la llengua?", kaltura.items?.[0].summary);
  ok("an embed without the radio flag is a video, and gets no audio", kaltura.items?.[1].audio === "", kaltura.items?.[1].audio);
  stub({ "https://beteve.cat/feed/": RADIO });
  const sameMarkup = await (await post({ source: "beteve" })).json();
  ok("the same markup on the news source is not read for audio", sameMarkup.kind === "articles" && sameMarkup.items?.every((i) => i.audio === ""), JSON.stringify(sameMarkup.items?.map((i) => i.audio)));
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

console.log("\nA Latin-1 feed");
{
  // Catalunya Ràdio's feed is ISO-8859-1. Built as bytes so that a UTF-8
  // read would have turned every ò into U+FFFD, as it did on the phone.
  const latin1 = (text) => Uint8Array.from([...text].map((ch) => ch.charCodeAt(0)));
  const XML = `<?xml version="1.0" encoding="ISO-8859-1"?><rss version="2.0"><channel><title>En guàrdia!</title>
<item><title>Les cròniques de Kaminski a la Guerra Civil</title><link>https://x/1</link><description>Capítol 1296. La resistència amb què Catalunya va respondre a l'alçament.</description>
<enclosure url="https://mp3.x/1.mp3" type="audio/mpeg"/></item></channel></rss>`;
  globalThis.fetch = async () => new Response(latin1(XML), { status: 200, headers: { "Content-Type": "application/xml" } });
  const body = await (await post({ source: "en-guardia" })).json();
  ok("the accents survive a Latin-1 feed", body.items?.[0].title === "Les cròniques de Kaminski a la Guerra Civil", body.items?.[0].title);
  ok("in the summary too", body.items?.[0].summary === "Capítol 1296. La resistència amb què Catalunya va respondre a l'alçament.", body.items?.[0].summary);
  // Declared in the header instead of the XML.
  globalThis.fetch = async () => new Response(latin1(XML.replace(' encoding="ISO-8859-1"', "")), { status: 200, headers: { "Content-Type": "text/xml; charset=iso-8859-1" } });
  ok("or in the Content-Type", (await (await post({ source: "en-guardia" })).json()).items?.[0].title === "Les cròniques de Kaminski a la Guerra Civil");
  // Declared nowhere: sniffed from the failed UTF-8 decode.
  globalThis.fetch = async () => new Response(latin1(XML.replace(' encoding="ISO-8859-1"', "")), { status: 200, headers: { "Content-Type": "text/xml" } });
  ok("or nowhere, and still read right", (await (await post({ source: "en-guardia" })).json()).items?.[0].title === "Les cròniques de Kaminski a la Guerra Civil");
  // A UTF-8 feed with no declaration is still UTF-8.
  globalThis.fetch = async () => new Response(PODCAST.replace(' encoding="UTF-8"', ""), { status: 200, headers: { "Content-Type": "text/xml" } });
  ok("a UTF-8 feed is untouched", (await (await post({ source: "en-guardia" })).json()).items?.[1].title === "1010 - Els almogàvers");
}

console.log("\nAutodiscovery and Atom");
{
  const HOME = `<!doctype html><html><head><title>Sàpiens</title>
<link rel="alternate" type="application/rss+xml" title="Evil" href="https://evil.example/feed">
<link rel="alternate" type="application/atom+xml" title="Sàpiens" href="/noticies/atom.xml">
</head><body></body></html>`;
  const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Sàpiens — Notícies</title>
<entry><title>El setge de 1714</title><link rel="alternate" href="https://www.sapiens.cat/setge"/><published>2026-09-02T08:00:00Z</published>
<summary type="html"><![CDATA[<p>Com va caure Barcelona l&#39;11 de setembre.</p>]]></summary></entry>
<entry><title>Sense enlla&ccedil;</title><updated>2026-09-01T08:00:00Z</updated><content>Text sencer.</content></entry>
</feed>`;
  const asked = stub({ "https://www.sapiens.cat/": HOME, "https://www.sapiens.cat/noticies/atom.xml": ATOM });
  const res = await post({ source: "sapiens" });
  const body = await res.json();
  ok("200 through discovery", res.status === 200, JSON.stringify(body).slice(0, 200));
  ok("the guesses were tried first, then the home page", asked[0] === "https://www.sapiens.cat/uploads/feeds/feed_sapiens_ca.xml" && asked.includes("https://www.sapiens.cat/"), asked.join(" "));
  ok("the off-host link was never fetched", !asked.includes("https://evil.example/feed"));
  ok("the on-host link was, resolved against the page", asked.at(-1) === "https://www.sapiens.cat/noticies/atom.xml", asked.at(-1));
  ok("the Atom feed's title", body.title === "Sàpiens — Notícies", body.title);
  ok("two entries", body.items?.length === 2);
  ok("entry link from href, date from published", body.items?.[0].link === "https://www.sapiens.cat/setge" && body.items[0].date.startsWith("2026-09-02"));
  ok("summary stripped and decoded", body.items?.[0].summary === "Com va caure Barcelona l'11 de setembre.", body.items?.[0].summary);
  ok("an entity in an Atom title", body.items?.[1].title === "Sense enllaç" && body.items[1].body === "Text sencer.");
  ok("no audio on an Atom entry", body.items?.every((i) => i.audio === ""));
  ok("the discovered URL is reported", body.url === "https://www.sapiens.cat/noticies/atom.xml");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
