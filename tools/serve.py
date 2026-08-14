#!/usr/bin/env python3
"""Serve docs/ to the phone over the local network, so recording works.

    python3 tools/serve.py

Recording needs a *secure context*. Browsers treat `localhost` as secure over
plain HTTP, but `http://192.168.x.x` is not — so the app opened from the phone
over plain HTTP loads, renders and plays audio, then fails to reach the
microphone. `navigator.mediaDevices` is simply undefined, which the app reports
as "Couldn't start recording."

Tapping through Safari's self-signed-certificate warning is not enough either:
Safari will show you the page but still withhold the microphone and refuse to
register a service worker, because it doesn't trust the certificate.

So this mints a small certificate authority, serves a certificate signed by it,
and offers the CA for download at /ca.crt. Install and trust that on the phone
once and the app becomes a genuinely secure origin: microphone, service worker
and Add to Home Screen all behave as they would in production.

Everything lives in tools/.devcert/, which is gitignored. It is a throwaway for
one machine on your own WiFi, not a credential — but it is a real CA your phone
will trust, so don't hand the key to anyone and delete the profile when you're
done testing.

    --http    plain HTTP instead; the UI loads, recording will not work
    --port N  default 8765
"""
import argparse
import http.server
import mimetypes
import pathlib
import socket
import ssl
import subprocess
import sys
import tempfile
import threading

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
CERTDIR = pathlib.Path(__file__).resolve().parent / ".devcert"
CA_CERT = CERTDIR / "ca.crt"
CA_KEY = CERTDIR / "ca.key"
CERT = CERTDIR / "dev.crt"
KEY = CERTDIR / "dev.key"

# Apple refuses to trust TLS server certificates with a long life, so keep the
# leaf under their limit. The CA itself may live longer.
LEAF_DAYS = "397"
CA_DAYS = "825"


def run(command, **kwargs):
    try:
        return subprocess.run(command, check=True, capture_output=True, **kwargs)
    except FileNotFoundError:
        sys.exit("openssl not found. Run with --http to at least see the UI.")
    except subprocess.CalledProcessError as error:
        sys.exit(f"openssl failed:\n{error.stderr.decode(errors='replace')}")


def lan_address() -> str:
    """This machine's address on the WiFi, as the phone would reach it."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Nothing is actually sent; this asks the routing table which local
        # interface would be used to get out.
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def ensure_ca() -> bool:
    """Create the CA if it isn't there. True if it's newly made."""
    if CA_CERT.exists() and CA_KEY.exists():
        return False
    CERTDIR.mkdir(exist_ok=True)
    run([
        "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
        "-keyout", str(CA_KEY), "-out", str(CA_CERT),
        "-days", CA_DAYS, "-subj", "/CN=Xerra dev CA",
        "-addext", "basicConstraints=critical,CA:TRUE",
        "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    ])
    CA_KEY.chmod(0o600)
    return True


def leaf_covers(address: str) -> bool:
    if not (CERT.exists() and KEY.exists()):
        return False
    text = run(["openssl", "x509", "-in", str(CERT), "-noout", "-text"]).stdout.decode()
    # Safari matches on the SAN extension, not the common name.
    return f"IP Address:{address}" in text


def ensure_leaf(address: str) -> None:
    """(Re)issue the server certificate when the WiFi address changes.

    The CA is reused, so a phone that already trusts it doesn't have to trust
    anything again after the router hands out a new lease.
    """
    if leaf_covers(address):
        return
    CERTDIR.mkdir(exist_ok=True)
    print(f"Issuing a certificate for {address} …")
    with tempfile.TemporaryDirectory() as tmp:
        csr = pathlib.Path(tmp) / "dev.csr"
        ext = pathlib.Path(tmp) / "dev.ext"
        ext.write_text(
            f"subjectAltName=IP:{address},IP:127.0.0.1,DNS:localhost\n"
            "basicConstraints=CA:FALSE\n"
            "keyUsage=critical,digitalSignature,keyEncipherment\n"
            "extendedKeyUsage=serverAuth\n"
        )
        run([
            "openssl", "req", "-newkey", "rsa:2048", "-nodes",
            "-keyout", str(KEY), "-out", str(csr), "-subj", "/CN=Xerra dev",
        ])
        run([
            "openssl", "x509", "-req", "-in", str(csr),
            "-CA", str(CA_CERT), "-CAkey", str(CA_KEY), "-CAcreateserial",
            "-out", str(CERT), "-days", LEAF_DAYS, "-extfile", str(ext),
        ])
    KEY.chmod(0o600)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DOCS), **kwargs)

    def do_GET(self):
        # Served from outside docs/ so the CA never ends up in a deployment.
        # The content type is what makes iOS offer it as an installable profile
        # rather than downloading it as a file.
        if self.path.split("?")[0] in ("/ca.crt", "/ca"):
            body = CA_CERT.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/x-x509-ca-cert")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        # The service worker caches hard, which makes "my change didn't apply"
        # the most common confusion when iterating. Refusing to let the browser
        # cache on top of that removes one layer of it.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        message = fmt % args
        if "GET" in message:
            sys.stderr.write(f"  {message}\n")


def banner(scheme: str, address: str, port: int, use_tls: bool, fresh_ca: bool) -> None:
    rule = "─" * 60
    print(f"\n{rule}")
    print(f"  On this Mac:   {scheme}://localhost:{port}/")
    print(f"  On the phone:  {scheme}://{address}:{port}/")
    print(rule)

    if not use_tls:
        print("\n  Plain HTTP. The app will load, but recording will NOT work —")
        print("  the microphone needs a secure context. Drop --http for that.\n")
        print("  Ctrl-C to stop.\n")
        return

    print("\n  FIRST TIME ON THIS PHONE — trust the certificate. Skip this and")
    print("  Safari shows the app but silently refuses the microphone:\n")
    print(f"    1. In Safari on the phone, open   http://{address}:{port + 1}/ca.crt")
    print("       (plain http, one port up — the phone can't use https until it")
    print("        trusts the certificate it's about to download)")
    print("    2. Allow the download, then: Settings → Profile Downloaded → Install")
    print("    3. Settings → General → About → Certificate Trust Settings →")
    print("       turn ON 'Xerra dev CA'.  This is the step people miss.\n")
    if fresh_ca:
        print("  (A new CA was just created, so this phone does need the steps above.)\n")
    print(f"  THEN open   https://{address}:{port}/   — no warning, microphone works.")
    print("  Share → Add to Home Screen to install it properly.\n")
    print("  Ctrl-C to stop.\n")


def serve(port: int, address: str, use_tls: bool, fresh_ca: bool) -> None:
    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
    scheme = "http"
    if use_tls:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(CERT, KEY)
        server.socket = context.wrap_socket(server.socket, server_side=True)
        scheme = "https"

    plain = None
    if use_tls:
        # A tiny plain-HTTP listener alongside, purely so the phone can fetch
        # the CA without first having to trust the CA. Chicken, meet egg.
        plain = http.server.ThreadingHTTPServer(("0.0.0.0", port + 1), Handler)
        threading.Thread(target=plain.serve_forever, daemon=True).start()

    banner(scheme, address, port, use_tls, fresh_ca)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        if plain:
            plain.shutdown()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--http", action="store_true", help="plain HTTP; no microphone")
    args = parser.parse_args()

    if not (DOCS / "index.html").exists():
        sys.exit(f"no app found at {DOCS}")

    # Python doesn't know this one, and the phone won't install the app to the
    # Home Screen without the manifest being served as JSON.
    mimetypes.add_type("application/manifest+json", ".webmanifest")
    mimetypes.add_type("text/javascript", ".js")

    address = lan_address()
    if address == "127.0.0.1":
        print("Couldn't work out this machine's WiFi address — falling back to localhost.")

    fresh_ca = False
    if not args.http:
        fresh_ca = ensure_ca()
        ensure_leaf(address)

    serve(args.port, address, use_tls=not args.http, fresh_ca=fresh_ca)


if __name__ == "__main__":
    main()
