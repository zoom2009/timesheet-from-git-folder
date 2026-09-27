import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseLog, type Commit, type ScanError, type ScanResult } from "./commits";

// Scan folder; override with TRUE_PROJECTS_DIR (default ~/projects).
export const TRUE_PROJECTS_DIR =
  process.env.TRUE_PROJECTS_DIR ?? path.join(homedir(), "projects");

// Author emails from AUTHOR_EMAILS, comma-separated; empty means all authors.
export const AUTHOR_EMAILS = parseAuthorEmails(process.env.AUTHOR_EMAILS ?? "");

export function parseAuthorEmails(raw: string): string[] {
  return raw
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export function buildLogArgs(dir: string, emails: string[] = AUTHOR_EMAILS): string[] {
  return [
    "-C",
    dir,
    "log",
    "--all",
    "--no-merges",
    "-i",
    ...emails.flatMap((email) => ["--author", email]),
    "--pretty=format:%S%x1f%H%x1f%aI%x1f%s%x1e",
  ];
}

function runGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { maxBuffer: 16 * 1024 * 1024, timeout: 30_000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

// git failures carry the useful text in stderr, not in .message.
function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "stderr" in err) {
    const stderr = String((err as { stderr?: unknown }).stderr ?? "").trim();
    if (stderr) return stderr;
  }
  return err instanceof Error ? err.message : String(err);
}

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await stat(path.join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}

export async function scanRepos(): Promise<ScanResult> {
  const entries = await readdir(TRUE_PROJECTS_DIR, { withFileTypes: true }).catch(() => {
    throw new Error(`อ่านโฟลเดอร์ไม่ได้: ${TRUE_PROJECTS_DIR} (ตั้งค่า TRUE_PROJECTS_DIR ใน .env.local)`);
  });

  const repos: { name: string; dir: string }[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(TRUE_PROJECTS_DIR, entry.name);
    if (await isGitRepo(dir)) repos.push({ name: entry.name, dir });
  }

  // ponytail: all repos scanned at once; add a concurrency cap if the repo count grows a lot.
  const results = await Promise.all(
    repos.map(async (repo) => {
      try {
        const stdout = await runGit(buildLogArgs(repo.dir));
        return { commits: parseLog(repo.name, stdout), errors: [] as ScanError[] };
      } catch (err) {
        const message = errorMessage(err);
        // A fresh repo with no commits yet is not an error.
        if (/does not have any commits yet/.test(message)) {
          return { commits: [] as Commit[], errors: [] as ScanError[] };
        }
        return { commits: [] as Commit[], errors: [{ repo: repo.name, message }] };
      }
    })
  );

  const errors = results.flatMap((r) => r.errors);
  return {
    scannedAt: new Date().toISOString(),
    repoCount: repos.length - errors.length,
    commits: results.flatMap((r) => r.commits),
    errors,
  };
}
