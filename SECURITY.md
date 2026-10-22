# Security policy

## Supported status

This repository is an educational reference and is not an internet-facing service. The included server intentionally binds to loopback and has no account system.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository when available. Do not include real camera frames, coordinates, credentials, or personal data in a public issue.

## Before production use

Treat the code as an architectural starting point. Add authentication and per-session authorization, TLS, CSRF/origin controls, rate limits, production-grade image decoding and validation, body-safe logging, abuse controls, provider retention settings, and a tested deletion path before exposing any endpoint to a network.
