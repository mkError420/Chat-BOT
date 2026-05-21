export interface Message {
  id: string;
  sender: 'visitor' | 'system' | 'ai' | 'agent';
  senderName: string;
  text: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  department: string;
  status: 'active' | 'resolved';
  takeover: boolean; // True if support agent took over (disables AI)
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeConfig {
  hospitalName: string;
  aboutText: string;
  admissionInfo: string;
  opdSchedules: string;
  commonFaqs: string;
  aiWelcomeMessage: string;
  customPromptOverlay: string; // Additional admin guidance for prompt
}

export interface UserCredentials {
  email: string;
  role: 'visitor' | 'agent' | 'admin';
  name: string;
}
