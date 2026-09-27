import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { monthRange } from "./summaryLogic";

export const listByMonth = query({
  args: { year: v.number(), month: v.number() },
  handler: async (ctx, args) => {
    const { start, end } = monthRange(args.year, args.month);
    const rows = await ctx.db
      .query("completedDays")
      .withIndex("by_day", (q) => q.gte("day", start).lt("day", end))
      .take(1000);
    return rows.map((row) => row.day);
  },
});

export const setDone = mutation({
  args: { day: v.string(), done: v.boolean() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("completedDays")
      .withIndex("by_day", (q) => q.eq("day", args.day))
      .unique();
    if (args.done && !existing) await ctx.db.insert("completedDays", { day: args.day });
    if (!args.done && existing) await ctx.db.delete(existing._id);
  },
});
