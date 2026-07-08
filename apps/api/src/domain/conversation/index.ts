/**
 * Conversation domain — CRUD operations.
 * Pure logic, delegates to a store interface.
 */
import type { Conversation, Message } from "@instigpt/shared";

export interface ConversationRepository {
  list(userId: string): Promise<Conversation[]>;
  getById(id: string, userId: string): Promise<Conversation | null>;
  create(userId: string, title: string): Promise<Conversation>;
  rename(id: string, userId: string, title: string): Promise<Conversation | null>;
  remove(id: string, userId: string): Promise<boolean>;
  getMessages(conversationId: string): Promise<Message[]>;
}
