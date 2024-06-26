export type User = {
  _id: number;
  username: string;
  name: string;
};

export type Conversation = {
  _id: string;
  title: string;
  owner_id: number;
  created_at: string;
};

export type Message = {
  id: string;
  role: string;
  content: string;
  conversation_id: string;
  created_at: string;
};
