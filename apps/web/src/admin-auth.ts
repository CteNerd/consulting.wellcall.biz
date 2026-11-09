const pendingAuthKey = "rct-consulting-pkce";

export type AdminAuthConfiguration = {
  authUrl: URL;
  apiUrl: URL;
  clientId: string;
  userPoolId: string;
  callbackUrl: URL;
  issuer: string;
};

type AdminEnvironment = {
  VITE_ADMIN_AUTH_URL?: string;
  VITE_ADMIN_API_URL?: string;
  VITE_ADMIN_CLIENT_ID?: string;
  VITE_ADMIN_USER_POOL_ID?: string;
};

type PendingAuth = { verifier: string; state: string; nonce: string };

export function readAdminAuthConfiguration(
  env: AdminEnvironment = import.meta.env,
  origin = window.location.origin,
): AdminAuthConfiguration | undefined {
  const authUrl = httpsServiceRoot(env.VITE_ADMIN_AUTH_URL);
  const apiUrl = httpsServiceRoot(env.VITE_ADMIN_API_URL);
  const userPoolId = env.VITE_ADMIN_USER_POOL_ID?.trim() ?? "";
  const clientId = env.VITE_ADMIN_CLIENT_ID?.trim() ?? "";
  const poolParts = /^([a-z]{2}(?:-[a-z]+)+-\d+)_([A-Za-z0-9]+)$/.exec(userPoolId);
  if (!authUrl || !apiUrl || !poolParts || !/^[A-Za-z0-9]+$/.test(clientId)) return undefined;
  const callbackUrl = httpsServiceRoot(origin);
  if (!callbackUrl) return undefined;
  callbackUrl.pathname = "/";
  callbackUrl.search = "";
  const region = poolParts[1];
  return {
    authUrl,
    apiUrl,
    clientId,
    userPoolId,
    callbackUrl,
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  };
}

export function createAdminAuth(
  configuration: AdminAuthConfiguration,
  {
    cryptoApi = globalThis.crypto,
    storage = globalThis.sessionStorage,
    fetchImpl = globalThis.fetch,
    location = globalThis.location,
    history = globalThis.history,
    now = Date.now,
  }: {
    cryptoApi?: Crypto;
    storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
    fetchImpl?: typeof fetch;
    location?: Pick<Location, "assign">;
    history?: Pick<History, "replaceState">;
    now?: () => number;
  } = {},
) {
  let accessToken: string | undefined;

  async function beginSignIn(): Promise<void> {
    if (!cryptoApi.subtle) throw new Error("Sign-in requires a secure browser context.");
    const verifier = randomValue(cryptoApi);
    const state = randomValue(cryptoApi);
    const nonce = randomValue(cryptoApi);
    const challenge = await challengeFor(cryptoApi, verifier);
    storage.setItem(pendingAuthKey, JSON.stringify({ verifier, state, nonce }));

    const authorization = new URL("/oauth2/authorize", configuration.authUrl);
    authorization.search = new URLSearchParams({
      client_id: configuration.clientId,
      response_type: "code",
      scope: "openid email",
      redirect_uri: configuration.callbackUrl.href,
      code_challenge_method: "S256",
      code_challenge: challenge,
      state,
      nonce,
    }).toString();
    location.assign(authorization.href);
  }

  async function completeSignIn(currentUrl: string): Promise<string | undefined> {
    const current = new URL(currentUrl);
    if (!["code", "state", "error"].some((key) => current.searchParams.has(key))) return undefined;
    if (current.origin !== configuration.callbackUrl.origin
      || current.pathname !== configuration.callbackUrl.pathname) {
      return undefined;
    }

    const pendingText = storage.getItem(pendingAuthKey);
    storage.removeItem(pendingAuthKey);
    history.replaceState(null, "", `${configuration.callbackUrl.pathname}?admin`);
    if (current.searchParams.has("error")
      || current.searchParams.getAll("code").length !== 1
      || current.searchParams.getAll("state").length !== 1
      || !pendingText) {
      throw new Error("Sign-in was not completed.");
    }

    const pending = parsePendingAuth(pendingText);
    const code = current.searchParams.get("code");
    if (current.searchParams.get("state") !== pending.state || !code) {
      throw new Error("Sign-in could not be verified.");
    }
    if (current.searchParams.getAll("iss").length > 1
      || (current.searchParams.has("iss") && current.searchParams.get("iss") !== configuration.issuer)) {
      throw new Error("Sign-in could not be verified.");
    }

    let response: Response;
    try {
      response = await fetchImpl(new URL("/oauth2/token", configuration.authUrl), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        cache: "no-store",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: configuration.clientId,
          code,
          redirect_uri: configuration.callbackUrl.href,
          code_verifier: pending.verifier,
        }),
      });
    } catch {
      throw new Error("Sign-in could not be completed.");
    }
    if (!response.ok) throw new Error("Sign-in could not be completed.");

    let tokens: Record<string, unknown>;
    try {
      const body: unknown = await response.json();
      if (!isRecord(body)) throw new Error();
      tokens = body;
    } catch {
      throw new Error("Sign-in could not be verified.");
    }
    if (tokens.token_type !== "Bearer" || typeof tokens.access_token !== "string"
      || typeof tokens.id_token !== "string") {
      throw new Error("Sign-in could not be verified.");
    }

    const accessClaims = decodeClaims(tokens.access_token);
    const idClaims = decodeClaims(tokens.id_token);
    if (accessClaims.iss !== configuration.issuer
      || accessClaims.token_use !== "access"
      || accessClaims.client_id !== configuration.clientId
      || !validExpiry(accessClaims.exp, now)
      || idClaims.iss !== configuration.issuer
      || idClaims.aud !== configuration.clientId
      || idClaims.nonce !== pending.nonce
      || idClaims.sub !== accessClaims.sub
      || !validExpiry(idClaims.exp, now)) {
      throw new Error("Sign-in could not be verified.");
    }

    accessToken = tokens.access_token;
    return accessToken;
  }

  function signOut(): void {
    clearSession();
    const logout = new URL("/logout", configuration.authUrl);
    logout.search = new URLSearchParams({
      client_id: configuration.clientId,
      logout_uri: new URL("/", configuration.callbackUrl).href,
    }).toString();
    location.assign(logout.href);
  }

  function clearSession(): void {
    accessToken = undefined;
    storage.removeItem(pendingAuthKey);
  }

  return Object.freeze({
    beginSignIn,
    completeSignIn,
    getAccessToken: () => accessToken,
    clearSession,
    signOut,
  });
}

function httpsServiceRoot(value: string | undefined): URL | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password
      || url.pathname !== "/" || url.search || url.hash) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function randomValue(cryptoApi: Crypto): string {
  return base64Url(cryptoApi.getRandomValues(new Uint8Array(32)));
}

async function challengeFor(cryptoApi: Crypto, verifier: string): Promise<string> {
  const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function parsePendingAuth(value: string): PendingAuth {
  let pending: unknown;
  try {
    pending = JSON.parse(value);
  } catch {
    throw new Error("Sign-in could not be verified.");
  }
  if (!isRecord(pending)
    || typeof pending.verifier !== "string"
    || typeof pending.state !== "string"
    || typeof pending.nonce !== "string") {
    throw new Error("Sign-in could not be verified.");
  }
  return { verifier: pending.verifier, state: pending.state, nonce: pending.nonce };
}

function decodeClaims(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    if (!payload) throw new Error();
    const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(claims)) throw new Error();
    return claims;
  } catch {
    throw new Error("Sign-in could not be verified.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validExpiry(exp: unknown, now: () => number): boolean {
  return typeof exp === "number" && Number.isSafeInteger(exp) && exp * 1000 > now();
}
