/**
 * Supabase database adapter.
 * Implements all repository interfaces from the domain layer.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "../../config";
import type { UserContext } from "../../types";
import type { UserRepository, SessionRepository } from "../../domain/user";
import type { ConversationRepository } from "../../domain/conversation";
import type { MessageStore, ConversationStore } from "../../domain/chat";
import type { Conversation, Message } from "@instigpt/shared";

export function createSupabase(config: Config): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ─── User Repository ───

export function createUserRepo(sb: SupabaseClient): UserRepository {
  return {
    async upsert(user) {
      const { data, error } = await sb
        .from("users")
        .upsert(user, { onConflict: "id" })
        .select()
        .single();
      if (error) throw new Error(`User upsert failed: ${error.message}`);
      return data;
    },

    async getById(id) {
      const { data } = await sb.from("users").select("*").eq("id", id).single();
      return data;
    },
  };
}

// ─── Session Repository ───

export function createSessionRepo(sb: SupabaseClient): SessionRepository {
  return {
    async create(userId, expiresAt) {
      const { data, error } = await sb
        .from("sessions")
        .insert({ user_id: userId, expires_at: expiresAt.toISOString() })
        .select("id")
        .single();
      if (error) throw new Error(`Session creation failed: ${error.message}`);
      return data;
    },

    async validate(sessionId) {
      const { data } = await sb
        .from("sessions")
        .select("*, users(*)")
        .eq("id", sessionId)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (!data?.users) return null;
      return data.users as unknown as UserContext;
    },

    async destroy(sessionId) {
      await sb.from("sessions").delete().eq("id", sessionId);
    },
  };
}

// ─── Conversation Repository ───

export function createConversationRepo(sb: SupabaseClient): ConversationRepository {
  return {
    async list(userId) {
      const { data } = await sb
        .from("conversations")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      return data || [];
    },

    async getById(id, userId) {
      const { data } = await sb
        .from("conversations")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      return data;
    },

    async create(userId, title) {
      const { data, error } = await sb
        .from("conversations")
        .insert({ title, user_id: userId })
        .select()
        .single();
      if (error) throw new Error(`Conversation creation failed: ${error.message}`);
      return data;
    },

    async rename(id, userId, title) {
      const { data } = await sb
        .from("conversations")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      return data;
    },

    async remove(id, userId) {
      await sb.from("messages").delete().eq("conversation_id", id);
      const { error } = await sb
        .from("conversations")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      return !error;
    },

    async getMessages(conversationId) {
      const { data } = await sb
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      return data || [];
    },
  };
}

// ─── Message Store (for chat domain) ───

export function createMessageStore(sb: SupabaseClient): MessageStore {
  return {
    async getHistory(conversationId, limit = 20) {
      const { data } = await sb
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(limit);
      return data || [];
    },

    async saveMessage(msg) {
      const { data, error } = await sb
        .from("messages")
        .insert(msg)
        .select()
        .single();
      if (error) throw new Error(`Message save failed: ${error.message}`);
      return data;
    },
  };
}

// ─── Conversation Store (for chat domain) ───

export function createConversationStore(sb: SupabaseClient): ConversationStore {
  return {
    async create(userId, title) {
      const { data, error } = await sb
        .from("conversations")
        .insert({ title, user_id: userId })
        .select("id")
        .single();
      if (error) throw new Error(`Conversation creation failed: ${error.message}`);
      return data;
    },

    async updateTimestamp(id) {
      await sb
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
    },
  };
}
