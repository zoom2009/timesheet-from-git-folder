"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  availableYears,
  bangkokDay,
  groupByBranch,
  groupByDay,
  type BranchGroup,
  type Commit,
  type ScanError,
} from "@/lib/commits";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

type Scan =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      scannedAt: string;
      repoCount: number;
      commits: Commit[];
      errors: ScanError[];
    };

// "2026-09-26" → "26 กันยายน 2026"
function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${date} ${THAI_MONTHS[month - 1]} ${year}`;
}

const selectClass =
  "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40 focus:outline-none";

const buttonClass =
  "rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:outline-none disabled:opacity-50";

const smallButtonClass =
  "rounded-md bg-violet-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:outline-none disabled:opacity-50";

function summaryKey(day: string, repo: string, branch: string): string {
  return `${day}|${repo}|${branch}`;
}

async function loadCommits(): Promise<Scan> {
  const res = await fetch("/api/commits");
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return { status: "ready", ...(await res.json()) };
}

function toErrorScan(err: unknown): Scan {
  return { status: "error", message: err instanceof Error ? err.message : String(err) };
}

export default function Home() {
  const [scan, setScan] = useState<Scan>({ status: "loading" });
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const summarize = useAction(api.summaries.summarizeBranch);
  const setDayDone = useMutation(api.completedDays.setDone);
  const [busySummary, setBusySummary] = useState<Record<string, boolean>>({});
  const [summaryError, setSummaryError] = useState<Record<string, string>>({});
  const [confirmDay, setConfirmDay] = useState<string | null>(null);

  useEffect(() => {
    loadCommits()
      .then(setScan)
      .catch((err: unknown) => setScan(toErrorScan(err)));
  }, []);

  const refresh = useCallback(() => {
    setScan({ status: "loading" });
    loadCommits()
      .then(setScan)
      .catch((err: unknown) => setScan(toErrorScan(err)));
  }, []);

  const selectCurrentMonth = useCallback(() => {
    // Bangkok month matches the timezone commits are grouped by.
    const today = bangkokDay(new Date().toISOString());
    setYear(today.slice(0, 4));
    setMonth(String(Number(today.slice(5, 7))));
  }, []);

  const years = useMemo(() => {
    if (scan.status !== "ready") return [];
    const list = availableYears(scan.commits);
    const currentYear = Number(bangkokDay(new Date().toISOString()).slice(0, 4));
    return list.includes(currentYear) ? list : [...list, currentYear].sort((a, b) => b - a);
  }, [scan]);

  const groups = useMemo(() => {
    if (scan.status !== "ready" || !year || !month) return null;
    return groupByDay(scan.commits, Number(year), Number(month));
  }, [scan, year, month]);

  const totals = useMemo(() => {
    if (!groups) return null;
    const commits = groups.reduce(
      (sum, g) => sum + g.repos.reduce((n, r) => n + r.commits.length, 0),
      0
    );
    const repos = new Set(groups.flatMap((g) => g.repos.map((r) => r.name))).size;
    return { commits, repos, days: groups.length };
  }, [groups]);

  const summaries = useQuery(
    api.summaries.listByMonth,
    year && month ? { year: Number(year), month: Number(month) } : "skip"
  );

  const summaryByKey = useMemo(
    () =>
      new Map(
        (summaries ?? []).map((row) => [summaryKey(row.day, row.repo, row.branch), row.summary])
      ),
    [summaries]
  );

  const doneDays = useQuery(
    api.completedDays.listByMonth,
    year && month ? { year: Number(year), month: Number(month) } : "skip"
  );

  const doneSet = useMemo(() => new Set(doneDays ?? []), [doneDays]);

  const markDone = (day: string, done: boolean) => {
    setDayDone({ day, done }).catch((err: unknown) => console.error("setDone failed", err));
  };

  const runSummary = useCallback(
    (day: string, repoName: string, branchGroup: BranchGroup) => {
      const key = summaryKey(day, repoName, branchGroup.branch);
      setBusySummary((prev) => ({ ...prev, [key]: true }));
      setSummaryError((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      summarize({
        day,
        repo: repoName,
        branch: branchGroup.branch,
        titles: branchGroup.commits.map((commit) => commit.title),
      })
        .catch((err: unknown) => {
          setSummaryError((prev) => ({
            ...prev,
            [key]: err instanceof Error ? err.message : String(err),
          }));
        })
        .finally(() => {
          setBusySummary((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        });
    },
    [summarize]
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 font-sans">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timesheet</h1>
          {scan.status === "ready" && (
            <p className="mt-1 text-sm text-zinc-400">
              อ่านข้อมูล {scan.repoCount} repos · {scan.commits.length.toLocaleString()} commits ·{" "}
              {new Date(scan.scannedAt).toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
        <button onClick={refresh} disabled={scan.status === "loading"} className={buttonClass}>
          รีเฟรช
        </button>
      </header>

      {scan.status === "ready" && scan.errors.length > 0 && (
        <p
          title={scan.errors.map((e) => `${e.repo}: ${e.message}`).join("\n")}
          className="mt-4 rounded-lg border border-amber-800 bg-amber-950 px-4 py-2 text-sm text-amber-200"
        >
          อ่านบาง repo ไม่สำเร็จ: {scan.errors.map((e) => e.repo).join(", ")}
        </p>
      )}

      <section className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          ปี
          <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
            <option value="">เลือกปี</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          เดือน
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectClass}>
            <option value="">เลือกเดือน</option>
            {THAI_MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button onClick={selectCurrentMonth} className={buttonClass}>
          เดือนนี้
        </button>
      </section>

      <section className="mt-8">
        {scan.status === "loading" && (
          <p className="text-zinc-400">กำลังอ่าน git history...</p>
        )}

        {scan.status === "error" && (
          <p className="rounded-lg border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-300">
            อ่านข้อมูลไม่สำเร็จ: {scan.message}
          </p>
        )}

        {scan.status === "ready" && !groups && (
          <p className="text-zinc-400">เลือกปีและเดือนเพื่อดูข้อมูล</p>
        )}

        {groups &&
          totals &&
          (groups.length === 0 ? (
            <p className="text-zinc-400">ไม่มี commits ในเดือนนี้</p>
          ) : (
            <>
              <p className="text-sm text-zinc-400">
                <span className="text-emerald-300">{totals.commits}</span> commits ·{" "}
                <span className="text-sky-300">{totals.repos}</span> repos ·{" "}
                <span className="text-cyan-300">{totals.days}</span> วัน
              </p>
              <ol className="mt-4 flex flex-col gap-6">
                {groups.map((group) => {
                  const dayCount = group.repos.reduce((n, r) => n + r.commits.length, 0);
                  const done = doneSet.has(group.day);
                  return (
                    <li
                      key={group.day}
                      className="overflow-hidden rounded-xl border border-zinc-800 border-l-4 border-l-cyan-400"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
                        <h2 className={`font-medium ${done ? "text-cyan-300/40" : "text-cyan-300"}`}>
                          {formatDay(group.day)}
                        </h2>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                            {dayCount} commits
                          </span>
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => (done ? setConfirmDay(group.day) : markDone(group.day, true))}
                              className="h-4 w-4 accent-emerald-400 focus-visible:ring-2 focus-visible:ring-violet-500/60"
                            />
                            เสร็จ
                          </label>
                        </div>
                      </div>
                      <div className={`flex flex-col gap-4 px-4 py-4 ${done ? "opacity-60" : ""}`}>
                        {group.repos.map((repo) => (
                          <div key={repo.name}>
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-sky-300">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                              {repo.name}
                              <span className="font-normal text-zinc-400">
                                {repo.commits.length} commits
                              </span>
                            </h3>
                            <div className="mt-1.5 flex flex-col gap-2">
                              {groupByBranch(repo.commits).map((branchGroup) => {
                                const key = summaryKey(group.day, repo.name, branchGroup.branch);
                                const summary = summaryByKey.get(key);
                                const busy = busySummary[key] ?? false;
                                const error = summaryError[key];
                                return (
                                  <div key={branchGroup.branch}>
                                    <div className="flex items-center justify-between gap-2">
                                      <h4 className="break-all rounded-full bg-pink-500/15 px-2 py-0.5 text-xs font-medium text-pink-300">
                                        {branchGroup.branch}
                                      </h4>
                                      <button
                                        onClick={() => runSummary(group.day, repo.name, branchGroup)}
                                        disabled={busy}
                                        className={smallButtonClass}
                                      >
                                        {busy ? "กำลังสรุป..." : summary ? "สรุปใหม่" : "สรุปด้วย AI"}
                                      </button>
                                    </div>
                                    {summary && (
                                      <ul className="mt-1 list-disc rounded-md bg-violet-500/10 py-1 pl-6 pr-2 text-xs text-violet-300 marker:text-violet-400">
                                        {summary.split("\n").map((item, index) => (
                                          <li key={index}>{item}</li>
                                        ))}
                                      </ul>
                                    )}
                                    {error && (
                                      <p className="mt-1 text-xs text-red-400">
                                        สรุปไม่สำเร็จ: {error}
                                      </p>
                                    )}
                                    <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-zinc-300">
                                      {branchGroup.commits.map((commit) => (
                                        <li key={commit.hash} className="marker:text-emerald-400">
                                          {commit.title}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          ))}
      </section>

      {confirmDay && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmDay(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
        >
          {/* ponytail: no focus trap or Esc handling; click-outside closes. Upgrade if it becomes a real dialog need. */}
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl"
          >
            <p className="text-sm text-zinc-200">เปลี่ยนกลับเป็น “ยังไม่เสร็จ”?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDay(null)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:outline-none"
              >
                ปิด
              </button>
              <button
                onClick={() => {
                  markDone(confirmDay, false);
                  setConfirmDay(null);
                }}
                className={smallButtonClass}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
