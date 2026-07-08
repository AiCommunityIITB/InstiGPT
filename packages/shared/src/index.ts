// ============ User & Auth ============

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  roll_number: string;
  department?: string;
  year?: number;
  program?: string; // BTech, Dual, MTech, PhD
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
}

// ============ Chat ============

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  conversation_id: string;
  sources?: Source[];
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// ============ Knowledge ============

export interface Source {
  title: string;
  content_snippet: string;
  source_type: "document" | "graph" | "web_search";
  metadata?: Record<string, unknown>;
  relevance_score: number;
}

export type EntityType =
  | "course"
  | "professor"
  | "department"
  | "hostel"
  | "club"
  | "event"
  | "facility"
  | "policy";

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  metadata: Record<string, unknown>;
}

export type RelationType =
  | "teaches"
  | "prerequisite_of"
  | "belongs_to"
  | "located_in"
  | "part_of"
  | "related_to";

export interface Relationship {
  id: string;
  source_id: string;
  target_id: string;
  relation: RelationType;
  metadata?: Record<string, unknown>;
}

export interface Chunk {
  id: string;
  content: string;
  source: string;
  metadata: Record<string, unknown>;
  similarity?: number;
}

// ============ API Types ============

export interface ChatRequest {
  question: string;
  conversation_id?: string;
}

export interface ChatStreamEvent {
  type: "token" | "sources" | "done" | "error";
  data: string;
}

export interface CreateConversationRequest {
  title: string;
}

export interface ApiError {
  error: string;
  status: number;
}

// ============ Utils ============

/**
 * Parse IIT Bombay roll number to extract student info
 * Format: YYXDDNNN (e.g., 210100045)
 * YY = admission year, X = program, DD = department, NNN = serial
 */
export function parseRollNumber(roll: string): {
  year: number;
  program: string;
  department: string;
} | null {
  if (!roll || roll.length < 9) return null;

  const yearPrefix = parseInt(roll.substring(0, 2));
  const programCode = roll.substring(2, 3);
  const deptCode = roll.substring(3, 5);

  const year = yearPrefix > 50 ? 1900 + yearPrefix : 2000 + yearPrefix;

  const programMap: Record<string, string> = {
    "1": "BTech",
    "2": "MTech",
    "3": "PhD",
    "4": "Dual Degree",
    "5": "MSc",
    "6": "MBA",
  };

  const deptMap: Record<string, string> = {
    "01": "Civil Engineering",
    "02": "Electrical Engineering",
    "03": "Mechanical Engineering",
    "04": "Aerospace Engineering",
    "05": "Chemical Engineering",
    "06": "Chemistry",
    "07": "Computer Science & Engineering",
    "08": "Earth Sciences",
    "09": "Energy Science & Engineering",
    "10": "Environmental Science & Engineering",
    "11": "Humanities & Social Sciences",
    "12": "Industrial Design Centre",
    "13": "Mathematics",
    "14": "Physics",
    "15": "Biosciences & Bioengineering",
    "16": "Metallurgical Engineering & Materials Science",
    "17": "SJM School of Management",
    "19": "Centre for Technology Alternatives for Rural Areas",
    "20": "Systems & Control Engineering",
  };

  return {
    year,
    program: programMap[programCode] || "Unknown",
    department: deptMap[deptCode] || "Unknown",
  };
}
