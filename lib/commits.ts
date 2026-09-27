export type Commit = { repo: string; hash: string; iso: string; title: string; branch: string };

export type ScanError = { repo: string; message: string };

export type ScanResult = {
  scannedAt: string;
  repoCount: number;
  commits: Commit[];
  errors: ScanError[];
};

export type DayGroup = { day: string; repos: { name: string; commits: Commit[] }[] };

// git log puts \x1f between fields, \x1e after each record, \n between records.
export function parseLog(repo: string, raw: string): Commit[] {
  return raw
    .split("\x1e")
    .filter((record) => record.trim() !== "")
    .map((record) => {
      const [ref, hash, iso, ...titleParts] = record.split("\x1f");
      return {
        repo,
        hash: hash.trim(),
        iso,
        title: titleParts.join("\x1f").trim(),
        branch: cleanRef(ref),
      };
    });
}

// "refs/heads/x" / "refs/remotes/origin/x" / "refs/tags/x" all display as "x".
function cleanRef(ref: string): string {
  return ref
    .trim()
    .replace(/^refs\/heads\//, "")
    .replace(/^refs\/remotes\/[^/]+\//, "")
    .replace(/^refs\/tags\//, "");
}

// Fixed +07:00 formatter so a late-night commit groups on the right day.
const bangkokDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function bangkokDay(iso: string): string {
  return bangkokDate.format(new Date(iso));
}

export function groupByDay(commits: Commit[], year: number, month: number): DayGroup[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const byDay = new Map<string, Map<string, Commit[]>>();

  for (const commit of commits) {
    const day = bangkokDay(commit.iso);
    if (!day.startsWith(prefix)) continue;
    const dayRepos = byDay.get(day) ?? new Map<string, Commit[]>();
    const repoCommits = dayRepos.get(commit.repo) ?? [];
    repoCommits.push(commit);
    dayRepos.set(commit.repo, repoCommits);
    byDay.set(day, dayRepos);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, dayRepos]) => ({
      day,
      repos: [...dayRepos.entries()]
        .map(([name, repoCommits]) => ({ name, commits: repoCommits }))
        .sort((a, b) => b.commits.length - a.commits.length || a.name.localeCompare(b.name)),
    }));
}

export type BranchGroup = { branch: string; commits: Commit[] };

// Commits arrive newest first, so first-seen order = most recent branch first.
export function groupByBranch(commits: Commit[]): BranchGroup[] {
  const byBranch = new Map<string, Commit[]>();
  for (const commit of commits) {
    const group = byBranch.get(commit.branch) ?? [];
    group.push(commit);
    byBranch.set(commit.branch, group);
  }
  return [...byBranch.entries()].map(([branch, branchCommits]) => ({
    branch,
    commits: branchCommits,
  }));
}

export function availableYears(commits: Commit[]): number[] {
  const years = new Set(commits.map((c) => Number(bangkokDay(c.iso).slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}
