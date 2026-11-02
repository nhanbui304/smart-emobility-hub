// Owner: Bùi Quang Nhân – Register / Sign In / Customize Interface Mode
import { eq } from "drizzle-orm";
import type { ThemePreference } from "../constants";
import { users, type User } from "../db/schema";
import { db } from "../lib/db";

/** Repository CHỈ truy cập dữ liệu, không chứa nghiệp vụ. */
export const userRepository = {
  findByEmail(email: string): User | undefined {
    return db.select().from(users).where(eq(users.email, email)).get();
  },

  findById(id: string): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  },

  create(data: typeof users.$inferInsert): User {
    return db.insert(users).values(data).returning().get();
  },

  updateTheme(id: string, themePreference: ThemePreference): User | undefined {
    return db.update(users).set({ themePreference }).where(eq(users.id, id)).returning().get();
  },
};
