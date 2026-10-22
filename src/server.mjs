import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createLiveSessionStore, DEFAULT_MAX_FRAME_BYTES } from "./live-session-store.mjs";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const defaultPublicDirectory = join(moduleDirectory, "..", "public");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function replyJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

async function readBody(request, maximumBytes) {
  const parts = [];
  let total = 0;
  for await (const part of request) {
    total += part.length;
    if (total > maximumBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    parts.push(part);
  }
  return Buffer.concat(parts);
}

async function readJson(request, maximumBytes = 16 * 1024) {
  const body = await readBody(request, maximumBytes);
  if (body.length === 0) return {};
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function optionalNumberHeader(request, name) {
  const value = request.headers[name];
  if (value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function locationFromHeaders(request) {
  if (request.headers["x-slow-live-location-shared"] !== "1") return null;
  return {
    latitude: optionalNumberHeader(request, "x-slow-live-latitude"),
    longitude: optionalNumberHeader(request, "x-slow-live-longitude"),
    accuracy: optionalNumberHeader(request, "x-slow-live-accuracy"),
    capturedAt: optionalNumberHeader(request, "x-slow-live-captured-at"),
    speed: optionalNumberHeader(request, "x-slow-live-speed"),
    heading: optionalNumberHeader(request, "x-slow-live-heading"),
  };
}

function sessionRoute(pathname) {
  const match = pathname.match(/^\/api\/live-sessions\/([A-Za-z0-9_-]+)(?:\/(frame))?$/u);
  return match ? { sessionId: match[1], child: match[2] ?? null } : null;
}

async function serveStatic(request, response, pathname, publicDirectory) {
  const requestedRelative = pathname === "/" ? "index.html" : pathname.slice(1);
  const safeRelative = normalize(requestedRelative).replace(/^(\.\.(?:[/\\]|$))+/u, "");
  const filePath = resolve(publicDirectory, safeRelative);
  const pathWithinRoot = relative(publicDirectory, filePath);
  if (pathWithinRoot.startsWith("..") || isAbsolute(pathWithinRoot)) {
    replyJson(response, 404, { error: "Not found." });
    return;
  }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' blob:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
      "Permissions-Policy": "camera=(self), geolocation=(self), microphone=()",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EISDIR") {
      replyJson(response, 404, { error: "Not found." });
      return;
    }
    throw error;
  }
}

export function createReferenceServer({
  store = createLiveSessionStore(),
  publicDirectory = defaultPublicDirectory,
} = {}) {
  const absolutePublicDirectory = normalize(publicDirectory);

  const server = createServer(async (request, response) => {
    response.setHeader("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const route = sessionRoute(url.pathname);

      if (request.method === "POST" && url.pathname === "/api/live-sessions") {
        const sessionId = randomUUID().replaceAll("-", "");
        replyJson(response, 201, { sessionId, ...store.start(sessionId) });
        return;
      }

      if (route && request.method === "GET" && route.child === null) {
        replyJson(response, 200, store.status(route.sessionId));
        return;
      }

      if (route && request.method === "PUT" && route.child === "frame") {
        if (request.headers["content-type"]?.split(";", 1)[0] !== "image/jpeg") {
          replyJson(response, 415, { error: "Frame content type must be image/jpeg." });
          return;
        }
        const bytes = await readBody(request, DEFAULT_MAX_FRAME_BYTES);
        const location = locationFromHeaders(request);
        const state = store.updateFrame(route.sessionId, bytes, { location });
        replyJson(response, 200, state);
        return;
      }

      if (route && request.method === "GET" && route.child === "frame") {
        const frame = store.latestFrame(route.sessionId);
        if (!frame) {
          replyJson(response, 404, { error: "No current frame." });
          return;
        }
        response.writeHead(200, {
          "Content-Type": frame.contentType,
          "Cache-Control": "no-store",
          ETag: `"${frame.version}"`,
          "X-Content-Type-Options": "nosniff",
        });
        response.end(frame.bytes);
        return;
      }

      if (route && request.method === "PATCH" && route.child === null) {
        const body = await readJson(request);
        if (body.clearLocation !== true) {
          replyJson(response, 400, { error: "Only clearLocation=true is supported." });
          return;
        }
        replyJson(response, 200, store.clearLocation(route.sessionId));
        return;
      }

      if (route && request.method === "DELETE" && route.child === null) {
        replyJson(response, 200, store.stop(route.sessionId));
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        replyJson(response, 404, { error: "Unknown API route." });
        return;
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        replyJson(response, 405, { error: "Method not allowed." });
        return;
      }
      await serveStatic(request, response, url.pathname, absolutePublicDirectory);
    } catch (error) {
      const statusCode = Number(error?.statusCode) || (error instanceof TypeError ? 400 : 500);
      replyJson(response, statusCode, {
        error: statusCode === 500 ? "Internal server error." : error.message,
      });
    }
  });

  server.on("close", () => store.stopAll());
  return server;
}

export async function startReferenceServer({
  host = process.env.SLOW_LIVE_HOST || "127.0.0.1",
  port = Number(process.env.SLOW_LIVE_PORT || 8787),
} = {}) {
  if (host !== "127.0.0.1" && host !== "::1" && process.env.ALLOW_NETWORK_DEMO !== "1") {
    throw new Error("Refusing a non-loopback bind. Set ALLOW_NETWORK_DEMO=1 only after adding production security controls.");
  }
  const server = createReferenceServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const displayHost = host === "::1" ? "[::1]" : host;
  process.stdout.write(`AI Slow Live reference running at http://${displayHost}:${address.port}\n`);
  return server;
}

const launchedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (launchedDirectly) {
  await startReferenceServer();
}
