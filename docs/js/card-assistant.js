// Client for the small Cloudflare Worker that keeps the Gemini key off-device.

import { aiLog } from "./store.js";

function baseURL(settings) {
  return settings.assistantEndpoint.trim().replace(/\/+$/, "");
}

/* Every call goes through here, which makes it the one place worth timing.

   Two numbers, not one: `ms` is the whole round trip as the phone experienced
   it, and the Worker's own `ms` is how long Gemini took. The gap between them
   is network and Cloudflare, and separating the two is the difference between
   "the assistant is slow" and knowing whether to change the model or the
   connection. `models` says whether the first model asked was the one that
   answered — a call that fell back is slow for a reason no prompt change will
   fix. */
async function request(path, settings, options = {}) {
  if (!settings.hasAssistant) {
    throw new Error("Add the card assistant address and passcode in Settings first.");
  }

  const started = Date.now();
  let response;
  try {
    response = await fetch(`${baseURL(settings)}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.assistantPasscode.trim()}`,
        ...options.headers,
      },
      // The Worker budgets 60s across its retries and its fallback model, so it
      // answers first with a real reason. This deadline is the backstop: without
      // it a stalled request leaves the button spinning forever with no retry.
      signal: AbortSignal.timeout?.(70_000),
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    aiLog.record({ path, ms: Date.now() - started, ok: false, note: timedOut ? "timed out" : "unreachable" });
    if (timedOut) {
      throw new Error("The card assistant took too long to answer. Try again.");
    }
    throw new Error("Couldn't reach the card assistant. Check its address and your connection.");
  }

  const payload = await response.json().catch(() => ({}));
  aiLog.record({
    path,
    ms: Date.now() - started,
    workerMs: typeof payload.ms === "number" ? payload.ms : null,
    model: typeof payload.model === "string" ? payload.model : null,
    // Anything past the first model in the chain means the one before it failed.
    fellBack: typeof payload.models === "number" && payload.models > 1,
    ok: response.ok,
    note: response.ok ? "" : `HTTP ${response.status}`,
  });
  if (!response.ok) {
    throw new Error(payload.error || `Card assistant returned ${response.status}.`);
  }
  return payload;
}

export const cardAssistant = {
  test(settings) {
    return request("/health", settings, { method: "GET" });
  },

  complete(draft, settings) {
    return request("/complete-card", settings, {
      method: "POST",
      body: JSON.stringify(draft),
    });
  },

  /* Replies are a separate call on purpose: card generation has to stay the
     small fast one. See the Worker's REPLIES_SCHEMA comment. */
  replies(card, settings) {
    return request("/replies", settings, {
      method: "POST",
      body: JSON.stringify(card),
    });
  },

  /* The About me interview. Two calls, one conversation: /interview asks the
     next English question, /about-cards turns the whole transcript into
     phrases. Split for the same reason replies are split off card generation —
     writing five cards is the big slow call, and asking one question is not,
     so they must be able to fail separately. */
  interview(payload, settings) {
    return request("/interview", settings, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  aboutCards(payload, settings) {
    return request("/about-cards", settings, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  chat(payload, settings) {
    return request("/chat", settings, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
