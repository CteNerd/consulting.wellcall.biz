import { expect, test } from "vitest";
import { createAdminAuth, readAdminAuthConfiguration } from "./admin-auth.ts";

const environment = {
  VITE_ADMIN_AUTH_URL: "https://consulting.auth.us-east-1.amazoncognito.com",
  VITE_ADMIN_API_URL: "https://api.consulting.example",
  VITE_ADMIN_CLIENT_ID: "publicclient123",
  VITE_ADMIN_USER_POOL_ID: "us-east-1_Abc123",
};

test("admin authentication requires complete HTTPS configuration and uses the site root callback", () => {
  const configuration = readAdminAuthConfiguration(environment, "https://consulting.example");
  expect(configuration?.callbackUrl.href).toBe("https://consulting.example/");
  expect(configuration?.issuer).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Abc123");
  expect(readAdminAuthConfiguration({ ...environment, VITE_ADMIN_API_URL: "http://api.example" }, "https://consulting.example"))
    .toBeUndefined();
  expect(readAdminAuthConfiguration({ ...environment, VITE_ADMIN_CLIENT_ID: "" }, "https://consulting.example"))
    .toBeUndefined();
});

test("OAuth callback rejects a mismatched state and clears the pending verifier", async () => {
  const values = new Map<string, string>();
  const storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  let callbackCleared = false;
  const history: Pick<History, "replaceState"> = {
    replaceState: () => { callbackCleared = true; },
  };
  const configuration = readAdminAuthConfiguration(environment, "https://consulting.example")!;
  const auth = createAdminAuth(configuration, { storage, history });
  values.set("rct-consulting-pkce", JSON.stringify({ verifier: "verifier", state: "expected", nonce: "nonce" }));

  await expect(auth.completeSignIn("https://consulting.example/?code=one-time-code&state=wrong"))
    .rejects.toThrow("Sign-in could not be verified.");
  expect(values.has("rct-consulting-pkce")).toBe(false);
  expect(callbackCleared).toBe(true);
});
