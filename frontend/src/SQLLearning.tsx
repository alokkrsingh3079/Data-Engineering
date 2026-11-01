import { useEffect, useMemo, useState, type FormEvent } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, Eye, Layers3, Lightbulb, Play, Search, Send, Sparkles } from "lucide-react";
import StudioNavigation from "./StudioNavigation";
import SqlLessonRichText, { lessonSyntaxText } from "./SqlLessonRichText";
import "./sql-learning.css";

type TopicStatus = "not_started" | "in_progress" | "completed";
type ChecklistKey = "theoryRead" | "theoryUnderstood" | "examplesBasic" | "examplesIntermediate" | "examplesAdvanced" | "examplesDataEngineering" | "examplesInterview" | "practiceTest1" | "practiceTest2" | "practiceTest3" | "practiceTest4" | "practiceTest5" | "moduleAssessment" | "revisionCompleted" | "mastered";
const checklistItems: { key: ChecklistKey; label: string }[] = [
  { key: "theoryRead", label: "Theory read" },
  { key: "theoryUnderstood", label: "Theory understood" },
  { key: "examplesBasic", label: "Basic examples" },
  { key: "examplesIntermediate", label: "Intermediate examples" },
  { key: "examplesAdvanced", label: "Advanced examples" },
  { key: "examplesDataEngineering", label: "Data engineering examples" },
  { key: "examplesInterview", label: "Interview examples" },
  { key: "practiceTest1", label: "Practice test 1" },
  { key: "practiceTest2", label: "Practice test 2" },
  { key: "practiceTest3", label: "Practice test 3" },
  { key: "practiceTest4", label: "Practice test 4" },
  { key: "practiceTest5", label: "Practice test 5" },
  { key: "moduleAssessment", label: "Module assessment" },
  { key: "revisionCompleted", label: "Topic revision" },
  { key: "mastered", label: "Topic mastered" }
];
type DashboardModule = {
  id: string;
  order: number;
  title: string;
  topicCount: number;
  completedTopics: number;
  inProgressTopics: number;
  remainingTopics: number;
  completionPercent: number;
  archived?: boolean;
  topics?: { id: string; title: string; order: number }[];
};
type Dashboard = {
  totalModules: number;
  totalTopics: number;
  completedTopics: number;
  inProgressTopics: number;
  remainingTopics: number;
  completionPercent: number;
  practiceDatabaseId: string | null;
  modules: DashboardModule[];
};
type Topic = {
  id: string;
  title: string;
  order: number;
  archived?: boolean;
  description?: string;
  difficulty?: string;
  revisionStatus?: string | null;
  bookmarked?: boolean;
  progress: {
    status: TopicStatus;
    checklist: Record<ChecklistKey, boolean>;
    completionPercent: number;
    firstStudiedAt: string | null;
    firstCompletedAt: string | null;
    lastStudiedAt: string | null;
  };
};
type LearningModule = { id: string; order: number; title: string; topics: Topic[]; archived?: boolean; description?: string; difficulty?: string };
type SqlResult = { columns: string[]; rows: Record<string, unknown>[]; rowCount: number; executionMs: number; correct?: boolean };
type SubmittedSqlAnswer = { status: "ok"; correct: boolean; result: SqlResult; explanation?: string; attemptId: string };
type TestResultSummary = { totalQuestions: number; answeredQuestions: number; correctAnswers: number; incorrectAnswers: number; skippedQuestions: number; score: number; accuracy: number; completed: boolean };
type LessonExample = { title: string; level: string; problem: string; sql: string; explanation: string; observations: string[]; expected: SqlResult };
type LessonContent = { overview: string; theory: string; syntax: string; parameters: string[]; returnType: string; rules: string[]; commonMistakes: string[]; useCases: string[]; interviewRelevance: string; dialectNotes: string; examples: LessonExample[] };
type PracticeQuestion = { id: string; title: string; difficulty: "beginner" | "intermediate" | "advanced"; context: string; task: string; required_output: string; hint: string; explanation: string };
type EditableQuestion = { title: string; difficulty: "beginner" | "intermediate" | "advanced"; context: string; task: string; required_output: string; reference_sql: string; hint: string; explanation: string };
type PracticeTest = { id: string; topicId: string; moduleId: string; testNumber: number; assessmentKind: "topic" | "module" | "interview"; startedAt?: string | null; status: string; result: TestResultSummary; questionResults: { questionId: string; correct: boolean }[]; questions: PracticeQuestion[]; attempts: { question_id: string; correct: boolean; created_at: string }[] };
type VisibleSolution = { sql: string; explanation: string; expected: SqlResult };
type SchemaColumn = { column_name: string; data_type: string; is_nullable?: "YES" | "NO"; is_primary_key?: boolean; column_default?: string | null };
type SchemaRelationship = { constraint_name: string; table_name: string; column_name: string; foreign_table_name: string; foreign_column_name: string };
type TopicDetail = { module: { id: string; title: string; order: number }; topic: Topic; progress: { checklist: Record<ChecklistKey, boolean>; theoryPercent: number; examplesPercent: number; practicePercent: number; overallPercent: number; status: TopicStatus; firstStudiedAt: string | null; firstCompletedAt: string | null; lastStudiedAt: string | null }; revision: { status: string; priority: string; reason: string; notes: string; nextRevisionAt: string | null; revisionCount: number } | null; personalNote: string; bookmarked: boolean; practiceDatabaseId: string | null; practiceDatabaseName: string | null; schema: { schemaName: string; tables: { name: string; columns: SchemaColumn[] }[]; relationships: SchemaRelationship[] } | null; samples: { name: string; schemaColumns: SchemaColumn[]; preview: SqlResult }[]; content: LessonContent | null; tests: { id: string; testNumber: number; questionCount: number; status: string; result: TestResultSummary }[] };
type RevisionCenterData = { intervals: number[]; totalTopics: number; highPriority: number; mediumPriority: number; lowPriority: number; completedSessions: number; masteredTopics: number; weakTopics: number; dueTopics: number; analytics: { sessionsAnalyzed: number; averageScoreImprovement: number | null; improvedSessions: number; declinedSessions: number }; recommendations: { topicId: string; topicTitle: string; moduleTitle: string; reason: string; priority: string; lastScore: number | null; nextRevisionAt: string | null }[]; recentSessions: { topicId: string; topicTitle: string; completedAt: string; scoreBefore: number | null; scoreAfter: number | null; accuracyImprovement: number | null }[]; revisions: { topicId: string; topicTitle: string; moduleId: string; moduleTitle: string; status: string; priority: string; reason: string; notes: string; revisionCount: number; nextRevisionAt: string | null; lastScore: number | null }[] };
type SqlLearningAnalytics = { totalModules: number; totalTopics: number; completedTopics: number; completionPercent: number; accuracy: number | null; questionsAnswered: number; correctAnswers: number; currentStreak: number; longestStreak: number; activeDays: number; activeDaysLast30: number; activeDaysLast7: number; dailyActivity: { date: string; activityCount: number }[]; modules: { moduleId: string; title: string; totalTopics: number; completedTopics: number; completionPercent: number }[] };
type PlannerTask = { id: string; topicId: string; title: string; targetDate: string | null; status: "planned" | "completed" };
type PlannerData = { dailyGoalMinutes: number; weeklyStudyDaysGoal: number; tasks: PlannerTask[] };

const API = "";
const statusLabels: Record<TopicStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed"
};
function curriculumUrl(path: string, custom: boolean) {
  return `${path}${custom ? "?custom=true" : ""}`;
}

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (response.status === 401) {
    location.href = "/login";
    throw new Error("Authentication required.");
  }
  if (!response.ok) throw new Error(data?.error || "SQL Learning is temporarily unavailable.");
  return data as T;
}

export default function SQLLearning() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [activeModule, setActiveModule] = useState<LearningModule | null>(null);
  const [activeTopic, setActiveTopic] = useState<TopicDetail | null>(null);
  const [activeTest, setActiveTest] = useState<PracticeTest | null>(null);
  const [activePage, setActivePage] = useState<"curriculum" | "revisions" | "analytics">("curriculum");
  const [revisionData, setRevisionData] = useState<RevisionCenterData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<SqlLearningAnalytics | null>(null);
  const [plannerData, setPlannerData] = useState<PlannerData | null>(null);
  const [revisionFilter, setRevisionFilter] = useState("all");
  const [revisionIntervalsDraft, setRevisionIntervalsDraft] = useState("1, 3, 7, 14, 30");
  const [revisionSessionId, setRevisionSessionId] = useState("");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"lesson" | "practice">("lesson");
  const [topicLoading, setTopicLoading] = useState(false);
  const [contentGenerating, setContentGenerating] = useState(false);
  const [testGenerating, setTestGenerating] = useState(0);
  const [practiceSql, setPracticeSql] = useState("");
  const [practiceResult, setPracticeResult] = useState<SqlResult | null>(null);
  const [practiceMessage, setPracticeMessage] = useState("");
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [visibleHints, setVisibleHints] = useState<Record<string, boolean>>({});
  const [visibleSolutions, setVisibleSolutions] = useState<Record<string, VisibleSolution>>({});
  const [editingTestQuestion, setEditingTestQuestion] = useState(false);
  const [customQuestionDraft, setCustomQuestionDraft] = useState<EditableQuestion | null>(null);
  const [moduleSearch, setModuleSearch] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [personalCurriculumCreated, setPersonalCurriculumCreated] = useState(false);
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [customTheoryDraft, setCustomTheoryDraft] = useState("");
  const [customSyntaxDraft, setCustomSyntaxDraft] = useState("");
  const [customExamplesDraft, setCustomExamplesDraft] = useState("");
  const [topicNoteDraft, setTopicNoteDraft] = useState("");
  const [revisionPriority, setRevisionPriority] = useState("medium");
  const [revisionReason, setRevisionReason] = useState("manual_request");
  const [tutorAction, setTutorAction] = useState("explain");
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [tutorAnswer, setTutorAnswer] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [interviewSeconds, setInterviewSeconds] = useState<number | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [moduleTitleDraft, setModuleTitleDraft] = useState("");
  const [moduleDescriptionDraft, setModuleDescriptionDraft] = useState("");
  const [moduleDifficultyDraft, setModuleDifficultyDraft] = useState("beginner");
  const [savingChecklist, setSavingChecklist] = useState("");
  const [loading, setLoading] = useState(true);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [savingTopic, setSavingTopic] = useState("");
  const [error, setError] = useState("");

  async function loadDashboard(signal?: AbortSignal, custom = customMode) {
    const response = await fetch(curriculumUrl(`${API}/api/sql-learning`, custom), { credentials: "include", signal });
    const result = await readResponse<Dashboard>(response);
    setDashboard(result);
  }

  async function openModule(moduleId: string) {
    setModuleLoading(true);
    setError("");
    try {
      const response = await fetch(curriculumUrl(`${API}/api/sql-learning/modules/${encodeURIComponent(moduleId)}`, customMode), { credentials: "include" });
      const module = await readResponse<LearningModule>(response);
      setActiveModule(module);
      setModuleTitleDraft(module.title);
      setModuleDescriptionDraft(module.description || "");
      setModuleDifficultyDraft(module.difficulty || "beginner");
      setTopicSearch("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this module.");
    } finally {
      setModuleLoading(false);
    }
  }

  async function openTopic(topicId: string): Promise<TopicDetail | undefined> {
    setTopicLoading(true);
    setActiveTest(null);
    setError("");
    try {
      const response = await fetch(curriculumUrl(`${API}/api/sql-learning/topics/${encodeURIComponent(topicId)}`, customMode), { credentials: "include" });
      const detail = await readResponse<TopicDetail>(response);
      setActiveTopic(detail);
      setTopicNoteDraft(detail.personalNote);
      setCustomTheoryDraft(detail.content?.theory || "");
      setCustomSyntaxDraft(detail.content?.syntax || "");
      setCustomExamplesDraft(JSON.stringify(detail.content?.examples || [], null, 2));
      setCustomEditorOpen(false);
      setActiveTab("lesson");
      if (detail.revision) {
        setRevisionPriority(detail.revision.priority);
        setRevisionReason(detail.revision.reason);
      }
      return detail;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this topic.");
    } finally {
      setTopicLoading(false);
    }
    return undefined;
  }

  async function generateTopicContent() {
    if (!activeTopic) return;
    setContentGenerating(true);
    setError("");
    try {
      const response = await fetch(curriculumUrl(`${API}/api/sql-learning/topics/${encodeURIComponent(activeTopic.topic.id)}/generate`, customMode), { method: "POST", credentials: "include" });
      await readResponse<{ content: LessonContent }>(response);
      await openTopic(activeTopic.topic.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lesson generation failed.");
    } finally {
      setContentGenerating(false);
    }
  }

  async function generatePracticeTest(testNumber: number) {
    if (!activeTopic) return;
    setTestGenerating(testNumber);
    setError("");
    try {
      const response = await fetch(curriculumUrl(`${API}/api/sql-learning/topics/${encodeURIComponent(activeTopic.topic.id)}/tests/${testNumber}/generate`, customMode), { method: "POST", credentials: "include" });
      const job = await readResponse<{ jobId: string; status: string }>(response);
      if (!job.jobId) throw new Error("Practice-test generation did not return a job ID.");
      let consecutivePollErrors = 0;
      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        try {
          const progressResponse = await fetch(`${API}/api/sql-learning/test-generation-jobs/${encodeURIComponent(job.jobId)}`, { credentials: "include", cache: "no-store" });
          const progress = await readResponse<{ status: string; error?: string }>(progressResponse);
          consecutivePollErrors = 0;
          if (progress.status === "failed") throw new Error(progress.error || "Practice test could not be generated.");
          if (progress.status === "completed") break;
        } catch (cause) {
          if (cause instanceof Error && cause.message !== "Failed to fetch" && !(cause instanceof TypeError)) throw cause;
          consecutivePollErrors += 1;
          if (consecutivePollErrors >= 12) throw new Error("Could not refresh practice-test generation. The job may still be running; retry to reconnect.");
        }
      }
      await openTopic(activeTopic.topic.id);
      await openPracticeTest(activeTopic.topic.id, testNumber);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Practice test could not be generated and validated.");
    } finally {
      setTestGenerating(0);
    }
  }

  async function openPracticeTest(topicId: string, testNumber: number) {
    const response = await fetch(curriculumUrl(`${API}/api/sql-learning/topics/${encodeURIComponent(topicId)}`, customMode), { credentials: "include" });
    const detail = await readResponse<TopicDetail>(response);
    const testMeta = detail.tests.find((item) => item.testNumber === testNumber);
    if (!testMeta || testMeta.status !== "ready") throw new Error("Generate and validate this test before opening it.");
    const testResponse = await fetch(`${API}/api/sql-learning/tests/${encodeURIComponent(testMeta.id)}`, { credentials: "include" });
    const test = await readResponse<PracticeTest>(testResponse);
    setActiveTopic(detail);
    setActiveTest(test);
    setActiveQuestionIndex(0);
    setPracticeSql("");
    setPracticeResult(null);
    setPracticeMessage("");
    setActiveTab("practice");
  }

  async function runExample(sqlText: string, exampleLevel?: string) {
    if (!activeTopic?.practiceDatabaseId) {
      setError("Create a SQL Lab workspace before running examples.");
      return;
    }
    setPracticeBusy(true);
    setPracticeMessage("");
    setPracticeResult(null);
    try {
      const response = await fetch(`${API}/api/sql-learning/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseId: activeTopic.practiceDatabaseId, sql: sqlText })
      });
      setPracticeResult(await readResponse<SqlResult>(response));
      setPracticeMessage("Query executed in your SQL Lab workspace.");
      if (exampleLevel && activeTopic) {
        const keyByLevel: Record<string, ChecklistKey> = {
          basic: "examplesBasic",
          intermediate: "examplesIntermediate",
          advanced: "examplesAdvanced",
          data_engineering: "examplesDataEngineering",
          interview: "examplesInterview"
        };
        const key = keyByLevel[exampleLevel];
        if (key) await setChecklistItem(activeTopic.topic.id, key, true);
      }
    } catch (cause) {
      setPracticeMessage(cause instanceof Error ? cause.message : "Query execution failed.");
    } finally {
      setPracticeBusy(false);
    }
  }

  async function submitPracticeAnswer() {
    if (!activeTest || !currentQuestion) return;
    setPracticeBusy(true);
    setPracticeMessage("");
    setPracticeResult(null);
    try {
      const response = await fetch(`${API}/api/sql-learning/tests/${encodeURIComponent(activeTest.id)}/questions/${encodeURIComponent(currentQuestion.id)}/submit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: practiceSql })
      });
      const answer = await readResponse<SubmittedSqlAnswer>(response);
      setPracticeResult({ ...answer.result, correct: answer.correct });
      setPracticeMessage(answer.correct ? `Correct · ${answer.result.executionMs} ms` : "The query ran, but its result did not match the validated answer.");
      const refreshed = await fetch(`${API}/api/sql-learning/tests/${encodeURIComponent(activeTest.id)}`, { credentials: "include" });
      setActiveTest(await readResponse<PracticeTest>(refreshed));
      if (activeTopic) {
        const topicResponse = await fetch(curriculumUrl(`${API}/api/sql-learning/topics/${encodeURIComponent(activeTopic.topic.id)}`, customMode), { credentials: "include" });
        setActiveTopic(await readResponse<TopicDetail>(topicResponse));
      }
    } catch (cause) {
      setPracticeMessage(cause instanceof Error ? cause.message : "Answer submission failed.");
    } finally {
      setPracticeBusy(false);
    }
  }

  async function revealPracticeSolution() {
    if (!activeTest || !currentQuestion) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/tests/${encodeURIComponent(activeTest.id)}/questions/${encodeURIComponent(currentQuestion.id)}/solution`, { credentials: "include" });
      const solution = await readResponse<{ referenceSql: string; explanation: string; expected: SqlResult }>(response);
      setVisibleSolutions((current) => ({ ...current, [currentQuestion.id]: { sql: solution.referenceSql, explanation: solution.explanation, expected: solution.expected } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the solution.");
    }
  }

  async function beginCustomQuestionEdit() {
    if (!activeTest || !currentQuestion) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/tests/${encodeURIComponent(activeTest.id)}/questions/${encodeURIComponent(currentQuestion.id)}/solution`, { credentials: "include" });
      const solution = await readResponse<{ referenceSql: string }>(response);
      setCustomQuestionDraft({
        title: currentQuestion.title,
        difficulty: currentQuestion.difficulty,
        context: currentQuestion.context,
        task: currentQuestion.task,
        required_output: currentQuestion.required_output,
        reference_sql: solution.referenceSql,
        hint: currentQuestion.hint,
        explanation: currentQuestion.explanation
      });
      setEditingTestQuestion(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Question editor could not be opened.");
    }
  }

  async function saveCustomQuestion() {
    if (!activeTest || !currentQuestion || !customQuestionDraft) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/tests/${encodeURIComponent(activeTest.id)}/questions/${encodeURIComponent(currentQuestion.id)}/custom`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(customQuestionDraft)
      });
      await readResponse(response);
      const refreshed = await fetch(`${API}/api/sql-learning/tests/${encodeURIComponent(activeTest.id)}`, { credentials: "include" });
      setActiveTest(await readResponse<PracticeTest>(refreshed));
      setEditingTestQuestion(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Personal question could not be saved.");
    }
  }

  async function setChecklistItem(topicId: string, key: ChecklistKey, checked: boolean) {
    setSavingChecklist(key);
    try {
      const response = await fetch(`${API}/api/sql-learning/topics/${encodeURIComponent(topicId)}/checklist`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, checked })
      });
      await readResponse<{ ok: boolean }>(response);
      if (activeTopic?.topic.id === topicId) await openTopic(topicId);
      if (activeModule) await openModule(activeModule.id);
      await loadDashboard();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checklist progress could not be saved.");
    } finally {
      setSavingChecklist("");
    }
  }

  async function loadRevisionCenter() {
    try {
      const response = await fetch(`${API}/api/sql-learning/revisions`, { credentials: "include" });
      const data = await readResponse<RevisionCenterData>(response);
      setRevisionData(data);
      setRevisionIntervalsDraft(data.intervals.join(", "));
      setActivePage("revisions");
      setActiveModule(null);
      setActiveTopic(null);
      setActiveTest(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revision center could not be loaded.");
    }
  }

  async function loadLearningPlanner() {
    try {
      const [analyticsResponse, plannerResponse] = await Promise.all([
        fetch(`${API}/api/sql-learning/analytics`, { credentials: "include" }),
        fetch(`${API}/api/sql-learning/planner`, { credentials: "include" })
      ]);
      const [analytics, planner] = await Promise.all([
        readResponse<SqlLearningAnalytics>(analyticsResponse),
        readResponse<PlannerData>(plannerResponse)
      ]);
      setAnalyticsData(analytics);
      setPlannerData(planner);
      setActivePage("analytics");
      setActiveModule(null);
      setActiveTopic(null);
      setActiveTest(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Learning analytics could not be loaded.");
    }
  }

  async function saveLearningPlanner(planner: Omit<PlannerData, "tasks"> & {
    tasks: { id?: string; topicId: string; targetDate: string | null; status: "planned" | "completed" }[];
  }): Promise<PlannerData> {
    const response = await fetch(`${API}/api/sql-learning/planner`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planner)
    });
    const saved = await readResponse<PlannerData>(response);
    setPlannerData(saved);
    return saved;
  }

  async function saveRevisionIntervals() {
    const intervals = revisionIntervalsDraft.split(",").map((part) => Number(part.trim()));
    if (intervals.length !== 5 || intervals.some((days) => !Number.isInteger(days) || days < 1 || days > 365)) {
      setError("Enter five revision intervals in days, separated by commas (1–365).");
      return;
    }
    try {
      const response = await fetch(`${API}/api/sql-learning/revision-settings`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intervals })
      });
      await readResponse(response);
      setError("");
      await loadRevisionCenter();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revision intervals could not be saved.");
    }
  }

  async function markTopicForRevision() {
    if (!activeTopic) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/topics/${encodeURIComponent(activeTopic.topic.id)}/revision`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: revisionPriority, reason: revisionReason })
      });
      await readResponse(response);
      await openTopic(activeTopic.topic.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Topic could not be added to revisions.");
    }
  }

  async function startTopicRevision(topicId: string) {
    try {
      const response = await fetch(`${API}/api/sql-learning/revisions/${encodeURIComponent(topicId)}/start`, { method: "POST", credentials: "include" });
      const result = await readResponse<{ sessionId: string }>(response);
      setRevisionSessionId(result.sessionId);
      setActivePage("curriculum");
      const detail = await openTopic(topicId);
      if (detail) {
        setActiveTab("practice");
        const readyTest = detail.tests.find((item) => item.status === "ready");
        if (readyTest) await openPracticeTest(topicId, readyTest.testNumber);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revision session could not be started.");
    }
  }

  async function finishTopicRevision() {
    if (!revisionSessionId || !activeTest) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/revision-sessions/${encodeURIComponent(revisionSessionId)}/complete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId: activeTest.id, notes: "" })
      });
      await readResponse(response);
      setRevisionSessionId("");
      await openTopic(activeTopic?.topic.id || "");
      await loadRevisionCenter();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Complete a revision test before finishing this session.");
    }
  }

  async function saveTopicNote() {
    if (!activeTopic) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/topics/${encodeURIComponent(activeTopic.topic.id)}/note`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: topicNoteDraft, bookmarked: activeTopic.bookmarked })
      });
      await readResponse(response);
      await openTopic(activeTopic.topic.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Topic note could not be saved.");
    }
  }

  async function toggleTopicBookmark() {
    if (!activeTopic) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/topics/${encodeURIComponent(activeTopic.topic.id)}/note`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: topicNoteDraft, bookmarked: !activeTopic.bookmarked })
      });
      await readResponse(response);
      await openTopic(activeTopic.topic.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Topic bookmark could not be saved.");
    }
  }

  async function askTopicTutor() {
    if (!activeTopic) return;
    setTutorBusy(true);
    setTutorAnswer("");
    try {
      const response = await fetch(`${API}/api/sql-learning/topics/${encodeURIComponent(activeTopic.topic.id)}/tutor`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: tutorAction,
          question: tutorQuestion || (currentQuestion ? `${currentQuestion.title}: ${currentQuestion.task}` : activeTopic.topic.title),
          sql: practiceSql,
          error: practiceMessage,
          testId: activeTest?.id,
          questionId: currentQuestion?.id
        })
      });
      const result = await readResponse<{ answer: string }>(response);
      setTutorAnswer(result.answer);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SQL tutor is unavailable.");
    } finally {
      setTutorBusy(false);
    }
  }

  async function createPersonalCurriculum() {
    try {
      const response = await fetch(`${API}/api/sql-learning/custom-curriculum`, { method: "POST", credentials: "include" });
      await readResponse(response);
      setPersonalCurriculumCreated(true);
      setCustomMode(true);
      await loadDashboard(undefined, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Personal curriculum could not be created.");
    }
  }

  async function resetPersonalCurriculum() {
    if (!window.confirm("Restore the official curriculum? Your custom names, topics, and archives will be removed. Progress, attempts, revisions, and notes will remain saved.")) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/custom-curriculum`, { method: "DELETE", credentials: "include" });
      await readResponse(response);
      setPersonalCurriculumCreated(false);
      setCustomMode(false);
      setActiveModule(null);
      setActiveTopic(null);
      await loadDashboard(undefined, false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Official curriculum could not be restored.");
    }
  }

  async function addCustomModule() {
    if (!newModuleTitle.trim()) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/custom-curriculum/modules`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newModuleTitle.trim() })
      });
      await readResponse(response);
      setNewModuleTitle("");
      await loadDashboard();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Module could not be added.");
    }
  }

  async function saveCustomModuleTitle() {
    if (!activeModule || !moduleTitleDraft.trim()) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/custom-curriculum/modules/${encodeURIComponent(activeModule.id)}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: moduleTitleDraft.trim(), description: moduleDescriptionDraft, difficulty: moduleDifficultyDraft })
      });
      await readResponse(response);
      await Promise.all([loadDashboard(), openModule(activeModule.id)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Module name could not be saved.");
    }
  }

  async function addCustomTopic() {
    if (!activeModule || !newTopicTitle.trim()) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/custom-curriculum/modules/${encodeURIComponent(activeModule.id)}/topics`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTopicTitle.trim() })
      });
      await readResponse(response);
      setNewTopicTitle("");
      await openModule(activeModule.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Topic could not be added.");
    }
  }

  async function saveCustomTopic(topic: Topic, patch: { title?: string; order?: number; difficulty?: string; description?: string; archived?: boolean; moveToModuleId?: string }) {
    if (!activeModule) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/custom-curriculum/modules/${encodeURIComponent(activeModule.id)}/topics/${encodeURIComponent(topic.id)}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch)
      });
      await readResponse(response);
      await openModule(activeModule.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Personal topic could not be saved.");
    }
  }

  async function duplicateCustomModule(moduleId: string) {
    try {
      const response = await fetch(`${API}/api/sql-learning/custom-curriculum/modules/${encodeURIComponent(moduleId)}/duplicate`, { method: "POST", credentials: "include" });
      await readResponse(response);
      await loadDashboard(undefined, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Personal module could not be duplicated.");
    }
  }

  async function reorderCustomModule(moduleId: string, order: number) {
    try {
      const response = await fetch(`${API}/api/sql-learning/custom-curriculum/modules/${encodeURIComponent(moduleId)}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order })
      });
      await readResponse(response);
      await loadDashboard(undefined, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Module order could not be saved.");
    }
  }

  async function duplicateCustomTopic(moduleId: string, topicId: string) {
    try {
      const response = await fetch(`${API}/api/sql-learning/custom-curriculum/modules/${encodeURIComponent(moduleId)}/topics/${encodeURIComponent(topicId)}/duplicate`, { method: "POST", credentials: "include" });
      await readResponse(response);
      await openModule(moduleId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Personal topic could not be duplicated.");
    }
  }

  async function editCustomTopicDetails(topic: Topic) {
    const description = window.prompt("Personal topic description", topic.description || "");
    if (description === null) return;
    const difficulty = window.prompt("Difficulty: beginner, intermediate, or advanced", topic.difficulty || "beginner");
    if (difficulty === null) return;
    if (!["beginner", "intermediate", "advanced"].includes(difficulty)) {
      setError("Choose beginner, intermediate, or advanced difficulty.");
      return;
    }
    await saveCustomTopic(topic, { description, difficulty });
  }

  async function moveCustomTopic(topic: Topic) {
    if (!activeModule) return;
    const options = dashboard?.modules.filter((module) => module.id !== activeModule.id).map((module) => `${module.title} [${module.id}]`).join("\n") || "";
    const requested = window.prompt(`Enter the destination module ID:\n${options}`);
    if (!requested) return;
    const destination = dashboard?.modules.find((module) => module.id === requested.trim());
    if (!destination) {
      setError("Choose a module ID from your personal curriculum.");
      return;
    }
    await saveCustomTopic(topic, { moveToModuleId: destination.id });
  }

  async function saveCustomLesson() {
    if (!activeTopic) return;
    try {
      const examples = JSON.parse(customExamplesDraft) as Omit<LessonExample, "expected">[];
      const response = await fetch(`${API}/api/sql-learning/custom-curriculum/topics/${encodeURIComponent(activeTopic.topic.id)}/lesson`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theory: customTheoryDraft, syntax: customSyntaxDraft, examples })
      });
      await readResponse(response);
      setCustomEditorOpen(false);
      await openTopic(activeTopic.topic.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the custom examples JSON and try again.");
    }
  }

  async function restoreCustomLesson() {
    if (!activeTopic || !window.confirm("Discard your custom theory, syntax, and examples and restore the generated lesson?")) return;
    try {
      const response = await fetch(`${API}/api/sql-learning/custom-curriculum/topics/${encodeURIComponent(activeTopic.topic.id)}/lesson`, { method: "DELETE", credentials: "include" });
      await readResponse(response);
      await openTopic(activeTopic.topic.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Generated lesson could not be restored.");
    }
  }

  async function generateSqlAssessment(kind: "assessment" | "mock-interview") {
    if (!activeModule) return;
    setAssessmentBusy(true);
    try {
      const path = kind === "assessment" ? "assessment/generate" : "mock-interview/generate";
      const response = await fetch(curriculumUrl(`${API}/api/sql-learning/modules/${encodeURIComponent(activeModule.id)}/${path}`, customMode), { method: "POST", credentials: "include" });
      const generated = await readResponse<{ testId: string }>(response);
      let secondsRemaining: number | null = null;
      if (kind === "mock-interview") {
        const startResponse = await fetch(`${API}/api/sql-learning/tests/${encodeURIComponent(generated.testId)}/interview/start`, { method: "POST", credentials: "include" });
        const timer = await readResponse<{ expiresAt: string }>(startResponse);
        secondsRemaining = Math.max(0, Math.ceil((new Date(timer.expiresAt).getTime() - Date.now()) / 1000));
      }
      const testResponse = await fetch(`${API}/api/sql-learning/tests/${encodeURIComponent(generated.testId)}`, { credentials: "include" });
      const test = await readResponse<PracticeTest>(testResponse);
      if (activeModule.topics[0]) await openTopic(activeModule.topics[0].id);
      setActiveTest(test);
      setInterviewSeconds(secondsRemaining);
      setActiveQuestionIndex(0);
      setPracticeSql("");
      setPracticeResult(null);
      setPracticeMessage("");
      setActiveTab("practice");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SQL assessment could not be generated.");
    } finally {
      setAssessmentBusy(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadDashboard(controller.signal)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load SQL Learning.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    fetch(`${API}/api/sql-learning/custom-curriculum`, { credentials: "include", signal: controller.signal })
      .then((response) => readResponse<{ created: boolean }>(response))
      .then((result) => setPersonalCurriculumCreated(result.created))
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Personal curriculum status could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (activeTest?.assessmentKind !== "interview" || interviewSeconds === null || interviewSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setInterviewSeconds((remaining) => remaining === null ? null : Math.max(remaining - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTest?.assessmentKind, interviewSeconds === null || interviewSeconds <= 0]);

  async function updateTopicStatus(topicId: string, status: TopicStatus) {
    setSavingTopic(topicId);
    setError("");
    try {
      const response = await fetch(`${API}/api/sql-learning/topics/${encodeURIComponent(topicId)}/status`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      await readResponse<{ ok: boolean; status: TopicStatus }>(response);
      await Promise.all([loadDashboard(), openModule(activeModule!.id)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Topic progress could not be saved.");
    } finally {
      setSavingTopic("");
    }
  }

  const visibleModules = useMemo(() => {
    const query = moduleSearch.trim().toLocaleLowerCase();
    return (dashboard?.modules || []).filter((module) => (customMode || !module.archived) && (!query || module.title.toLocaleLowerCase().includes(query)));
  }, [dashboard?.modules, moduleSearch, customMode]);
  const visibleTopics = useMemo(() => {
    const query = topicSearch.trim().toLocaleLowerCase();
    return (activeModule?.topics || []).filter((topic) => {
      if (topic.archived && (!customMode || topicFilter !== "archived")) return false;
      if (topicFilter === "archived" && !topic.archived) return false;
      if (hideCompleted && topic.progress.status === "completed") return false;
      if (topicFilter === "not_started" && topic.progress.status !== "not_started") return false;
      if (topicFilter === "in_progress" && topic.progress.status !== "in_progress") return false;
      if (topicFilter === "completed" && topic.progress.status !== "completed") return false;
      if (topicFilter === "studied" && !topic.progress.firstStudiedAt) return false;
      if (topicFilter === "practice_pending" && topic.progress.checklist.practiceTest1 && topic.progress.checklist.practiceTest2 && topic.progress.checklist.practiceTest3 && topic.progress.checklist.practiceTest4 && topic.progress.checklist.practiceTest5) return false;
      if (topicFilter === "mastered" && !topic.progress.checklist.mastered) return false;
      if (topicFilter === "revision" && !topic.revisionStatus) return false;
      return !query || topic.title.toLocaleLowerCase().includes(query);
    });
  }, [activeModule?.topics, topicSearch, topicFilter, hideCompleted, customMode]);
  const currentQuestion = activeTest?.questions[activeQuestionIndex];

  return <div className="studioShell sqlLearningShell">
    <StudioNavigation activePath="/sql-learning" refreshLabel="Refresh SQL Learning" onRefresh={() => {
      setLoading(true);
      void loadDashboard().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not refresh SQL Learning.")).finally(() => setLoading(false));
    }} />
    <main className="studioPage sqlLearningPage">
      <header className="sqlLearningHeader">
        <div>
          <span className="sqlLearningEyebrow"><BookOpen size={14} /> PERSONAL SQL CURRICULUM</span>
          <h1>SQL Learning</h1>
          <p>Work through the 24-module PostgreSQL-first SQL curriculum and track your own progress.</p>
        </div>
        <div className="sqlLearningHeaderActions">
          <button type="button" onClick={() => void loadLearningPlanner()}>Progress &amp; planner</button>
          <button type="button" onClick={() => void loadRevisionCenter()}>Revision Center</button>
          <button type="button" onClick={() => { setActivePage("curriculum"); setActiveModule(null); setActiveTopic(null); }}>Curriculum</button>
          <a href="/sql"><Layers3 size={15} /> Open SQL Lab <ArrowRight size={14} /></a>
        </div>
      </header>

      {error && <p className="sqlLearningError" role="alert">{error}</p>}

      {activePage === "analytics" ? <SqlLearningProgressPage
        analytics={analyticsData}
        planner={plannerData}
        topics={(dashboard?.modules || []).flatMap((module) => (module.topics || []).map((topic) => ({ ...topic, moduleTitle: module.title })))}
        onSave={saveLearningPlanner}
      /> : activePage === "revisions" ? <>
        <section className="sqlRevisionCenter">
          <div className="sqlModulesHeading"><div><h2>Revision Center</h2><p>Review saved topics and retain each completed revision session.</p></div></div>
          <section className="sqlLearningMetrics sqlRevisionMetrics">
            <article><span>TOPICS TO REVIEW</span><strong>{revisionData?.totalTopics ?? 0}</strong></article>
            <article><span>HIGH PRIORITY</span><strong>{revisionData?.highPriority ?? 0}</strong></article>
            <article><span>SESSIONS COMPLETED</span><strong>{revisionData?.completedSessions ?? 0}</strong></article>
            <article><span>DUE NOW</span><strong>{revisionData?.dueTopics ?? 0}</strong></article>
          </section>
          <section className="sqlRevisionAnalytics">
            <h3>Revision analytics <small>{revisionData?.analytics.sessionsAnalyzed ?? 0} recent sessions</small></h3>
            <div className="sqlRevisionAnalyticsMetrics">
              <article><span>AVERAGE SCORE CHANGE</span><strong>{revisionData?.analytics.averageScoreImprovement === null || revisionData?.analytics.averageScoreImprovement === undefined ? "—" : `${revisionData.analytics.averageScoreImprovement > 0 ? "+" : ""}${revisionData.analytics.averageScoreImprovement}%`}</strong></article>
              <article><span>IMPROVED</span><strong>{revisionData?.analytics.improvedSessions ?? 0}</strong></article>
              <article><span>DECLINED</span><strong>{revisionData?.analytics.declinedSessions ?? 0}</strong></article>
              <article><span>WEAK TOPICS</span><strong>{revisionData?.weakTopics ?? 0}</strong></article>
            </div>
            <h3>Recommended next revisions</h3>
            {revisionData?.recommendations.length ? <div className="sqlRevisionRecommendations">{revisionData.recommendations.map((item) => <article key={item.topicId}>
              <div><strong>{item.topicTitle}</strong><small>{item.moduleTitle} · {item.reason}</small></div>
              <button type="button" onClick={() => void startTopicRevision(item.topicId)}>Start revision</button>
            </article>)}</div> : <p className="sqlLearningEmpty">Mark topics for revision to get personalized recommendations.</p>}
          </section>
          <div className="sqlRevisionFilters" role="group" aria-label="Filter revisions">
            {["all", "pending", "in_progress", "completed", "high", "medium", "low", "weak", "mastered"].map((filter) =>
              <button type="button" className={revisionFilter === filter ? "active" : ""} key={filter} onClick={() => setRevisionFilter(filter)}>{filter.replace("_", " ")}</button>)}
          </div>
          <div className="sqlRevisionSchedule"><label>Suggested revision intervals (days)<input value={revisionIntervalsDraft} onChange={(event) => setRevisionIntervalsDraft(event.target.value)} aria-label="Revision intervals in days" /></label><button type="button" onClick={() => void saveRevisionIntervals()}>Save schedule</button></div>
          <div className="sqlRevisionList">
            {(revisionData?.revisions || []).filter((item) => {
              if (revisionFilter === "all") return true;
              if (["pending", "in_progress", "completed"].includes(revisionFilter)) return item.status === revisionFilter;
              if (["high", "medium", "low"].includes(revisionFilter)) return item.priority === revisionFilter;
              if (revisionFilter === "weak") return item.lastScore !== null && item.lastScore < 60;
              if (revisionFilter === "mastered") return item.lastScore !== null && item.lastScore >= 85;
              return true;
            }).map((item) => <article key={item.topicId}>
              <div><span className={`sqlRevisionPriority ${item.priority}`}>{item.priority.toUpperCase()}</span><strong>{item.topicTitle}</strong><small>{item.moduleTitle} · {item.reason.replace(/_/g, " ")}</small></div>
              <div><small>{item.revisionCount} completed revisions · {item.lastScore === null ? "No score yet" : `Latest score ${item.lastScore}%`}</small><button type="button" onClick={() => void startTopicRevision(item.topicId)}>Start Revision</button></div>
            </article>)}
            {!revisionData?.revisions.length && <p className="sqlLearningEmpty">No revision topics yet. Mark a topic for revision to start a queue.</p>}
          </div>
          {!!revisionData?.recentSessions.length && <section className="sqlRevisionHistory"><h3>Recent revision history</h3>{revisionData.recentSessions.map((session, index) => <article key={`${session.topicId}-${session.completedAt}-${index}`}><strong>{session.topicTitle}</strong><span>{new Date(session.completedAt).toLocaleString()}</span><small>{session.scoreBefore === null ? "First score" : `${session.scoreBefore}% → `}{session.scoreAfter}%</small></article>)}</section>}
        </section>
      </> : activeTopic ? <>
        <button className="sqlLearningBack" type="button" onClick={() => { setActiveTopic(null); setActiveTest(null); }}><ArrowLeft size={15} /> {activeModule?.title || "All modules"}</button>
        {topicLoading && <p className="sqlTopicRefreshing" role="status">Refreshing topic progress…</p>}
        <section className="sqlTopicDetail">
          <div className="sqlTopicDetailHeading">
            <div><span>MODULE {String(activeTopic.module.order).padStart(2, "0")} · TOPIC {String(activeTopic.topic.order).padStart(2, "0")}</span><h2>{activeTopic.topic.title}</h2><p>{activeTopic.module.title} · PostgreSQL practice · {activeTopic.progress.status.replace("_", " ")}</p>
              {activeTopic.progress.firstStudiedAt && <small className="sqlPreviouslyStudied">Previously studied · first studied {new Date(activeTopic.progress.firstStudiedAt).toLocaleDateString()}</small>}
            </div>
            <a href={`/sql${activeTopic.practiceDatabaseId ? `?databaseId=${encodeURIComponent(activeTopic.practiceDatabaseId)}` : ""}`}><Layers3 size={14} /> Open SQL Lab</a>
          </div>
          <section className="sqlLearningChecklist">
            <div className="sqlChecklistHeading"><div><h3>Personal learning checklist</h3><span>{activeTopic.progress.overallPercent}% complete</span></div>
              <button type="button" onClick={() => void toggleTopicBookmark()}>{activeTopic.bookmarked ? "Remove bookmark" : "Bookmark topic"}</button>
              {customMode && activeTopic.content && <button type="button" onClick={() => setCustomEditorOpen((open) => !open)}>{customEditorOpen ? "Close editor" : "Edit my lesson"}</button>}
            </div>
            <div className="sqlChecklistProgress">
              <span>Theory {activeTopic.progress.theoryPercent}%</span><span>Examples {activeTopic.progress.examplesPercent}%</span><span>Practice {activeTopic.progress.practicePercent}%</span>
            </div>
            <div className="sqlChecklistItems">
              {checklistItems.map((item) => <label key={item.key}>
                <input type="checkbox" checked={activeTopic.progress.checklist[item.key]} disabled={savingChecklist === item.key} onChange={(event) => void setChecklistItem(activeTopic.topic.id, item.key, event.target.checked)} />
                <span>{item.label}</span>
              </label>)}
            </div>
            <div className="sqlTopicActions">
              <select aria-label="Revision priority" value={revisionPriority} onChange={(event) => setRevisionPriority(event.target.value)}><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select>
              <select aria-label="Revision reason" value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)}>
                <option value="theory_not_clear">Theory not clear</option><option value="forgot_concept">Forgot concept</option><option value="low_test_score">Practice test score low</option><option value="coding_mistakes">Coding mistakes</option><option value="interview_preparation">Interview preparation</option><option value="manual_request">Manual request</option>
              </select>
              <button type="button" onClick={() => void markTopicForRevision()}>{activeTopic.revision ? "Update revision" : "Mark for revision"}</button>
              {activeTopic.revision?.status !== "in_progress" && <button type="button" disabled={!activeTopic.revision} onClick={() => void startTopicRevision(activeTopic.topic.id)}>Start revision</button>}
              {revisionSessionId && activeTest?.result.completed && <button type="button" onClick={() => void finishTopicRevision()}>Complete revision session</button>}
            </div>
            {activeTopic.revision && <p className="sqlRevisionStatus">Revision {activeTopic.revision.status} · {activeTopic.revision.revisionCount} completed sessions{activeTopic.revision.nextRevisionAt ? ` · next suggested ${new Date(activeTopic.revision.nextRevisionAt).toLocaleDateString()}` : ""}</p>}
          </section>
          {customEditorOpen && activeTopic.content && <section className="sqlCustomLessonEditor">
            <h3>Edit your personal lesson</h3>
            <label>Theory<textarea value={customTheoryDraft} onChange={(event) => setCustomTheoryDraft(event.target.value)} rows={10} /></label>
            <label>PostgreSQL syntax<textarea value={customSyntaxDraft} onChange={(event) => setCustomSyntaxDraft(event.target.value)} rows={4} /></label>
            <label>Five examples as JSON<textarea value={customExamplesDraft} onChange={(event) => setCustomExamplesDraft(event.target.value)} rows={16} /></label>
            <button type="button" onClick={() => void saveCustomLesson()}>Validate and save personal lesson</button>
            <button type="button" onClick={() => void restoreCustomLesson()}>Restore generated lesson</button>
          </section>}
          <section className="sqlPersonalNotes"><label>Personal topic notes<textarea value={topicNoteDraft} onChange={(event) => setTopicNoteDraft(event.target.value)} maxLength={10000} rows={3} placeholder="Save your own reminders and examples…" /></label><button type="button" onClick={() => void saveTopicNote()}>Save notes</button></section>
          <section className="sqlTopicTutor">
            <h3>SQL learning assistant</h3>
            <div><select aria-label="Tutor action" value={tutorAction} onChange={(event) => setTutorAction(event.target.value)}><option value="hint">Progressive hint</option><option value="explain">Explain concept/query</option><option value="debug">Debug SQL</option><option value="improve">Suggest improvements</option></select><input value={tutorQuestion} onChange={(event) => setTutorQuestion(event.target.value)} placeholder="What would you like help with?" /><button type="button" disabled={tutorBusy} onClick={() => void askTopicTutor()}>{tutorBusy ? "Thinking…" : "Ask SQL tutor"}</button></div>
            {tutorAnswer && <p>{tutorAnswer}</p>}
          </section>
          <nav className="sqlTopicTabs" aria-label="Topic sections">
            <button type="button" className={activeTab === "lesson" ? "active" : ""} onClick={() => { setActiveTab("lesson"); setActiveTest(null); }}>Lesson & examples</button>
            <button type="button" className={activeTab === "practice" ? "active" : ""} onClick={() => setActiveTab("practice")}>Practice tests</button>
          </nav>

          {activeTab === "lesson" && <>
            {!activeTopic.content ? <div className="sqlLearningNotice">
              <Sparkles size={16} /><p><strong>Lesson not generated yet.</strong> Generate theory and five worked examples for this topic. Each SQL example is executed against your own SQL Lab workspace before the lesson is saved.</p>
              <button type="button" disabled={contentGenerating || !activeTopic.practiceDatabaseId} onClick={() => void generateTopicContent()}>{contentGenerating ? "Generating and validating…" : "Generate validated lesson"}</button>
            </div> : <div className="sqlLessonContent">
              <article className="sqlLessonTheory">
                <h3>Topic overview</h3><SqlLessonRichText className="sqlLessonRichText" content={activeTopic.content.overview} />
                <h3>Detailed theory</h3><SqlLessonRichText className="sqlLessonRichText sqlLessonLongText" content={activeTopic.content.theory} />
                <h3>PostgreSQL syntax</h3><pre className="sqlLessonSyntax"><code>{lessonSyntaxText(activeTopic.content.syntax)}</code></pre>
                <h3>Parameters and return type</h3>
                {activeTopic.content.parameters.length > 0
                  ? <ul className="sqlLessonParameters">{activeTopic.content.parameters.map((parameter, index) => <li key={index}><SqlLessonRichText content={parameter} /></li>)}</ul>
                  : <p>No explicit parameters.</p>}
                <SqlLessonRichText className="sqlLessonReturnType" content={`**Return type:** ${activeTopic.content.returnType}`} />
                <div className="sqlLessonColumns">
                  <div><h3>Important rules</h3><ul>{activeTopic.content.rules.map((rule, index) => <li key={index}><SqlLessonRichText content={rule} /></li>)}</ul></div>
                  <div><h3>Common mistakes</h3><ul>{activeTopic.content.commonMistakes.map((mistake, index) => <li key={index}><SqlLessonRichText content={mistake} /></li>)}</ul></div>
                </div>
                <h3>Data engineering use cases</h3><ul>{activeTopic.content.useCases.map((useCase, index) => <li key={index}><SqlLessonRichText content={useCase} /></li>)}</ul>
                <h3>Interview relevance</h3><SqlLessonRichText className="sqlLessonRichText" content={activeTopic.content.interviewRelevance} />
                <h3>Dialect compatibility</h3><SqlLessonRichText className="sqlLessonRichText" content={activeTopic.content.dialectNotes} />
              </article>
              <section className="sqlExamples">
                <h3>Five worked examples</h3>
                {activeTopic.content.examples.map((example, index) => <article className="sqlExampleCard" key={`${example.level}-${index}`}>
                  <div className="sqlExampleHeading"><div><span>{example.level.replace("_", " ")}</span><h4>{example.title}</h4></div><a href={`/sql?databaseId=${encodeURIComponent(activeTopic.practiceDatabaseId || "")}&sql=${encodeURIComponent(example.sql)}`}><Layers3 size={13} /> Open in SQL Lab</a></div>
                  <div className="sqlLessonRichText"><p><strong>Problem:</strong></p><SqlLessonRichText content={example.problem} /></div>
                  <CodeMirror value={example.sql} extensions={[sql({ dialect: PostgreSQL })]} theme="dark" editable={false} basicSetup={{ lineNumbers: true, foldGutter: false }} />
                  <SqlLessonRichText className="sqlLessonRichText" content={example.explanation} />
                  <ul>{example.observations.map((observation, observationIndex) => <li key={observationIndex}><SqlLessonRichText content={observation} /></li>)}</ul>
                  <div className="sqlExampleActions"><button type="button" disabled={practiceBusy} onClick={() => { setPracticeSql(example.sql); setPracticeResult(null); void runExample(example.sql, example.level); }}><Play size={14} /> Run example</button></div>
                  {practiceResult && practiceSql === example.sql && <SqlResultPanel result={practiceResult} message={practiceMessage} />}
                  {practiceMessage && practiceSql === example.sql && !practiceResult && <p className="sqlPracticeMessage error">{practiceMessage}</p>}
                  <details className="sqlExpectedOutput"><summary>Validated expected output ({example.expected.rowCount} rows)</summary><SqlResultPanel result={example.expected} /></details>
                </article>)}
              </section>
            </div>}
            <SqlPracticeWorkspaceContext topic={activeTopic} />
          </>}

          {activeTab === "practice" && <section className="sqlPracticeTests">
            <SqlPracticeWorkspaceContext topic={activeTopic} />
            {!activeTest ? <>
              <div><h3>Topic practice tests</h3><p>Each test is generated on demand. A test is available only after all 15 SQL solutions execute successfully against your PostgreSQL workspace.</p></div>
              <div className="sqlTestCards">{activeTopic.tests.map((test) => <article key={test.testNumber}>
                <span>TEST {test.testNumber}</span><strong>{test.status === "ready" ? `${test.questionCount} validated questions` : "Not generated"}</strong>
                {test.status === "ready" && test.result.answeredQuestions > 0 && <small className={test.result.completed ? "sqlTestCardProgress isComplete" : "sqlTestCardProgress"}>
                  {test.result.completed ? "Completed" : "In progress"} · {test.result.answeredQuestions}/{test.result.totalQuestions} submitted · {test.result.correctAnswers} correct · {test.result.score}% score
                </small>}
                {test.status === "ready" ? <button type="button" onClick={() => void openPracticeTest(activeTopic.topic.id, test.testNumber)}>{test.result.completed ? "Review / retake" : test.result.answeredQuestions ? "Continue test" : "Start test"}</button>
                  : <button type="button" disabled={testGenerating !== 0 || !activeTopic.practiceDatabaseId} onClick={() => void generatePracticeTest(test.testNumber)}>{testGenerating === test.testNumber ? "Generating and validating…" : "Generate validated test"}</button>}
              </article>)}</div>
            </> : <>
              <button className="sqlLearningBack" type="button" onClick={() => setActiveTest(null)}><ArrowLeft size={14} /> All tests</button>
              <div className="sqlTestHeading"><div><span>{activeTest.assessmentKind === "interview" ? "45-MINUTE SQL MOCK INTERVIEW" : `${activeTest.assessmentKind === "module" ? "MODULE ASSESSMENT" : `TEST ${activeTest.testNumber}`} · ${activeTest.questions.length} QUESTIONS`}</span><h3>{activeTest.assessmentKind === "interview" ? `${activeTopic.module.title} · SQL Interview` : activeTest.assessmentKind === "module" ? activeTopic.module.title : activeTopic.topic.title}</h3></div><small>{activeTest.assessmentKind === "interview" && interviewSeconds !== null ? `${interviewSeconds === 0 ? "Time expired" : `${String(Math.floor(interviewSeconds / 60)).padStart(2, "0")}:${String(interviewSeconds % 60).padStart(2, "0")} remaining`} · ` : ""}{activeTest.result.answeredQuestions}/{activeTest.result.totalQuestions} answered · {activeTest.result.correctAnswers} correct · {activeTest.result.score}% score</small></div>
              <section className="sqlTestScore" aria-label="Practice test result">
                <strong>{activeTest.result.completed ? "Test completed" : "Test in progress"}</strong>
                <span>Score {activeTest.result.score}%</span><span>Accuracy {activeTest.result.accuracy}%</span>
                <span>{activeTest.result.incorrectAnswers} incorrect</span><span>{activeTest.result.skippedQuestions} unanswered</span>
              </section>
              {currentQuestion && <article className="sqlQuestionCard">
                <div className="sqlQuestionStepper">
                  {activeTest.questions.map((question, index) => <button key={question.id} type="button" aria-label={`Question ${index + 1}`} className={`${index === activeQuestionIndex ? "active" : ""} ${activeTest.questionResults.find((result) => result.questionId === question.id)?.correct ? "correct" : ""}`} onClick={() => { setActiveQuestionIndex(index); setPracticeSql(""); setPracticeResult(null); setPracticeMessage(""); setEditingTestQuestion(false); }}>{index + 1}</button>)}
                </div>
                <span className="sqlQuestionDifficulty">{currentQuestion.difficulty}</span><h4>{currentQuestion.title}</h4>
                <p>{currentQuestion.context}</p><div className="sqlQuestionTask"><strong>Task</strong><p>{currentQuestion.task}</p><small>{currentQuestion.required_output}</small></div>
                <CodeMirror value={practiceSql} extensions={[sql({ dialect: PostgreSQL })]} theme="dark" onChange={setPracticeSql} basicSetup={{ lineNumbers: true, foldGutter: false }} />
                <div className="sqlPracticeActions">
                  <button type="button" disabled={!practiceSql.trim() || practiceBusy || (activeTest.assessmentKind === "interview" && interviewSeconds === 0)} onClick={() => void runExample(practiceSql)}><Play size={14} /> Run query</button>
                  <button type="button" disabled={!practiceSql.trim() || practiceBusy || (activeTest.assessmentKind === "interview" && interviewSeconds === 0)} onClick={() => void submitPracticeAnswer()}><Send size={14} /> Submit answer</button>
                  <button type="button" disabled={practiceBusy} onClick={() => { setPracticeSql(""); setPracticeResult(null); setPracticeMessage(""); }}>Reset SQL</button>
                  <button type="button" onClick={() => setVisibleHints((current) => ({ ...current, [currentQuestion.id]: !current[currentQuestion.id] }))}><Lightbulb size={14} /> Hint</button>
                  <button type="button" onClick={() => void revealPracticeSolution()}><Eye size={14} /> Show solution</button>
                  {customMode && <button type="button" onClick={() => void beginCustomQuestionEdit()}>Edit my question</button>}
                </div>
                {visibleHints[currentQuestion.id] && <p className="sqlQuestionHint">{currentQuestion.hint}</p>}
                {editingTestQuestion && customQuestionDraft && <section className="sqlCustomQuestionEditor">
                  <h4>Edit personal question</h4>
                  <label>Difficulty<select value={customQuestionDraft.difficulty} onChange={(event) => setCustomQuestionDraft((draft) => draft ? { ...draft, difficulty: event.target.value as EditableQuestion["difficulty"] } : draft)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
                  {([
                    ["title", "Title"], ["context", "Context"], ["task", "Task"], ["required_output", "Required output"],
                    ["reference_sql", "Validated reference SQL"], ["hint", "Hint"], ["explanation", "Explanation"]
                  ] as const).map(([field, label]) => <label key={field}>{label}<textarea value={customQuestionDraft[field]} onChange={(event) => setCustomQuestionDraft((draft) => draft ? { ...draft, [field]: event.target.value } : draft)} rows={field === "reference_sql" ? 6 : 3} /></label>)}
                  <button type="button" onClick={() => void saveCustomQuestion()}>Validate SQL and save</button><button type="button" onClick={() => setEditingTestQuestion(false)}>Cancel</button>
                </section>}
                {visibleSolutions[currentQuestion.id] && <div className="sqlQuestionSolution">
                  <strong>Validated reference solution</strong>
                  <CodeMirror value={visibleSolutions[currentQuestion.id].sql} extensions={[sql({ dialect: PostgreSQL })]} theme="dark" editable={false} basicSetup={{ lineNumbers: true, foldGutter: false }} />
                  <p>{visibleSolutions[currentQuestion.id].explanation}</p>
                  <SqlResultPanel result={visibleSolutions[currentQuestion.id].expected} message="Expected result" />
                </div>}
                {practiceMessage && <p className={`sqlPracticeMessage ${practiceResult?.correct ? "success" : practiceResult ? "error" : ""}`}>{practiceMessage}</p>}
                {practiceResult && <SqlResultPanel result={practiceResult} />}
                <div className="sqlQuestionNav"><button type="button" disabled={activeQuestionIndex === 0} onClick={() => { setActiveQuestionIndex((index) => index - 1); setPracticeSql(""); setPracticeResult(null); setPracticeMessage(""); setEditingTestQuestion(false); }}>Previous</button><button type="button" disabled={activeQuestionIndex >= activeTest.questions.length - 1} onClick={() => { setActiveQuestionIndex((index) => index + 1); setPracticeSql(""); setPracticeResult(null); setPracticeMessage(""); setEditingTestQuestion(false); }}>Next</button></div>
              </article>}
            </>}
          </section>}
        </section>
      </> : activeModule ? <>
        <button className="sqlLearningBack" type="button" onClick={() => setActiveModule(null)}><ArrowLeft size={15} /> All modules</button>
        <section className="sqlModuleDetail">
          <div className="sqlModuleHeading">
            <div><span>MODULE {String(activeModule.order).padStart(2, "0")}</span>{customMode ? <div className="sqlCustomModuleEditor"><input value={moduleTitleDraft || activeModule.title} onChange={(event) => setModuleTitleDraft(event.target.value)} aria-label="Personal module title" /><input value={moduleDescriptionDraft} onChange={(event) => setModuleDescriptionDraft(event.target.value)} placeholder="Module description" aria-label="Personal module description" /><select value={moduleDifficultyDraft} onChange={(event) => setModuleDifficultyDraft(event.target.value)} aria-label="Module difficulty"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div> : <h2>{activeModule.title}</h2>}</div>
            <label className="sqlSearch"><Search size={15} /><input aria-label="Search topics" value={topicSearch} onChange={(event) => setTopicSearch(event.target.value)} placeholder="Search topics" /></label>
          </div>
          <div className="sqlModuleActions">
            <button type="button" disabled={assessmentBusy || !dashboard?.practiceDatabaseId} onClick={() => void generateSqlAssessment("assessment")}>{assessmentBusy ? "Preparing 30-question assessment…" : "Module assessment (30 questions)"}</button>
            <button type="button" disabled={assessmentBusy || !dashboard?.practiceDatabaseId} onClick={() => void generateSqlAssessment("mock-interview")}>{assessmentBusy ? "Preparing mock interview…" : "Full SQL mock interview (45 min)"}</button>
            {customMode && <><button type="button" onClick={() => void saveCustomModuleTitle()}>Save module changes</button><button type="button" disabled={activeModule.order <= 1} onClick={() => void reorderCustomModule(activeModule.id, activeModule.order - 1)}>Move up</button><button type="button" disabled={activeModule.order >= (dashboard?.modules.length || 0)} onClick={() => void reorderCustomModule(activeModule.id, activeModule.order + 1)}>Move down</button><button type="button" onClick={() => void duplicateCustomModule(activeModule.id)}>Duplicate module</button><button type="button" onClick={() => void fetch(`${API}/api/sql-learning/custom-curriculum/modules/${encodeURIComponent(activeModule.id)}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: !activeModule.archived }) }).then(readResponse).then(() => loadDashboard(undefined, true)).catch((cause) => setError(cause instanceof Error ? cause.message : "Module archive could not be changed."))}>{activeModule.archived ? "Restore module" : "Archive module"}</button></>}
          </div>
          <div className="sqlTopicFilters">
            <label>Filter topics<select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}><option value="all">All topics</option><option value="not_started">Not started</option><option value="studied">Studied</option><option value="in_progress">In progress</option><option value="practice_pending">Practice pending</option><option value="completed">Completed</option><option value="mastered">Mastered</option><option value="revision">Revision required</option>{customMode && <option value="archived">Archived personal topics</option>}</select></label>
            <label><input type="checkbox" checked={hideCompleted} onChange={(event) => setHideCompleted(event.target.checked)} /> Hide completed</label>
          </div>
          {customMode && <form className="sqlAddTopicForm" onSubmit={(event) => { event.preventDefault(); void addCustomTopic(); }}><input value={newTopicTitle} onChange={(event) => setNewTopicTitle(event.target.value)} maxLength={160} placeholder="New personal topic" /><button type="submit" disabled={!newTopicTitle.trim()}>Add topic</button></form>}
          {moduleLoading ? <p className="sqlLearningLoading">Loading topics…</p> : <div className="sqlTopicList">
            {visibleTopics.map((topic) => <article className={`sqlTopicRow status-${topic.progress.status}`} key={topic.id}>
              <button className="sqlTopicTitle" type="button" onClick={() => void openTopic(topic.id)}><span>{String(topic.order).padStart(2, "0")}</span><strong>{topic.title}</strong><ArrowRight size={14} /></button>
              <div className="sqlTopicProgress">
                {topic.bookmarked && <small>Bookmarked</small>}
                {topic.revisionStatus && <small className="sqlRevisionBadge">Revision {topic.revisionStatus}</small>}
                {topic.progress.completionPercent > 0 && <small>{topic.progress.completionPercent}% checklist</small>}
                {topic.progress.lastStudiedAt && <small>Last studied {new Date(topic.progress.lastStudiedAt).toLocaleDateString()}</small>}
                <label>
                  <span className="srOnly">Progress for {topic.title}</span>
                  <select value={topic.progress.status} disabled={savingTopic === topic.id} onChange={(event) => void updateTopicStatus(topic.id, event.target.value as TopicStatus)}>
                    {(Object.keys(statusLabels) as TopicStatus[]).map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}
                  </select>
                </label>
                {customMode && <><button type="button" onClick={() => { const title = window.prompt("Personal topic name", topic.title); if (title?.trim() && title.trim() !== topic.title) void saveCustomTopic(topic, { title: title.trim() }); }}>Rename</button><button type="button" onClick={() => void editCustomTopicDetails(topic)}>Details</button><button type="button" onClick={() => void moveCustomTopic(topic)}>Move</button><button type="button" disabled={topic.order <= 1} onClick={() => void saveCustomTopic(topic, { order: topic.order - 1 })}>↑</button><button type="button" disabled={topic.order >= activeModule.topics.length} onClick={() => void saveCustomTopic(topic, { order: topic.order + 1 })}>↓</button><button type="button" onClick={() => void duplicateCustomTopic(activeModule.id, topic.id)}>Duplicate</button><button type="button" onClick={() => void saveCustomTopic(topic, { archived: !topic.archived })}>{topic.archived ? "Restore" : "Archive"}</button></>}
              </div>
            </article>)}
            {!visibleTopics.length && <p className="sqlLearningEmpty">No topics match this search.</p>}
          </div>}
        </section>
      </> : <>
        <section className="sqlLearningMetrics" aria-label="SQL Learning progress summary">
          <article><span>MODULES</span><strong>{loading ? "—" : dashboard?.totalModules ?? 0}</strong><small>Curriculum modules</small></article>
          <article><span>TOPICS</span><strong>{loading ? "—" : dashboard?.totalTopics ?? 0}</strong><small>Topics in the curriculum</small></article>
          <article><span>COMPLETED</span><strong>{loading ? "—" : dashboard?.completedTopics ?? 0}</strong><small>Topics marked completed</small></article>
          <article><span>IN PROGRESS</span><strong>{loading ? "—" : dashboard?.inProgressTopics ?? 0}</strong><small>Topics you have started</small></article>
        </section>
        <section className="sqlModulesSection">
          <div className="sqlModulesHeading">
            <div><h2>{customMode ? "My Custom Curriculum" : "Curriculum"}</h2><p>{dashboard?.completionPercent ?? 0}% complete · {dashboard?.remainingTopics ?? 0} topics remaining</p></div>
            <label className="sqlSearch"><Search size={15} /><input aria-label="Search modules" value={moduleSearch} onChange={(event) => setModuleSearch(event.target.value)} placeholder="Search modules" /></label>
          </div>
          <div className="sqlCurriculumActions">
            {personalCurriculumCreated
              ? <><button type="button" className={customMode ? "active" : ""} onClick={() => { setCustomMode(true); void loadDashboard(undefined, true); }}>My Custom Curriculum</button><button type="button" className={!customMode ? "active" : ""} onClick={() => { setCustomMode(false); setActiveModule(null); setActiveTopic(null); void loadDashboard(undefined, false); }}>Official Curriculum</button>{customMode && <button type="button" onClick={() => void resetPersonalCurriculum()}>Restore official copy</button>}</>
              : <><span>Official curriculum</span><button type="button" onClick={() => void createPersonalCurriculum()}>Create my editable copy</button></>}
          </div>
          {customMode && <form className="sqlAddTopicForm" onSubmit={(event) => { event.preventDefault(); void addCustomModule(); }}><input value={newModuleTitle} onChange={(event) => setNewModuleTitle(event.target.value)} maxLength={120} placeholder="New personal module" /><button type="submit" disabled={!newModuleTitle.trim()}>Add module</button></form>}
          {loading ? <p className="sqlLearningLoading">Loading curriculum…</p> : <div className="sqlModuleGrid">
            {visibleModules.map((module) => <button className="sqlModuleCard" type="button" key={module.id} onClick={() => void openModule(module.id)}>
              <div className="sqlModuleCardTop"><span>MODULE {String(module.order).padStart(2, "0")}</span><ArrowRight size={15} /></div>
              <h3>{module.title}</h3>
              <p>{module.topicCount} topics · {module.completedTopics} completed · {module.inProgressTopics} in progress</p>
              <div className="sqlProgressTrack" role="progressbar" aria-label={`${module.title} completion`} aria-valuenow={module.completionPercent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${module.completionPercent}%` }} /></div>
              <small>{module.completionPercent}% complete <span>{module.remainingTopics} remaining</span></small>
            </button>)}
            {!visibleModules.length && <p className="sqlLearningEmpty">No modules match this search.</p>}
          </div>}
        </section>
        <p className="sqlLearningFootnote"><CheckCircle2 size={14} /> Your topic status is saved to your account. Opening a module does not change progress.</p>
      </>}
    </main>
  </div>;
}

function SqlLearningProgressPage({ analytics, planner, topics, onSave }: {
  analytics: SqlLearningAnalytics | null;
  planner: PlannerData | null;
  topics: { id: string; title: string; order: number; moduleTitle: string }[];
  onSave: (planner: { dailyGoalMinutes: number; weeklyStudyDaysGoal: number; tasks: { id?: string; topicId: string; targetDate: string | null; status: "planned" | "completed" }[] }) => Promise<PlannerData>;
}) {
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(30);
  const [weeklyStudyDaysGoal, setWeeklyStudyDaysGoal] = useState(5);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [topicId, setTopicId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!planner) return;
    setDailyGoalMinutes(planner.dailyGoalMinutes);
    setWeeklyStudyDaysGoal(planner.weeklyStudyDaysGoal);
    setTasks(planner.tasks);
  }, [planner]);

  async function persist(nextTasks = tasks) {
    setSaving(true);
    setMessage("");
    try {
      const saved = await onSave({
        dailyGoalMinutes,
        weeklyStudyDaysGoal,
        tasks: nextTasks.map(({ id, topicId: plannedTopicId, targetDate: plannedDate, status }) => ({
          id,
          topicId: plannedTopicId,
          targetDate: plannedDate,
          status
        }))
      });
      setTasks(saved.tasks);
      setMessage("Planner saved.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Planner could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topicId) return;
    const next = [...tasks, { topicId, title: topics.find((topic) => topic.id === topicId)?.title || "SQL topic", targetDate: targetDate || null, status: "planned" as const, id: crypto.randomUUID() }];
    setTasks(next);
    void persist(next);
    setTargetDate("");
  }

  const topicModules = new Map(topics.map((topic) => [topic.id, topic.moduleTitle]));
  const dueTasks = tasks.filter((task) => task.status === "planned").sort((left, right) => (left.targetDate || "9999").localeCompare(right.targetDate || "9999"));
  const todayKey = new Date().toISOString().slice(0, 10);
  return <section className="sqlProgressPlanner">
    <div className="sqlModulesHeading"><div><h2>Progress, analytics &amp; learning planner</h2><p>Review saved SQL Learning activity and plan the next study sessions.</p></div></div>
    {!analytics || !planner ? <p className="sqlLearningLoading">Loading your learning record…</p> : <>
      <div className="sqlLearningMetrics sqlProgressMetrics">
        <article><span>CURRICULUM COMPLETE</span><strong>{analytics.completionPercent}%</strong><small>{analytics.completedTopics} of {analytics.totalTopics} topics</small></article>
        <article><span>ANSWER ACCURACY</span><strong>{analytics.accuracy === null ? "—" : `${analytics.accuracy}%`}</strong><small>{analytics.correctAnswers} correct of {analytics.questionsAnswered} latest answers</small></article>
        <article><span>LEARNING STREAK</span><strong>{analytics.currentStreak} days</strong><small>Longest: {analytics.longestStreak} days</small></article>
        <article><span>ACTIVE DAYS</span><strong>{analytics.activeDaysLast30} / 30</strong><small>{analytics.activeDays} tracked days all time</small></article>
      </div>
      <section className="sqlAnalyticsActivity">
        <h3>Daily activity <small>Last 30 days · UTC</small></h3>
        <div className="sqlActivityGrid" role="list" aria-label="Daily SQL Learning activity for the last 30 days">
          {analytics.dailyActivity.map((day) => <span role="listitem" key={day.date} title={`${day.date}: ${day.activityCount} learning activities`} aria-label={`${day.date}: ${day.activityCount} activities`} className={day.activityCount ? `level-${Math.min(4, day.activityCount)}` : ""} />)}
        </div>
        <div className="sqlActivityLegend"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={level ? `level-${level}` : ""} />)}<span>More</span></div>
      </section>
      <section className="sqlAnalyticsModules">
        <h3>Module completion</h3>
        <div>{analytics.modules.map((module) => <article key={module.moduleId}>
          <div><strong>{module.title}</strong><small>{module.completedTopics}/{module.totalTopics} topics · {module.completionPercent}%</small></div>
          <div className="sqlProgressTrack" role="progressbar" aria-label={`${module.title} completion`} aria-valuenow={module.completionPercent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${module.completionPercent}%` }} /></div>
        </article>)}</div>
      </section>
      <section className="sqlPlanner">
        <div className="sqlPlannerHeading"><div><h3>Learning planner</h3><p>Set a realistic goal and schedule topics. Planner entries are private to your account.</p></div></div>
        <div className="sqlPlannerGoals">
          <label>Daily goal (minutes)<input type="number" min={5} max={480} value={dailyGoalMinutes} onChange={(event) => setDailyGoalMinutes(Number(event.target.value))} /></label>
          <label>Study days per week<input type="number" min={1} max={7} value={weeklyStudyDaysGoal} onChange={(event) => setWeeklyStudyDaysGoal(Number(event.target.value))} /></label>
          <button type="button" disabled={saving || dailyGoalMinutes < 5 || dailyGoalMinutes > 480 || weeklyStudyDaysGoal < 1 || weeklyStudyDaysGoal > 7} onClick={() => void persist()}>Save goals</button>
          <small>{analytics.activeDaysLast7} of {weeklyStudyDaysGoal} weekly study days active</small>
        </div>
        <form className="sqlPlannerAdd" onSubmit={addTask}>
          <label>Topic<select value={topicId} onChange={(event) => setTopicId(event.target.value)} required><option value="">Select a topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.moduleTitle} · {topic.title}</option>)}</select></label>
          <label>Target date<input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>
          <button type="submit" disabled={saving || !topicId}>Add to plan</button>
        </form>
        {message && <p className="sqlPlannerMessage" role="status">{message}</p>}
        {!dueTasks.length ? <p className="sqlLearningEmpty">Your plan is clear. Add a topic when you’re ready to schedule study time.</p> : <div className="sqlPlannerTasks">
          {dueTasks.map((task) => <article key={task.id}>
            <label><input type="checkbox" checked={false} disabled={saving} onChange={() => void persist(tasks.map((item) => item.id === task.id ? { ...item, status: "completed" } : item))} /><span><strong>{task.title}</strong><small>{topicModules.get(task.topicId) || "SQL Learning"}{task.targetDate ? ` · Due ${task.targetDate}` : " · No target date"}{task.targetDate && task.targetDate < todayKey ? " · Overdue" : ""}</small></span></label>
            <button type="button" disabled={saving} onClick={() => void persist(tasks.filter((item) => item.id !== task.id))}>Remove</button>
          </article>)}
        </div>}
        {!!tasks.filter((task) => task.status === "completed").length && <p className="sqlPlannerCompleted">{tasks.filter((task) => task.status === "completed").length} planned topics completed</p>}
      </section>
    </>}
  </section>;
}

function SqlPracticeWorkspaceContext({ topic }: { topic: TopicDetail }) {
  const schema = topic.schema;
  return <section className="sqlSampleSchema sqlPracticeWorkspace" aria-label="Practice database schema and sample data">
    <div className="sqlWorkspaceHeading">
      <div>
        <h3>Practice database and dataset</h3>
        {schema && <p><strong>{topic.practiceDatabaseName || schema.schemaName}</strong> · PostgreSQL schema <code>{schema.schemaName}</code></p>}
      </div>
      {topic.practiceDatabaseId && <a href={`/sql?databaseId=${encodeURIComponent(topic.practiceDatabaseId)}`}><Layers3 size={13} /> Open full dataset in SQL Lab</a>}
    </div>
    {!schema ? <p>Create a SQL Lab workspace to load sample data and run practice queries.</p> : <>
      <p className="sqlWorkspaceHint">All tables and columns in this practice workspace are listed below. Expand a table to preview up to five rows; use SQL Lab to query the complete dataset.</p>
      {!schema.tables.length ? <p>No tables are available in this workspace yet.</p> : <div className="sqlSchemaGrid">
        {schema.tables.map((table) => {
          const sample = topic.samples.find((candidate) => candidate.name === table.name);
          return <article className="sqlSchemaTable" key={table.name}>
            <strong>{table.name}</strong>
            <small>{schema.schemaName}.{table.name}</small>
            <ul>{table.columns.map((column) => <li key={column.column_name}>
              <code>{column.column_name}</code> <span>{column.data_type}</span>
              {column.is_primary_key && <em>PK</em>}
              {column.is_nullable === "NO" && <em>NOT NULL</em>}
              {column.column_default && <span className="sqlSchemaDefault">default: {column.column_default}</span>}
            </li>)}</ul>
            {sample ? <details><summary>Preview sample data ({sample.preview.rows.length} rows)</summary><SqlResultPanel result={sample.preview} /></details> : <small>Sample preview unavailable for this table.</small>}
          </article>;
        })}
      </div>}
      {schema.relationships.length > 0 && <div className="sqlSchemaRelationships">
        <strong>Foreign-key relationships</strong>
        <ul>{schema.relationships.map((relationship) => <li key={relationship.constraint_name}>
          <code>{relationship.table_name}.{relationship.column_name}</code> references <code>{relationship.foreign_table_name}.{relationship.foreign_column_name}</code>
        </li>)}</ul>
      </div>}
    </>}
  </section>;
}

function SqlResultPanel({ result, message }: { result: SqlResult; message?: string }) {
  return <div className="sqlResultPanel">
    {message && <p>{message}</p>}
    <div className="sqlResultMeta">{result.rowCount} rows · {result.executionMs} ms</div>
    {!result.columns.length ? <p>Query executed successfully.</p> : <div className="sqlResultTableWrap"><table><thead><tr>{result.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>
      {result.rows.map((row, index) => <tr key={index}>{result.columns.map((column) => <td key={column}>{String(row[column] ?? "NULL")}</td>)}</tr>)}
    </tbody></table></div>}
  </div>;
}
