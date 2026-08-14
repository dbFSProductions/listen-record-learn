# Testing Xerra on the phone

How to get the web app onto your iPhone, over WiFi from the Mac, with the
microphone and Azure both working.

Allow about ten minutes the first time. After that it's one command.

---

## Why it isn't just "open the IP address"

Recording needs what browsers call a **secure context**. `localhost` counts as
secure even over plain HTTP, but `http://192.168.x.x` does not. Served that
way, the app looks completely fine — it loads, it renders, it plays audio — and
then `navigator.mediaDevices` is undefined and recording fails with *"Couldn't
start recording."*

Tapping through Safari's certificate warning doesn't fix it either. An
untrusted certificate still withholds the microphone and blocks the service
worker.

So `tools/serve.py` creates a small certificate authority, serves HTTPS with a
certificate signed by it, and offers you the CA to install. Once the phone
trusts it, the app is a genuinely secure origin and everything behaves as it
would in production.

---

## On the Mac

**1. Get the code and start the server.**

```bash
cd path/to/listen-record-learn
git checkout main
git pull
python3 tools/serve.py
```

**2. Note the two addresses it prints.**

| | looks like |
|---|---|
| **App** | `https://192.168.x.x:8765/` |
| **Certificate** | `http://192.168.x.x:8766/ca.crt` |

The certificate one is plain `http` and one port higher. That's deliberate —
the phone can't use HTTPS until it trusts the certificate it's downloading.

**Leave the Terminal window open.** Closing it stops the server.

---

## On the phone — install the certificate

The phone must be on the same WiFi as the Mac.

**3.** In **Safari**, open the **certificate** address:
`http://192.168.x.x:8766/ca.crt`

**4.** A box appears: *"This website is trying to download a configuration
profile."* Tap **Allow**.

**5.** Open the **Settings** app. Near the top, above your name, there's a new
row: **Profile Downloaded**. Tap it.

**6.** Tap **Install** (top right) → passcode → **Install** → **Install** on
the warning → **Done**.

**7.** Still in Settings: **General** → **About** → scroll to the very bottom →
**Certificate Trust Settings**.

**8.** Turn **ON** the toggle for **Xerra dev CA**. Confirm with **Continue**.

> ### Step 8 is the one that matters
>
> Steps 3–6 on their own are not enough. Without this toggle, Safari will show
> you the app and still refuse the microphone. If recording fails later, this
> is the first thing to check.

---

## On the phone — run the app

**9.** In Safari, open the **app** address: `https://192.168.x.x:8765/`

It should load with **no certificate warning**. A warning here means step 8
didn't take — go back and check the toggle.

**10.** Tap the **Settings** tab. Paste your Azure key, set the region to
`northeurope`, tap **Save and test**.

Wait for it to come back with *"Azure is working."*

**11.** Tap **Practise** → **Sounds** → **Listen**. You should hear a Catalan
voice reading the phrase.

**12.** Tap the orange **record** button. Safari asks for the microphone — tap
**Allow**. Say the phrase. Tap the button again to stop.

You should get two stacked waveforms, an **Intonation** section you can expand,
and a score with tappable word chips.

---

## Only then, Add to Home Screen

Get the whole loop working in Safari first — errors are much easier to see
there. Once it works: **Share** → **Add to Home Screen**.

Expect to **paste the Azure key again** in the installed app. iOS gives a Home
Screen web app its own storage, separate from Safari's, so it starts empty.

---

## What this setup can't be

The app's identity is the URL it's served from, so here it's tied to the Mac's
current WiFi address. When the router hands out a different lease that becomes
a different origin: the Home Screen icon stops working, and the key, phrases
and recordings stored against the old address are gone.

`serve.py` reissues the certificate automatically so *testing* keeps working —
and it reuses the same CA, so the phone never has to trust anything twice — but
a Home Screen install off a LAN address is disposable by design.

Actually living with the app needs a stable origin: GitHub Pages, which
requires the repo to be public, or a tunnel with a reserved domain.

---

## If something goes wrong

| What you see | Almost certainly |
|---|---|
| *"Couldn't start recording"* | Step 8 — the trust toggle isn't on |
| Certificate warning at step 9 | Same; the profile installed but isn't trusted |
| *"Azure rejected the key…"* | Wrong key, or region doesn't match the resource |
| *"Couldn't reach Azure"* | The phone's WiFi has no internet |
| *"Azure couldn't make out any speech"* | Recording worked. Speak up, closer to the mic |
| Safari can't open the page at all | Wrong address, phone on a different network, or the Mac's firewall is blocking the port |
| Changes don't appear when iterating | The service worker cache. Hard-reload, or bump `VERSION` in `docs/sw.js` |

Without an Azure key the app still runs, but on the web build you get listening
only — no model audio to compare against, so no waveform comparison and no
score. That's a Safari limitation, not a missing feature: a web page can play
the browser's built-in voice but cannot capture it to a file.

---

## Just looking at the UI

If you don't need the microphone, skip the whole certificate business:

```bash
python3 tools/serve.py --http
```

Plain HTTP, opens anywhere on the WiFi, recording will not work.
