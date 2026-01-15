// types.ts
export interface Player {
  userId: number;
  username?: string;
  firstName?: string;
  joinedAt: string;
  eliminated?: boolean;
}

export interface VotingSession {
  active: boolean;
  pollId?: string;
  voteCounts: Map<number, number>;
  votes?: Map<number, number>; // voter userId -> target userId
}

export interface GameSession {
  chatId: number;
  adminId?: number;
  promotedAdmins: number[];
  players: Player[];
  imposters: number[];
  topic: string;
  started: boolean;
  rolesDistributed: boolean;
  votingSession?: VotingSession;
  customGroupLink?: string;
  botMessageIds: number[];
  createdAt: string;
  updatedAt: string;
  settings: {
    minPlayers: number;
    totalPlayers: number;
    totalImposters: number;
    voteTimeSeconds: number;
    onlineMode: boolean;
  };
}

export interface GameConfig {
  port: number;
  botToken: string;
  ollamaUrl: string;
  adminSecret: string;
  storageDir: string;
}
