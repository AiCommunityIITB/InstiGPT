/**
 * User domain types and logic.
 */
import type { UserContext } from "../../types";

export interface UserRepository {
  upsert(user: UserContext): Promise<UserContext>;
  getById(id: string): Promise<UserContext | null>;
}

export interface SessionRepository {
  create(userId: string, expiresAt: Date): Promise<{ id: string }>;
  validate(sessionId: string): Promise<UserContext | null>;
  destroy(sessionId: string): Promise<void>;
}
