import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Flame } from "lucide-react";
import "./today-track-rings.css";

type TrackCount = { trackId: string; attempts: number; solved: number };
type DifficultyCount = { solved: number; total: number };
type DifficultyProgress = { trackId: string; easy: DifficultyCount; medium: DifficultyCount; hard: DifficultyCount };
type DailyProgress = { streakDays: number; today: { tracks: TrackCount[] }; allTimeTracks: { trackId: string; solved: number }[]; trackTotals: { trackId: string; solved: number; total: number }[]; difficultyTotals: DifficultyProgress[] };
export type OverallDifficultyProgress = Pick<DifficultyProgress, "easy" | "medium" | "hard">;

const API = "";
const tracks = [
  { id: "sql-interview-lab", name: "SQL", tone: "sql" },
  { id: "python-etl", name: "Python", tone: "python" },
  { id: "pyspark-foundations", name: "PySpark", tone: "spark" },
  { id: "etl-data-quality", name: "ETL", tone: "etl" },
  { id: "databricks-delta", name: "Databricks", tone: "databricks" },
  { id: "azure-data-factory", name: "Azure", tone: "azure" }
];

export default function TodayTrackRings({ setOverallDifficulty }: {
  setOverallDifficulty: Dispatch<SetStateAction<OverallDifficultyProgress | null>>;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [allTimeCounts, setAllTimeCounts] = useState<Record<string, number>>({});
  const [difficultyTotals, setDifficultyTotals] = useState<Record<string, Omit<DifficultyProgress, "trackId">>>({});
  const [ready, setReady] = useState(false);
  const [streakDays, setStreakDays] = useState(0);

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
        setDifficultyTotals(Object.fromEntries((progress.difficultyTotals || []).map(({ trackId, ...difficulty }) => [trackId, difficulty])));
        setOverallDifficulty((progress.difficultyTotals || []).reduce<OverallDifficultyProgress>((total, track) => ({
          easy: { solved: total.easy.solved + track.easy.solved, total: total.easy.total + track.easy.total },
          medium: { solved: total.medium.solved + track.medium.solved, total: total.medium.total + track.medium.total },
          hard: { solved: total.hard.solved + track.hard.solved, total: total.hard.total + track.hard.total }
        }), {
          easy: { solved: 0, total: 0 },
          medium: { solved: 0, total: 0 },
          hard: { solved: 0, total: 0 }
        }));
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

  const renderTrackCard = (track: typeof tracks[number]) => {
    const solved = counts[track.id] || 0;
    const totalSolved = allTimeCounts[track.id] || 0;
    const difficulty = difficultyTotals[track.id];
    const difficultyStats = [
      { label: "Easy", count: difficulty?.easy },
      { label: "Medium", count: difficulty?.medium },
      { label: "Hard", count: difficulty?.hard }
    ];
    return <article className={`todayTrackRingItem tone-${track.tone}`} key={track.id} aria-label={`${track.name}: ${solved} solved today and ${ready ? totalSolved : "—"} solved all time`}>
      <header className="todayTrackCardHeading"><b>{track.name}</b><span><strong>{ready ? solved : "—"}</strong><small>today</small></span></header>
      <p className="todayTrackAllTime">{ready ? totalSolved : "—"} <span>solved all-time</span></p>
      <div className="todayTrackDifficultyGrid" aria-label={`${track.name} progress by difficulty`}>
        {difficultyStats.map(({ label, count }) => <div className={`todayTrackDifficultyStat difficulty-${label.toLowerCase()}`} key={label} title={`${label}: ${count?.solved || 0} of ${count?.total || 0} solved`}>
          <span>{label}</span><strong>{ready ? count?.solved || 0 : "—"}<i>/</i>{ready ? count?.total || 0 : "—"}</strong>
        </div>)}
      </div>
    </article>;
  };

  return <>
    <div className="todayTrackRingsTitle" aria-label="Today's learning activity">
      <div className="todayTrackRingsHeading"><span>TODAY</span><span className="todayTrackStreak" title={`${streakDays} consecutive days with a correct answer`}><Flame size={12} />{ready ? `${streakDays}d streak` : "—"}</span></div>
      <small>{ready ? `${Object.values(counts).reduce((sum, count) => sum + count, 0)} solved across tracks` : "Loading track activity"}</small>
    </div>
    <div className="todayTrackFeatured" aria-label="SQL and Python progress">{tracks.slice(0, 2).map(renderTrackCard)}</div>
    <div className="todayTrackRingList" aria-label="Other track progress">{tracks.slice(2).map(renderTrackCard)}</div>
  </>;
}
