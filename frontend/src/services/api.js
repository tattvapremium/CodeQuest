const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export const checkHealth = async () =>
  fetch(`${API}/health`).then(r => r.json()).catch(() => null);

export const getUser = async (userId) =>
  fetch(`${API}/users/${userId}`).then(r => r.json());

export const getUserProgress = async (userId) =>
  fetch(`${API}/users/${userId}/progress`).then(r => r.json());

export const getProblems = async (difficulty = null) => {
  const url = difficulty ? `${API}/problems?difficulty=${difficulty}` : `${API}/problems`;
  return fetch(url).then(r => r.json());
};

export const getProblem = async (problemId) =>
  fetch(`${API}/problems/${problemId}`).then(r => r.json());

export const runCode = async (payload) =>
  fetch(`${API}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(r => r.json());

// === NEW FUNCTION ===
export const validateSolution = async (payload) =>
  fetch(`${API}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(r => r.json());
// ====================

export const submitSolution = async (payload) =>
  fetch(`${API}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(r => r.json());

export const getFeedback = async (payload) =>
  fetch(`${API}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(r => r.json());

export const getFeedbackStream = async (payload, onChunk) => {
  const response = await fetch(`${API}/feedback/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Backward-compatible fallback when backend is running older code.
  if (response.status === 404) {
    const fallback = await getFeedback(payload);
    onChunk(fallback?.feedback || "");
    return;
  }

  if (!response.ok) {
    throw new Error(`Feedback stream failed (${response.status})`);
  }

  if (!response.body) {
    throw new Error("Streaming is not supported in this browser");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      onChunk(decoder.decode(value, { stream: true }));
    }
  }

  const tail = decoder.decode();
  if (tail) {
    onChunk(tail);
  }
};

export const getLanguages = async () =>
  fetch(`${API}/languages`).then(r => r.json()).catch(() => []);

export const registerUser = async (payload) =>
  fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Registration failed");
    return data;
  });

export const loginUser = async (payload) =>
  fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Login failed");
    return data;
  });
