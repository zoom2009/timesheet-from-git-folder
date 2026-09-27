import { getServiceToken } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";
import { buildPrompt, clampSummary, monthRange } from "./summaryLogic";

const GATEWAY_URL = "https://ai-gateway.convex.dev/v1/chat/completions";
type GatewayModel = { slug: string; extra?: Record<string, unknown> };

const MODELS: GatewayModel[] = [
  // Flash thinks until the token cap unless reasoning is off; extras stay per-model.
  { slug: "qwen/qwen3.7-flash", extra: { reasoning: { enabled: false } } },
  // ponytail: free-tier models 429 when their upstream is busy; one fallback keeps the button usable.
  // ~ = floating alias for the newest deepseek-v4-flash release.
  { slug: "~deepseek/deepseek-v4-flash-latest" },
];

const SYSTEM_PROMPT =
  "You summarize a developer's git work log for a non-technical reader. " +
  "Reply with 1 to 5 short lines in English, one point per line, each at most 80 characters. " +
  "One line per feature, not per commit: merge related commits into the one feature they deliver. " +
  "Say what the app or page can now do — the result, not the engineering behind it " +
  "(no tokens, flags, tests, or function names). " +
  "Match the number of lines to the distinct features: 1 for a small change, up to 5 for a busy day. " +
  "Use simple everyday words: no jargon, no commit prefixes like 'feat:' or 'fix:', " +
  "no bullet symbols, no markdown, no quotes.";

function callGateway(token: string, model: GatewayModel, prompt: string): Promise<Response> {
  return fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model.slug,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: 300,
      ...model.extra,
    }),
  });
}

// ponytail: free-tier quota windows roll over ~minutely; two model rounds with a short pause.
async function callGatewayWithRetry(token: string, prompt: string): Promise<Response> {
  let response = await callGateway(token, MODELS[0], prompt);
  if (response.status !== 429) return response;
  response = await callGateway(token, MODELS[1], prompt);
  if (response.status !== 429) return response;
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  for (const model of MODELS) {
    response = await callGateway(token, model, prompt);
    if (response.status !== 429) return response;
  }
  return response;
}

export const listByMonth = query({
  args: { year: v.number(), month: v.number() },
  handler: async (ctx, args) => {
    const { start, end } = monthRange(args.year, args.month);
    return await ctx.db
      .query("summaries")
      .withIndex("by_day_and_repo_and_branch", (q) => q.gte("day", start).lt("day", end))
      .take(1000);
  },
});

export const summarizeBranch = action({
  args: {
    day: v.string(),
    repo: v.string(),
    branch: v.string(),
    titles: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    if (args.titles.length === 0) throw new Error("ไม่มี commits ให้สรุป");

    const token = await getServiceToken("ai-gateway");
    const response = await callGatewayWithRetry(token, buildPrompt(args));

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("model ฟรีไม่ว่างชั่วคราว ลองคลิกอีกครั้งในอีกสักครู่ (AI gateway 429)");
      }
      const body = (await response.text()).slice(0, 300);
      throw new Error(`AI gateway ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim() === "") {
      throw new Error("AI gateway ตอบกลับว่างเปล่า");
    }

    const summary = clampSummary(text);
    await ctx.runMutation(internal.summaries.upsert, {
      day: args.day,
      repo: args.repo,
      branch: args.branch,
      summary,
    });
    return summary;
  },
});

export const upsert = internalMutation({
  args: {
    day: v.string(),
    repo: v.string(),
    branch: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("summaries")
      .withIndex("by_day_and_repo_and_branch", (q) =>
        q.eq("day", args.day).eq("repo", args.repo).eq("branch", args.branch)
      )
      .unique();
    if (existing) {
      await ctx.db.patch("summaries", existing._id, { summary: args.summary });
    } else {
      await ctx.db.insert("summaries", args);
    }
  },
});
