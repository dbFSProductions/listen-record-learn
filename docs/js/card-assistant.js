// Client for the small Cloudflare Worker that keeps the Gemini key off-device.

function baseURL(settings) {
  return settings.assistantEndpoint.trim().replace(/\/+$/, "");
}

async function request(path, settings, options = {}) {
  if (!settings.hasAssistant) {
    throw new Error("Add the card assistant address and passcode in Settings first.");
  }

  let response;
  try {
    response = await fetch(`${baseURL(settings)}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.assistantPasscode.trim()}`,
        ...options.headers,
      },
      // The Worker gives Gemini up to 55s. Without a deadline here, a stalled
      // request leaves the button spinning forever with no way to retry.
      signal: AbortSignal.timeout?.(70_000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("The card assistant took too long to answer. Try again.");
    }
    throw new Error("Couldn't reach the card assistant. Check its address and your connection.");
  }

  const payload = await response.json().catch(() => ({}));
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

  chat(payload, settings) {
    return request("/chat", settings, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
