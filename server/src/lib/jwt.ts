import jwt, { type SignOptions } from "jsonwebtoken";
import { Role, enumValues } from "@hub/shared";
import { z } from "zod";
import { env } from "../config/env";

const payloadSchema = z.object({
  sub: z.string(),
  role: z.enum(enumValues(Role)),
});
export type TokenPayload = z.infer<typeof payloadSchema>;

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"] });
}

/** Trả payload nếu token hợp lệ, ngược lại trả null. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return payloadSchema.parse(jwt.verify(token, env.jwtSecret));
  } catch {
    return null;
  }
}
