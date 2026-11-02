// Owner: Bùi Quang Nhân – Register / Sign In / Customize Interface Mode
import { eq } from "drizzle-orm";
import type { ThemePreference } from "@hub/shared";
import { users, type User } from "../db/schema";
import { db, type DbOrTx } from "../lib/db";

/** Repository CHỈ truy cập dữ liệu, không chứa nghiệp vụ. */
export const userRepository = {
  findByEmail(email: string, conn: DbOrTx = db): User | undefined {
    return conn.select().from(users).where(eq(users.email, email)).get();
  },

  findById(id: string, conn: DbOrTx = db): User | undefined {
    return conn.select().from(users).where(eq(users.id, id)).get();
  },

  create(data: typeof users.$inferInsert, conn: DbOrTx = db): User {
    return conn.insert(users).values(data).returning().get();
  },

  updateTheme(id: string, themePreference: ThemePreference, conn: DbOrTx = db): User | undefined {
    return conn.update(users).set({ themePreference }).where(eq(users.id, id)).returning().get();
  },
};
