const CAPTURE_INTERVAL_MS = 4_000;
const UPLOAD_TIMEOUT_MS = 10_000;
const MAXIMUM_CAPTURE_WIDTH = 640;

const elements = {
  start: document.querySelector("#start"),
  player: document.querySelector("#player"),
  preview: document.querySelector("#preview"),
  state: document.querySelector("#state"),
  details: document.querySelector("#details"),
  log: document.querySelector("#log"),
  collapse: document.querySelector("#collapse"),
  location: document.querySelector("#location"),
  stop: document.querySelector("#stop"),
};

let sessionId = null;
let stream = null;
let captureTimer = null;
let uploadController = null;
let captureBusy = false;
let locationWatchId = null;
let latestLocation = null;
let generation = 0;

function showState(title, details = "") {
  elements.state.textContent = title;
  elements.details.textContent = details;
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function stopLocation({ notifyServer = true } = {}) {
  if (locationWatchId !== null) navigator.geolocation?.clearWatch(locationWatchId);
  locationWatchId = null;
  latestLocation = null;
  elements.location.setAttribute("aria-pressed", "false");
  elements.location.textContent = "Share location";
  if (notifyServer && sessionId) {
    void jsonRequest(`/api/live-sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearLocation: true }),
    }).catch(() => {});
  }
}

function startLocation() {
  if (!navigator.geolocation) {
    showState("Camera live", "Geolocation is unavailable in this browser");
    return;
  }
  elements.location.disabled = true;
  elements.location.textContent = "Locating…";
  locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      latestLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: position.timestamp || Date.now(),
        speed: position.coords.speed,
        heading: position.coords.heading,
      };
      elements.location.disabled = false;
      elements.location.setAttribute("aria-pressed", "true");
      elements.location.textContent = `Location ±${Math.max(1, Math.round(position.coords.accuracy))}m`;
    },
    (error) => {
      elements.location.disabled = false;
      if (error.code === GeolocationPositionError.PERMISSION_DENIED) stopLocation();
      showState("Camera live", error.message || "Waiting for a location update");
    },
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
  );
}

function locationHeaders() {
  if (!latestLocation) return { "X-Slow-Live-Location-Shared": "0" };
  const headers = {
    "X-Slow-Live-Location-Shared": "1",
    "X-Slow-Live-Latitude": String(latestLocation.latitude),
    "X-Slow-Live-Longitude": String(latestLocation.longitude),
    "X-Slow-Live-Accuracy": String(latestLocation.accuracy),
    "X-Slow-Live-Captured-At": String(latestLocation.capturedAt),
  };
  if (latestLocation.speed !== null) headers["X-Slow-Live-Speed"] = String(latestLocation.speed);
  if (latestLocation.heading !== null) headers["X-Slow-Live-Heading"] = String(latestLocation.heading);
  return headers;
}

async function createFrame() {
  const video = elements.preview;
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  const scale = Math.min(1, MAXIMUM_CAPTURE_WIDTH / Math.max(1, video.videoWidth));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas capture is unavailable.");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("JPEG encoding failed.")),
      "image/jpeg",
      0.58,
    );
  });
}

async function captureAndUpload(runGeneration) {
  if (!sessionId || runGeneration !== generation || captureBusy) return;
  captureBusy = true;
  const controller = new AbortController();
  uploadController = controller;
  const timeout = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const blob = await createFrame();
    if (!blob || runGeneration !== generation || !sessionId) return;
    const response = await fetch(`/api/live-sessions/${encodeURIComponent(sessionId)}/frame`, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg", ...locationHeaders() },
      body: blob,
      cache: "no-store",
      signal: controller.signal,
    });
    const state = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(state.error || "Frame upload failed.");
    if (runGeneration !== generation) return;
    const time = new Date(state.updatedAt).toLocaleTimeString();
    showState("Slow live is on", `${state.frameCount} frame${state.frameCount === 1 ? "" : "s"} · latest ${time}`);
    elements.log.textContent = `Replaced server frame with version ${state.version}. Location ${state.locationShared ? "attached" : "not shared"}.`;
  } catch (error) {
    if (error.name !== "AbortError") showState("Camera stays live", error.message);
  } finally {
    window.clearTimeout(timeout);
    if (uploadController === controller) uploadController = null;
    captureBusy = false;
  }
}

function scheduleCapture(runGeneration) {
  if (runGeneration !== generation || !sessionId) return;
  captureTimer = window.setTimeout(() => {
    scheduleCapture(runGeneration);
    void captureAndUpload(runGeneration);
  }, CAPTURE_INTERVAL_MS);
}

async function start() {
  elements.start.disabled = true;
  showState("Requesting camera…", "Nothing is sent before permission is granted");
  let nextStream = null;
  let openedSessionId = null;
  try {
    nextStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 960 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
      audio: false,
    });
    const state = await jsonRequest("/api/live-sessions", { method: "POST" });
    openedSessionId = state.sessionId;
    generation += 1;
    stream = nextStream;
    sessionId = state.sessionId;
    elements.preview.srcObject = stream;
    await elements.preview.play();
    elements.player.hidden = false;
    elements.start.hidden = true;
    showState("Slow live is on", "Preparing the first periodic frame");
    await captureAndUpload(generation);
    scheduleCapture(generation);
  } catch (error) {
    nextStream?.getTracks().forEach((track) => track.stop());
    if (openedSessionId) {
      await jsonRequest(`/api/live-sessions/${encodeURIComponent(openedSessionId)}`, { method: "DELETE" }).catch(() => {});
    }
    elements.preview.srcObject = null;
    stream = null;
    sessionId = null;
    elements.start.disabled = false;
    elements.start.hidden = false;
    showState("Could not start", error.message);
  }
}

async function stop() {
  const stoppedSessionId = sessionId;
  generation += 1;
  sessionId = null;
  window.clearTimeout(captureTimer);
  captureTimer = null;
  uploadController?.abort();
  uploadController = null;
  captureBusy = false;
  stopLocation({ notifyServer: false });
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  elements.preview.srcObject = null;
  elements.player.hidden = true;
  elements.player.classList.remove("collapsed");
  elements.start.hidden = false;
  elements.start.disabled = false;
  if (stoppedSessionId) {
    await jsonRequest(`/api/live-sessions/${encodeURIComponent(stoppedSessionId)}`, { method: "DELETE" }).catch(() => {});
  }
  showState("Stopped", "The session and its latest frame were erased");
}

elements.start.addEventListener("click", () => void start());
elements.stop.addEventListener("click", () => void stop());
elements.location.addEventListener("click", () => {
  if (locationWatchId === null) startLocation();
  else stopLocation();
});
elements.collapse.addEventListener("click", () => {
  const collapsed = elements.player.classList.toggle("collapsed");
  elements.collapse.textContent = collapsed ? "⌄" : "⌃";
  elements.collapse.setAttribute("aria-expanded", String(!collapsed));
  elements.collapse.setAttribute("aria-label", collapsed ? "Expand player" : "Collapse player");
});
window.addEventListener("pagehide", () => {
  if (sessionId) {
    void fetch(`/api/live-sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      cache: "no-store",
      keepalive: true,
    });
  }
  stream?.getTracks().forEach((track) => track.stop());
});
