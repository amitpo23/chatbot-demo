import * as pg from 'pg';
import { Sequelize } from 'sequelize-cockroachdb';

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, { logging: false, dialectModule: pg })
  : null;

type ConversationLogEntry = {
  entry: string,
  created_at: Date,
  speaker: string,
}

class ConversationLog {
  constructor(
    public userId: string,
  ) {
    this.userId = userId
  }

  public async addEntry({ entry, speaker }: { entry: string, speaker: string }) {
    if (!sequelize) return;
    try {
      await sequelize.query(`INSERT INTO conversations (user_id, entry, speaker) VALUES (?, ?, ?) ON CONFLICT (created_at) DO NOTHING`, {
        replacements: [this.userId, entry, speaker],
      });
    } catch (e) {
      console.log(`Error adding entry: ${e}`)
    }
  }

  public async getConversation({ limit }: { limit: number }): Promise<string[]> {
    if (!sequelize) return [];
    try {
      const conversation = await sequelize.query(`SELECT entry, speaker, created_at FROM conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`, {
        replacements: [this.userId, limit],
      });
      const history = conversation[0] as ConversationLogEntry[]

      return history.map((entry) => {
        return `${entry.speaker.toUpperCase()}: ${entry.entry}`
      }).reverse()
    } catch (e) {
      console.log(`Error getting conversation: ${e}`)
      return []
    }
  }

  public async clearConversation() {
    if (!sequelize) return;
    try {
      await sequelize.query(`DELETE FROM conversations WHERE user_id = ?`, {
        replacements: [this.userId],
      });
    } catch (e) {
      console.log(`Error clearing conversation: ${e}`)
    }
  }
}

export { ConversationLog }