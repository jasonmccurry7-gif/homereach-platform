// ─────────────────────────────────────────────────────────────────────────────
// qa_reply_votes — upvote ledger for replies or answers
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable, uuid, smallint, timestamp, index, check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const qaReplyVotes = pgTable(
  "qa_reply_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    replyId: uuid("reply_id"),
    answerId: uuid("answer_id"),
    voterAgentId: uuid("voter_agent_id").notNull(),
    vote: smallint("vote").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    exactlyOne: check(
      "qa_reply_votes_exactly_one_target",
      sql`(${t.replyId} is null) <> (${t.answerId} is null)`,
    ),
    voterIdx: index("qa_reply_votes_voter_idx").on(t.voterAgentId),
  }),
);

export type QaReplyVote = typeof qaReplyVotes.$inferSelect;
export type NewQaReplyVote = typeof qaReplyVotes.$inferInsert;
