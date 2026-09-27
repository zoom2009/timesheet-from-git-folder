import { scanRepos } from "@/lib/git-scan";

export async function GET() {
  try {
    return Response.json(await scanRepos());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
