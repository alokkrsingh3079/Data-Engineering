import { useEffect, useState, type CSSProperties } from "react";
import { Flame } from "lucide-react";
import "./today-track-rings.css";
import "./today-track-rings-size.css";
import "./today-track-rings-tooltip.css";

type TrackCount = { trackId: string; attempts: number; solved: number };
type DailyProgress = { streakDays: number; today: { tracks: TrackCount[] }; allTimeTracks: { trackId: string; solved: number }[]; trackTotals: { trackId: string; solved: number; total: number }[] };

const API = "";
const tracks = [
  { id: "sql-interview-lab", name: "SQL", tone: "sql" },
  { id: "python-etl", name: "Python", tone: "python" },
  { id: "pyspark-foundations", name: "PySpark", tone: "spark" },
  { id: "etl-data-quality", name: "ETL", tone: "etl" },
  { id: "databricks-delta", name: "Databricks", tone: "databricks" },
  { id: "azure-data-factory", name: "Azure", tone: "azure" }
];

export default function TodayTrackRings() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [allTimeCounts, setAllTimeCounts] = useState<Record<string, number>>({});
  const [questionTotals, setQuestionTotals] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [activeTrack, setActiveTrack] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const query = new URLSearchParams({ days: "7", timeZone });
    const refresh = async () => {
      try {
        const response = await fetch(`${API}/api/progress/daily?${query}`, { credentials: "include", signal: controller.signal });
        if (response.status === 401) {
          location.href = "/login";
          return;
        }
        if (!response.ok) return;
        const progress: DailyProgress = await response.json();
        setCounts(Object.fromEntries(progress.today.tracks.map((track) => [track.trackId, track.solved])));
        setAllTimeCounts(Object.fromEntries(progress.allTimeTracks.map((track) => [track.trackId, track.solved])));
        setQuestionTotals(Object.fromEntries(progress.trackTotals.map((track) => [track.trackId, track.total])));
        setStreakDays(progress.streakDays);
        setReady(true);
      } catch {}
    };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return <section className="todayTrackRings" aria-label="Today's solved questions by track">
    <div className="todayTrackRingsTitle">
      <div className="todayTrackRingsHeading"><span>TODAY</span><span className="todayTrackStreak" title={`${streakDays} consecutive days with a correct answer`}><Flame size={12} />{ready ? `${streakDays}d streak` : "—"}</span></div>
      <small>{ready ? `${Object.values(counts).reduce((sum, count) => sum + count, 0)} solved across tracks` : "Loading track activity"}</small>
    </div>
    <div className="todayTrackRingList">{tracks.map((track) => {
      const solved = counts[track.id] || 0;
      const totalSolved = allTimeCounts[track.id] || 0;
      const totalQuestions = questionTotals[track.id] || 0;
      const fill = totalQuestions ? Math.min(100, Math.round(totalSolved / totalQuestions * 100)) : 0;
      return <div className={`todayTrackRingItem tone-${track.tone}`} key={track.id} data-tooltip={`${totalSolved}/${totalQuestions} questions solved overall`} tabIndex={0} onMouseEnter={() => setActiveTrack(track.id)} onMouseLeave={() => setActiveTrack((current) => current === track.id ? null : current)} onFocus={() => setActiveTrack(track.id)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveTrack(null); }} aria-label={`${track.name}: ${solved} solved today, ${totalSolved} of ${totalQuestions} solved overall`}>
        <span className={`todayTrackRing${activeTrack === track.id ? " todayTrackRingFraction" : ""}`} style={{ "--ring-fill": `${fill}%` } as CSSProperties} aria-hidden="true"><strong>{ready ? activeTrack === track.id ? `${totalSolved}/${totalQuestions}` : solved : "·"}</strong></span>
        <span className="todayTrackRingLabel"><b>{track.name}</b><small>Today {solved} · All-time {ready ? totalSolved : "—"}</small></span>
      </div>;
    })}</div>
  </section>;
}
