import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // One row per day+repo+branch; day is the Bangkok "YYYY-MM-DD" the UI groups by.
  summaries: defineTable({
    day: v.string(),
    repo: v.string(),
    branch: v.string(),
    summary: v.string(),
  }).index("by_day_and_repo_and_branch", ["day", "repo", "branch"]),
  // One row per completed day; presence of the row means "done".
  completedDays: defineTable({
    day: v.string(),
  }).index("by_day", ["day"]),
});
