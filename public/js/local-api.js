// Standalone mode: no Node server. The app answers its own /api/* calls with the same catalogue code the
// server uses, calling TMDB, AniList and Jikan straight from the device. The TMDB read token is pasted in
// Settings and kept only in this browser's storage (it is never part of a library backup).
import { createCatalog } from "./catalog.js";
import { handleApi } from "./api-core.js";

export const TOKEN_KEY = "movie-world.tmdb-token";

export function createLocalApi(storage = globalThis.localStorage, fetcher = (...a) => fetch(...a)) {
  const read = () => {
    try {
      return (storage.getItem(TOKEN_KEY) || "").trim();
    } catch {
      return "";
    }
  };
  let token = read(),
    catalog = createCatalog({ token, fetcher });
  return {
    standalone: true,
    getToken: () => token,
    setToken(value) {
      token = String(value || "").trim();
      try {
        token ? storage.setItem(TOKEN_KEY, token) : storage.removeItem(TOKEN_KEY);
      } catch {
        throw new Error("Browser storage is unavailable, so the token cannot be saved.");
      }
      // A new catalogue also drops cached answers that were fetched with the old token.
      catalog = createCatalog({ token, fetcher });
    },
    // Answers an /api/... path (with its query string) exactly like the server would.
    async request(path) {
      return handleApi(new URL(path, "http://app.local"), catalog);
    },
    // Asks TMDB whether a token works, without saving it.
    async testToken(candidate) {
      const value = String(candidate || "").trim();
      if (!value) return { ok: false, message: "Paste your TMDB API Read Access Token first." };
      try {
        const response = await fetcher("https://api.themoviedb.org/3/authentication", {
          headers: { accept: "application/json", Authorization: `Bearer ${value}` },
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) return { ok: true, message: "TMDB accepted the token." };
        return {
          ok: false,
          message:
            response.status === 401
              ? "TMDB rejected this token. Use the long API Read Access Token, not the short API key."
              : `TMDB answered with an error (${response.status}). Try again in a moment.`,
        };
      } catch {
        return { ok: false, message: "Could not reach TMDB. Check your connection." };
      }
    },
  };
}
