/**
 * Simple JWT-based authentication utilities
 * Pas de sécurité max - juste fonctionnel pour séparer les watchlists
 */

import { MUST_BE_AUTHENTICATED } from "../constants";

const JWT_SECRET =
  process.env.JWT_SECRET || "screener-secret-key-change-in-prod";

export interface JWTPayload {
  userId: string;
  email: string;
}

/**
 * Encode un payload en JWT (sans librairie externe)
 */
export function createToken(payload: JWTPayload): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const signature = btoa(JWT_SECRET + header + body); // Simple hash
  return `${header}.${body}.${signature}`;
}

/**
 * Décode et vérifie un JWT
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const [header, body, signature] = token.split(".");
    const expectedSig = btoa(JWT_SECRET + header + body);

    if (signature !== expectedSig) {
      return null; // Signature invalide
    }

    const payload = JSON.parse(atob(body));
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Extrait le token du header Authorization
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.substring(7);
}

/**
 * Middleware-like : vérifie l'authentification
 */
export function requireAuth(request: Request): JWTPayload {
  // Si l'authentification n'est pas requise, retourner un utilisateur générique
  if (!MUST_BE_AUTHENTICATED) {
    return {
      userId: "anonymous",
      email: "anonymous@localhost",
    };
  }

  const token = extractToken(request);
  if (!token) {
    throw new Error("Authentication required");
  }

  const payload = verifyToken(token);
  if (!payload) {
    throw new Error("Invalid token");
  }

  return payload;
}

/**
 * Hash simple du mot de passe (utilise crypto.subtle si disponible, sinon fallback)
 */
export async function hashPassword(password: string): Promise<string> {
  // Simple hash pour demo - en prod utiliser bcrypt
  const encoder = new TextEncoder();
  const data = encoder.encode(password + JWT_SECRET);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback basique (pas sécurisé mais fonctionnel)
  return btoa(password + JWT_SECRET);
}

/**
 * Vérifie un mot de passe
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}
