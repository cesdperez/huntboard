# Security assessment, 14 October 2026

Huntboard has a sound basic access model for a small private event. Guessing an admin or team link is impractical with the current token generator. The main weaknesses are missing abuse controls and missing browser security headers. The shared creation code has no application protection against repeated guesses. A successful creation-code guess permits creating games, but does not grant access to existing games.

Assessed deployment: `https://huntboard.cesdperez.workers.dev`. Local source revision: `96847d1`. Cloudflare reported active Worker version `61ae4c0a-b476-4b85-aae0-1a5ec9024f64`, deployed at 15:53 UTC. Public responses matched the expected application behavior and a locally built asset filename. This does not establish that every deployed module matches the checked-out source.

This assessment used source review, deployment metadata, low-volume public HTTP requests, a dependency audit, and existing tests. It did not create games, change scores, rotate links, run a load test, or attempt to recover the production creation code. Production database records and valid privileged links were not accessed.

| Finding | Severity | Evidence | Recommended action |
| --- | --- | --- | --- |
| Creation-code guesses are not throttled by the app | Medium | Five consecutive wrong-code POSTs returned the normal application 403. No limiter exists in the route or deployed bindings. | Rate-limit `/new` POSTs before parsing the body; retain a randomly generated secret; consider Turnstile. |
| Application traffic can consume shared service quotas | Medium, with high impact during an event | No application request limits; every dynamic request invokes the Worker, and token lookups reach D1. | Add abuse controls, quota monitoring, and edge filtering for deliberate traffic attacks. |
| Browser security headers are missing | Low; defence in depth | Normal HTML and action responses lack CSP, framing controls, `nosniff`, and an explicit referrer policy. | Configure SvelteKit CSP and response headers for dynamic routes and assets. |
| Secret-link privacy and response caching are not explicitly hardened | Low; source-based concern | URL tokens are persistent bearer credentials. No private-route cache policy or referrer policy is configured. | Use `no-store`, `no-referrer`, and `noindex` on secret routes; redact tokens from logs. |
| Plain HTTP is served without a redirect | Low for this `.dev` deployment | A direct HTTP GET of `/new` returned 200. | Redirect HTTP before serving the app; send HSTS over HTTPS. |

1. **Creation-code guessing.** `src/routes/new/+page.server.ts:11` parses and checks every submission. There is no rate limit, attempt counter, challenge, or cooldown. The deployed bindings are only `ASSETS`, `DB`, and the secret `CREATE_GAME_CODE`. Five requests are a small behavior sample, not proof that Cloudflare has no higher-threshold edge protections. Source and binding review confirm the absence of an application limiter.

   `src/lib/server/creation-code.ts` hashes both inputs and compares equal-length digests without early exit. This reduces timing leakage and fails closed when the secret is missing. It does not prevent online guessing. The local `.env.prod` value has 24 characters and is not the documented development default. Length alone does not prove randomness, and its equality with the deployed secret was not verified. A genuinely random code of that length would be very difficult to guess; a short PIN or predictable phrase would be vulnerable.

   Start with a strict, configurable limit on anonymous creation attempts, using Cloudflare's trusted client-IP information rather than a caller-supplied identity. Account for shared IPs. Return 429 with `Retry-After`. A Worker [rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) is useful for bursts, but its counters are local to each Cloudflare location and eventually consistent. It is not a global lockout. If adding [Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), verify its response on the server before accepting the code.

2. **Availability and quota exhaustion.** An attacker does not need a valid token to invoke public dynamic pages or attempt invalid-token lookups. Someone with a valid scoreboard or team link can also repeatedly request database-backed pages. No load attack was performed, so the request volume needed to disrupt this deployment is unmeasured.

   On the documented free plan, [Workers](https://developers.cloudflare.com/workers/platform/limits/) allows 100,000 requests per day. [D1](https://developers.cloudflare.com/d1/platform/pricing/) allows 5 million rows read and 100,000 rows written daily; exhausting its daily read or write allowance stops queries until reset. The account's actual billing plan was not independently checked. Existing polling and SQL scans already use some of those allowances, as documented in `docs/decisions.md`.

   Rate-limit expensive reads and mutations before accessing D1. A limiter inside the Worker still requires a Worker invocation, so it cannot alone prevent exhaustion of the Worker request allowance. For stronger protection, use edge rules on an owned custom domain and disable alternate public routes that would bypass them. Monitor request and D1 usage. Index the cross-game scans described in the decisions document. Enforce small request-body limits before full form parsing; the creation code currently has no length bound. No oversized requests were sent.

3. **Headers and browser protection.** The table below records normal application responses, not Cloudflare's client-block pages. The Python client received Cloudflare error 1010, whose error responses included `X-Frame-Options` and `Referrer-Policy`. Curl reached the real application without those headers. That client-signature block does not establish protection against automated code guessing.

   | Header or behavior | Live observation | Suggested policy |
   | --- | --- | --- |
   | `Content-Security-Policy` | Absent | Restrict scripts and connections to required origins; use framework-generated nonces or hashes; `object-src 'none'`, `base-uri 'none'`, and `frame-ancestors 'none'`. |
   | `X-Frame-Options` | Absent | `DENY`, unless embedding is intentionally required. |
   | `X-Content-Type-Options` | Absent | `nosniff`. |
   | `Referrer-Policy` | Absent | `no-referrer` on secret-link pages. |
   | `Permissions-Policy` | Absent | Disable unused camera, microphone, and geolocation features. |
   | `Strict-Transport-Security` | Absent | Send over HTTPS. `.dev` preload already protects supported browsers. |
   | `Cache-Control` on dynamic pages/actions | Absent in sampled public responses | `no-store` for secret pages, their data responses, and sensitive action responses. |
   | Static fingerprinted JS caching | `public, immutable, max-age=31536000` | Appropriate for versioned public assets. |
   | Broad `Access-Control-Allow-Origin` | Absent | Keep cross-origin access restricted. |

   Header absence is not proof of an exploitable XSS or clickjacking attack. No raw `{@html}`, `innerHTML`, or `eval` sink was found in application source. CSP is an additional defence if an injection defect appears later. Use [SvelteKit's CSP configuration](https://svelte.dev/docs/kit/@sveltejs-kit-vite#csp) so its inline bootstrap code receives valid nonces or hashes. Account for Google Fonts or serve fonts locally. Attach headers to dynamic Worker responses: Cloudflare's [`_headers` file](https://developers.cloudflare.com/workers/static-assets/headers/) does not cover responses generated by Worker code.

4. **Secret-link exposure.** `src/lib/domain/token.ts:1` generates 128 random bits through Web Crypto, encoded as 22 base64url characters. Admin, team, and scoreboard tokens have separate database lookups, and rotation invalidates old links. This makes guessing links an impractical route into a game.

   A copied or leaked link still grants its role's access until rotation or deletion. Tokens are stored in database columns and URL paths, and therefore may appear in browser history, shared messages, and URL logging. There is no automatic expiry. Nicknames are self-selected labels rather than authenticated identities. These are accepted product tradeoffs, but private links should be treated as credentials.

   Missing referrer policy does not mean tokens are automatically sent to Google Fonts. Modern browsers default to [strict-origin-when-cross-origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy), which removes the path on cross-origin requests. An explicit `no-referrer` policy also prevents same-origin referrer disclosure. Add `Cache-Control: no-store` and `X-Robots-Tag: noindex` for `/a/*`, `/t/*`, `/s/*`, and their data responses. Valid production pages were not fetched, so their exact live caching behavior remains unverified.

5. **Transport.** HTTPS requests passed curl's certificate verification. A direct HTTP request received the application with status 200 rather than an HTTPS redirect. This matters to clients that do not enforce HSTS. The [`.dev` top-level domain is preloaded](https://www.registry.google/domains/dev/), which makes mainstream supporting browsers upgrade the connection before sending the request. This mitigation keeps the finding lower severity for the current hostname.

The following controls passed review or verification:

- Wrong-code requests returned 403 without creating a game. The creation code is held in a deployed secret binding; local env files are not tracked by Git.
- Cross-origin and missing-origin form POSTs returned 403 with the framework's CSRF rejection message. An automated caller can supply the correct Origin header, so CSRF is not a brute-force control.
- Invalid admin, team, and scoreboard links returned 404. A direct POST to an admin reset action with an invalid token also returned 404.
- Server actions independently check their tokens. Reviewed SQL binds user values and scopes changes to the token's game or team. Existing tests cover cross-game and cross-team attempts, role separation, and link rotation.
- Team and scoreboard serialization excludes privileged tokens and other teams' private claims in the reviewed source and tests. This was not verified with valid production links.
- `/dev/design`, `/.env.prod`, the probed Worker-source path, and the sampled client sourcemap path returned 404. These are specific probes, not an exhaustive content scan.
- `pnpm audit --json` reported zero known vulnerabilities for the lockfile. This does not rule out unknown defects or vulnerabilities in deployment infrastructure.
- Eleven relevant test files passed, covering 114 tests. Database tests use in-memory SQLite behind a D1-compatible test interface, not production D1.

Fix order: add creation-attempt limits and preserve a strong random code; add dynamic-response headers and private-route cache policies; then strengthen quota protection and monitoring. Browser policy changes should be verified against the team, admin, and scoreboard flows before deployment. No application fixes or deployment changes were made during this assessment.

Authenticated production-page inspection remains pending explicit approval. Automatic approval review rejected retrieving one game's private access tokens and using them for GET-only checks because those tokens grant privileged access and were not specifically authorized. No production tokens or records were retrieved.

## Remediation, 15 October 2026

Creation-code guessing is addressed by a random code and the zone's per-IP WAF rate rule. Turnstile and a Worker rate limiter were added and later removed as redundant; see `docs/decisions.md`. The header, caching, transport and body-size findings are addressed as follows:

- `src/hooks.server.ts` adds `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, HSTS and `X-Robots-Tag: noindex, nofollow` to every Worker response. `/a/*`, `/t/*` and `/s/*`, including their `__data.json` responses, also get `Cache-Control: no-store`.
- `robots.txt` disallows every path for every crawler.
- The same hook redirects plain HTTP to HTTPS with 308, except on loopback hosts used by local previews.
- Request bodies without `Content-Length` get 411, and bodies over 2 MiB get 413, before any form parsing. This bounds the creation code and every other form field.
- SvelteKit sets an enforced CSP with per-request script nonces. Scripts are limited to the app, fonts to Google Fonts, and `frame-ancestors`, `base-uri` and `object-src` are closed. `style-src` keeps `'unsafe-inline'` because Svelte and bits-ui render style attributes.
- The root `_headers` file applies the static hardening headers to assets served without the Worker.
- The rehearsal fails on any CSP violation logged in the browser.

A Trivy filesystem scan (vulnerabilities, secrets, misconfigurations) of the lockfile and source found no issues. Quota exhaustion by valid-link polling is still open; it needs edge rules on an owned domain and the query indexes described in `docs/decisions.md`.
