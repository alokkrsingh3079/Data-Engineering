import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, Check, Flame } from "lucide-react";
import "./daily-progress.css";
import "./daily-progress-visuals.css";

type TrackCount = { trackId: string; attempts: number; solved: number };
type ActivityDay = { date: string; attempts: number; solved: number; tracks: TrackCount[] };
type DailyProgress = { timeZone: string; streakDays: number; today: ActivityDay; days: ActivityDay[] };
type TrendBucket = { date: string; solved: number; attempts: number };

const API = "";
const trackNames: Record<string, { name: string; short: string; tone: number }> = {
  "sql-interview-lab": { name: "SQL", short: "SQL", tone: 0 },
  "python-etl": { name: "Python", short: "PY", tone: 1 },
  "pyspark-foundations": { name: "PySpark", short: "SP", tone: 2 },
  "azure-data-factory": { name: "Azure", short: "AZ", tone: 3 },
  "databricks-delta": { name: "Databricks", short: "DB", tone: 4 },
  "etl-data-quality": { name: "ETL & Warehousing", short: "ETL", tone: 5 },
  "pipeline-system-design": { name: "System Design", short: "SYS", tone: 6 },
  "data-engineering-concepts": { name: "Concepts", short: "CON", tone: 7 },
  "ai-mock-interviews": { name: "Interview", short: "INT", tone: 8 }
};
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateLabel(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00.000Z`));
}

export default function DailyProgressCalendar() {
  const [range, setRange] = useState(7);
  const [progress, setProgress] = useState<DailyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const query = new URLSearchParams({ days: String(range), timeZone });
    const refresh = async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(`${API}/api/progress/daily?${query}`, { credentials: "include", signal: controller.signal });
        if (response.status === 401) {
          location.href = "/login";
          return;
        }
        if (!response.ok) throw new Error("Daily progress is unavailable.");
        setProgress(await response.json());
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
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
  }, [range]);

  const orderedDays = progress ? [...progress.days].reverse() : [];
  const firstWeekday = orderedDays.length ? (new Date(`${orderedDays[0].date}T12:00:00.000Z`).getUTCDay() + 6) % 7 : 0;
  const cells: (ActivityDay | null)[] = [...Array.from({ length: firstWeekday }, () => null), ...orderedDays];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const activeDays = orderedDays.filter((day) => day.solved > 0).length;
  const rangeSolved = orderedDays.reduce((total, day) => total + day.solved, 0);
  const rangeAttempts = orderedDays.reduce((total, day) => total + day.attempts, 0);
  const averageDailySolves = activeDays ? (rangeSolved / activeDays).toFixed(1) : "0";
  const bucketSize = range === 90 ? 7 : range === 30 ? 2 : 1;
  const trendBuckets: TrendBucket[] = [];
  for (let index = 0; index < orderedDays.length; index += bucketSize) {
    const bucket = orderedDays.slice(index, index + bucketSize);
    trendBuckets.push({
      date: bucket[0].date,
      solved: bucket.reduce((total, day) => total + day.solved, 0),
      attempts: bucket.reduce((total, day) => total + day.attempts, 0)
    });
  }
  const maxTrendValue = Math.max(1, ...trendBuckets.map((bucket) => Math.max(bucket.solved, bucket.attempts)));
  const trackSummary = Object.values(orderedDays.reduce<Record<string, TrackCount>>((summary, day) => {
    for (const track of day.tracks) {
      const current = summary[track.trackId] || { trackId: track.trackId, attempts: 0, solved: 0 };
      current.attempts += track.attempts;
      current.solved += track.solved;
      summary[track.trackId] = current;
    }
    return summary;
  }, {})).filter((track) => track.attempts > 0).sort((left, right) => right.solved - left.solved || right.attempts - left.attempts);
  const maxTrackSolved = Math.max(1, ...trackSummary.map((track) => track.solved));

  return <section className="dailyProgressSection" aria-labelledby="dailyProgressTitle">
    <header className="dailyProgressHeader"><div><span>YOUR PRACTICE HISTORY</span><h2 id="dailyProgressTitle">Daily question progress</h2><p>Each question counts once per track and day. Attempts include retries.</p></div><label><CalendarDays size={15} /> Range<select value={range} onChange={(event) => setRange(Number(event.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label></header>
    {progress && <div className="dailyProgressSummary"><div><Flame size={17} /><span>Current streak</span><strong>{progress.streakDays} days</strong><small>days with a correct answer</small></div><div><Check size={17} /><span>Solved today</span><strong>{progress.today.solved}</strong><small>{progress.today.attempts} attempts</small></div><div><BarChart3 size={17} /><span>Solved in range</span><strong>{rangeSolved}</strong><small>{rangeAttempts} total attempts</small></div><div><CalendarDays size={17} /><span>Active days</span><strong>{activeDays}</strong><small>{averageDailySolves} solves per active day</small></div></div>}
    {loading && !progress ? <p className="dailyProgressLoading">Loading daily calendar…</p> : error && !progress ? <p className="dailyProgressLoading" role="status">Daily activity is unavailable right now.</p> : progress ? <>
      <div className="dailyProgressInsights">
        <section className="dailyInsightPanel" aria-label={`Question activity trend for ${range} days`}>
          <header><div><b>ACTIVITY TREND</b><span>Solved questions and all attempts</span></div><small>{bucketSize === 1 ? "Daily" : `Grouped by ${bucketSize === 7 ? "week" : "2 days"}`}</small></header>
          <div className="dailyTrendLegend"><span><i className="trendSolved" />Solved</span><span><i className="trendAttempts" />Attempts</span></div>
          <div className="dailyTrendChart" role="img" aria-label={`${range}-day activity trend with ${rangeSolved} questions solved and ${rangeAttempts} attempts`}>
            {trendBuckets.map((bucket) => <div className="dailyTrendColumn" key={bucket.date} title={`${dateLabel(bucket.date)}: ${bucket.solved} solved, ${bucket.attempts} attempts`}>
              <div className="dailyTrendBars">
                <span className="dailyTrendBar trendSolved" style={{ height: `${Math.max(3, bucket.solved / maxTrendValue * 100)}%` }} />
                <span className="dailyTrendBar trendAttempts" style={{ height: `${Math.max(3, bucket.attempts / maxTrendValue * 100)}%` }} />
              </div>
              <small>{trendBuckets.length <= 10 || trendBuckets.indexOf(bucket) % Math.ceil(trendBuckets.length / 10) === 0 ? dateLabel(bucket.date) : ""}</small>
            </div>)}
          </div>
        </section>
        <section className="dailyInsightPanel dailyTrackBreakdown" aria-label="Track activity breakdown">
          <header><div><b>TRACK BREAKDOWN</b><span>Questions solved by learning track</span></div></header>
          {trackSummary.length ? <div className="dailyTrackBreakdownList">{trackSummary.map((track) => {
            const info = trackNames[track.trackId] || { name: track.trackId, short: track.trackId.slice(0, 3).toUpperCase(), tone: 8 };
            return <div className="dailyTrackBreakdownItem" key={track.trackId} title={`${info.name}: ${track.solved} solved from ${track.attempts} attempts`}>
              <span className={`dailyTrackBreakdownName tone-${info.tone}`}>{info.name}</span><div><i style={{ width: `${track.solved / maxTrackSolved * 100}%` }} /></div><strong>{track.solved}</strong>
            </div>;
          })}</div> : <p className="dailyProgressLoading">No attempts in this date range yet.</p>}
        </section>
      </div>
      <div className="dailyCalendarLegend" aria-label="Track abbreviations">{Object.entries(trackNames).map(([id, track]) => <span className={`dailyCalendarLegendItem tone-${track.tone}`} key={id}><i />{track.name}</span>)}</div>
      <div className="dailyCalendarScroll"><div className="dailyCalendarGrid" role="grid" aria-label={`${range} day learning activity calendar`}>
        {weekdays.map((weekday) => <span className="dailyCalendarWeekday" role="columnheader" key={weekday}>{weekday}</span>)}
        {weeks.flatMap((week, weekIndex) => week.map((day, dayIndex) => day ? (
          <div className={`dailyCalendarDay${day.solved ? ` hasSolved solved-${Math.min(day.solved, 4)}` : ""}`} role="gridcell" key={day.date} aria-label={`${dateLabel(day.date)}: ${day.solved} solved, ${day.attempts} attempts`}>
            <time dateTime={day.date}><span>{weekdays[dayIndex]}</span><strong>{dateLabel(day.date)}</strong></time>
            <b className="dailyCalendarSolved">{day.solved} <small>solved</small></b>
            <div className="dailyCalendarTracks">{day.tracks.length ? day.tracks.filter((track) => track.solved > 0).map((track) => {
              const info = trackNames[track.trackId] || { name: track.trackId, short: track.trackId.slice(0, 3).toUpperCase(), tone: 8 };
              return <span className={`dailyCalendarTrack tone-${info.tone}`} title={`${info.name}: ${track.solved} solved, ${track.attempts} attempts`} aria-label={`${info.name}: ${track.solved} solved, ${track.attempts} attempts`} key={track.trackId}><b>{info.short}</b><span>{track.solved}</span></span>;
            }) : <span className="dailyCalendarEmpty">No solves</span>}</div>
            <small className="dailyCalendarAttempts">{day.attempts} {day.attempts === 1 ? "attempt" : "attempts"}</small>
          </div>
        ) : (
          <span className="dailyCalendarBlank" role="presentation" key={`blank-${weekIndex}-${dayIndex}`} />
        )))}
      </div></div>
      {error && <p className="dailyProgressLoading" role="status">Showing saved activity; latest refresh failed.</p>}
    </> : null}
  </section>;
}
