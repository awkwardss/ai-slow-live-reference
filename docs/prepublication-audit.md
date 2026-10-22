# Pre-publication audit

Status: **in progress; repository must remain private**

This audit separates an independently written public reference from the private product in which the behavior was first prototyped.

## 1. Provenance review

The private prototype's relevant history and implementation files were reviewed before any code was added here.

Findings:

- the prototype's slow-live feature has a continuous first-party commit history;
- the reviewed files contain no third-party copyright headers;
- the reviewed files contain no “copied from”, “adapted from”, or equivalent source attribution markers;
- commit messages and tracked source contain no references to the similar projects listed in `RELATED_WORK.md`;
- similar projects were researched for comparison after the private prototype already existed;
- no code from those projects is being copied into this repository.

Conclusion: a clean-room behavioral rewrite is appropriate. Similar capabilities do not by themselves imply shared source code or shared licensing obligations.

## 2. Clean-room transfer rule

This repository may reproduce general behavior, invariants, and public web-platform techniques. It must not copy private product code line-for-line.

Allowed:

- generic use of `getUserMedia`, canvas JPEG encoding, `watchPosition`, and HTTP;
- the latest-frame-only retention model;
- explicit location consent and immediate clearing;
- version revalidation before a delayed consumer uses a frame;
- a compact player with a live thumbnail and essential controls;
- a vendor-neutral AI adapter contract.

Excluded:

- private product names, people, domains, repository paths, project identifiers, or build labels;
- private conversation/thread schemas and delivery protocols;
- production prompts, memory instructions, and relationship-specific language;
- real coordinates, routes, images, account data, credentials, or deployment configuration;
- production bridge endpoints and operational scripts;
- private CSS, component layout, and user-facing copy.

## 3. Dependency and license review

The reference implementation intentionally uses only Node.js built-ins and browser standards. It has:

- no runtime npm dependencies;
- no vendored source, media, fonts, icons, or generated assets from third parties;
- no copied samples from related repositories;
- no AI vendor SDK.

A license will be selected only after the implementation and final secret/provenance scan pass. The repository is not ready to make public until a license file exists.

## 4. Security and privacy review gates

Before publication, all of the following must pass:

- automated tests for latest-frame replacement, stale expiry, location clearing, and stop invalidation;
- an integration test for HTTP start/update/status/stop lifecycle;
- a scan for secrets, private absolute paths, product-specific identifiers, and precise real-world coordinates;
- documentation stating that the demo server is loopback-only and not production authentication;
- documentation requiring TLS, origin checks, authentication, rate limits, and explicit retention policy in a real deployment;
- manual browser review of camera start, location opt-in/out, collapse/expand, and hard stop behavior.

## 5. Attribution boundary

The eventual license governs copying, modifying, and redistributing this repository's code. It does not claim ownership of the broad idea of sending periodic camera frames to an AI, and it does not require attribution from someone who independently implements that general idea without using this code.

That distinction follows the ordinary idea/expression boundary: the [U.S. Copyright Office's software guidance](https://www.copyright.gov/register/tx-programs.html) states that copyright protects a program's copyrightable expression, not its ideas, program logic, algorithms, systems, methods, concepts, or layouts. Laws and facts vary by jurisdiction; this audit records project intent and is not legal advice.
