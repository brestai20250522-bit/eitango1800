import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Home,
  ListChecks,
  Play,
  RotateCcw,
  Target,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import wordsData from "./data/words.json";
import { createQuizSession, selectSessionWords } from "./lib/quiz";
import { applyAnswer } from "./lib/review";
import { getAppStats, type AppStats, type UnitStat } from "./lib/stats";
import { loadProgress, resetProgress, saveProgress } from "./lib/storage";
import type { ProgressMap, QuizQuestion, SessionKind, Word } from "./types";

type View = "home" | "quiz" | "units" | "weak" | "progress";
type SessionLimit = 10 | 20 | 50;
type SessionMeta = {
  kind: SessionKind;
  title: string;
  unit?: string;
};
type AnswerState = {
  selected: string;
  isCorrect: boolean;
} | null;
type SessionResult = {
  correct: number;
  wrong: number;
};

const words = wordsData as Word[];
const SESSION_LIMITS: SessionLimit[] = [10, 20, 50];
const AUTO_ADVANCE_DELAY_MS = 800;

function pct(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function App() {
  const [progress, setProgress] = useState<ProgressMap>(() => loadProgress(words));
  const [view, setView] = useState<View>("home");
  const [sessionLimit, setSessionLimit] = useState<SessionLimit>(10);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null);
  const [session, setSession] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult>({ correct: 0, wrong: 0 });
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => getAppStats(words, progress, nowMs), [progress, nowMs]);

  function goHome() {
    setView("home");
  }

  function startSession(kind: SessionKind, unit?: string) {
    const title =
      kind === "review"
        ? "今日の復習"
        : kind === "new"
          ? "新しく学習"
          : kind === "weak"
            ? "苦手単語"
            : unit ?? "単元学習";
    const selectedWords = selectSessionWords(words, progress, {
      kind,
      unit,
      limit: sessionLimit,
      nowMs: Date.now(),
    });

    setSession(createQuizSession(selectedWords, words));
    setSessionMeta({ kind, title, unit });
    setCurrentIndex(0);
    setAnswerState(null);
    setSessionComplete(false);
    setSessionResult({ correct: 0, wrong: 0 });
    setView("quiz");
  }

  function chooseAnswer(answer: string) {
    const current = session[currentIndex];
    if (!current || answerState) {
      return;
    }
    const isCorrect = answer === current.correctAnswer;
    setAnswerState({ selected: answer, isCorrect });
    setSessionResult((result) => ({
      correct: result.correct + (isCorrect ? 1 : 0),
      wrong: result.wrong + (isCorrect ? 0 : 1),
    }));
    setProgress((currentProgress) => applyAnswer(currentProgress, current.word, isCorrect, Date.now()));
  }

  const nextQuestion = useCallback(() => {
    if (currentIndex + 1 >= session.length) {
      setSessionComplete(true);
      setAnswerState(null);
      setNowMs(Date.now());
      return;
    }
    setCurrentIndex((index) => index + 1);
    setAnswerState(null);
  }, [currentIndex, session.length]);

  useEffect(() => {
    if (!answerState || view !== "quiz" || sessionComplete) {
      return;
    }

    const timer = window.setTimeout(nextQuestion, AUTO_ADVANCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [answerState, nextQuestion, sessionComplete, view]);

  function clearProgress() {
    const confirmed = window.confirm("学習データをリセットしますか？");
    if (!confirmed) {
      return;
    }
    resetProgress();
    setProgress({});
    setNowMs(Date.now());
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={goHome} type="button" aria-label="ホーム" title="ホーム">
          <BookOpen aria-hidden="true" />
          <span>
            <strong>英単語1800</strong>
            <small>PWA</small>
          </span>
        </button>
        <nav className="top-nav" aria-label="メイン">
          <button className={view === "home" ? "nav-button active" : "nav-button"} onClick={goHome} type="button">
            <Home aria-hidden="true" />
            <span>ホーム</span>
          </button>
          <button
            className={view === "units" ? "nav-button active" : "nav-button"}
            onClick={() => setView("units")}
            type="button"
          >
            <ListChecks aria-hidden="true" />
            <span>単元</span>
          </button>
          <button
            className={view === "progress" ? "nav-button active" : "nav-button"}
            onClick={() => setView("progress")}
            type="button"
          >
            <BarChart3 aria-hidden="true" />
            <span>進捗</span>
          </button>
        </nav>
      </header>

      <main>
        {view === "home" && (
          <HomeView
            stats={stats}
            sessionLimit={sessionLimit}
            setSessionLimit={setSessionLimit}
            startSession={startSession}
            setView={setView}
          />
        )}
        {view === "units" && <UnitsView stats={stats} startSession={startSession} />}
        {view === "weak" && <WeakWordsView progress={progress} startSession={startSession} />}
        {view === "progress" && <ProgressView stats={stats} clearProgress={clearProgress} />}
        {view === "quiz" && (
          <QuizView
            session={session}
            meta={sessionMeta}
            currentIndex={currentIndex}
            answerState={answerState}
            sessionComplete={sessionComplete}
            sessionResult={sessionResult}
            chooseAnswer={chooseAnswer}
            goHome={goHome}
          />
        )}
      </main>
    </div>
  );
}

function HomeView({
  stats,
  sessionLimit,
  setSessionLimit,
  startSession,
  setView,
}: {
  stats: AppStats;
  sessionLimit: SessionLimit;
  setSessionLimit: (limit: SessionLimit) => void;
  startSession: (kind: SessionKind, unit?: string) => void;
  setView: (view: View) => void;
}) {
  const newCount = stats.total - stats.attempted;

  return (
    <div className="view-stack">
      <section className="toolbar-band" aria-label="出題数">
        <span className="toolbar-label">出題数</span>
        <div className="segmented" role="group" aria-label="出題数">
          {SESSION_LIMITS.map((limit) => (
            <button
              className={sessionLimit === limit ? "segment active" : "segment"}
              key={limit}
              onClick={() => setSessionLimit(limit)}
              type="button"
            >
              {limit}問
            </button>
          ))}
        </div>
      </section>

      <section className="action-grid" aria-label="学習メニュー">
        <ActionButton
          accent="teal"
          count={stats.due}
          icon={<CalendarCheck aria-hidden="true" />}
          label="今日の復習"
          onClick={() => startSession("review")}
        />
        <ActionButton
          accent="amber"
          count={newCount}
          icon={<Play aria-hidden="true" />}
          label="新しく学習"
          onClick={() => startSession("new")}
        />
        <ActionButton
          accent="blue"
          count={stats.units.length}
          icon={<ListChecks aria-hidden="true" />}
          label="単元選択"
          onClick={() => setView("units")}
        />
        <ActionButton
          accent="rose"
          count={stats.weak}
          icon={<Target aria-hidden="true" />}
          label="苦手単語"
          onClick={() => setView("weak")}
        />
      </section>

      <section className="stats-strip" aria-label="進捗サマリー">
        <Metric label="学習済み" value={`${stats.attempted}`} suffix={`/ ${stats.total}`} />
        <Metric label="定着" value={`${stats.mastered}`} suffix="語" />
        <Metric label="予約中" value={`${stats.scheduled}`} suffix="語" />
        <Metric label="正答率" value={`${stats.accuracy}`} suffix="%" />
      </section>
    </div>
  );
}

function ActionButton({
  accent,
  count,
  icon,
  label,
  onClick,
}: {
  accent: "teal" | "amber" | "blue" | "rose";
  count: number;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`action-button ${accent}`} onClick={onClick} type="button">
      <span className="action-icon">{icon}</span>
      <span className="action-copy">
        <strong>{label}</strong>
        <span>{count}</span>
      </span>
      <ChevronRight aria-hidden="true" />
    </button>
  );
}

function Metric({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {value}
        <small>{suffix}</small>
      </strong>
    </div>
  );
}

function UnitsView({ stats, startSession }: { stats: AppStats; startSession: (kind: SessionKind, unit?: string) => void }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h1>単元選択</h1>
          <p>{stats.units.length}単元</p>
        </div>
      </div>
      <div className="unit-list">
        {stats.units.map((unit) => (
          <UnitRow key={unit.unit} unit={unit} startSession={startSession} />
        ))}
      </div>
    </section>
  );
}

function UnitRow({ unit, startSession }: { unit: UnitStat; startSession: (kind: SessionKind, unit?: string) => void }) {
  const masteredPct = pct(unit.mastered, unit.total);

  return (
    <article className="unit-row">
      <div className="unit-main">
        <div className="unit-title">
          <strong>{unit.unit}</strong>
          <span>{unit.total}語</span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${masteredPct}%` }} />
        </div>
      </div>
      <div className="unit-numbers">
        <span>復習 {unit.due}</span>
        <span>苦手 {unit.weak}</span>
        <span>定着 {unit.mastered}</span>
      </div>
      <button className="icon-command" onClick={() => startSession("unit", unit.unit)} type="button" aria-label={`${unit.unit}を始める`} title={`${unit.unit}を始める`}>
        <Play aria-hidden="true" />
      </button>
    </article>
  );
}

function WeakWordsView({
  progress,
  startSession,
}: {
  progress: ProgressMap;
  startSession: (kind: SessionKind, unit?: string) => void;
}) {
  const weakWords = words
    .filter((word) => {
      const item = progress[word.id];
      return Boolean(item && item.wrong > 0 && !item.masteredAt);
    })
    .sort((a, b) => (progress[b.id]?.wrong ?? 0) - (progress[a.id]?.wrong ?? 0) || a.number - b.number)
    .slice(0, 40);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h1>苦手単語</h1>
          <p>{weakWords.length}語</p>
        </div>
        <button className="primary-command" disabled={weakWords.length === 0} onClick={() => startSession("weak")} type="button">
          <Target aria-hidden="true" />
          <span>出題</span>
        </button>
      </div>

      {weakWords.length === 0 ? (
        <EmptyState title="苦手単語はありません" />
      ) : (
        <div className="word-list">
          {weakWords.map((word) => {
            const item = progress[word.id];
            return (
              <article className="word-row" key={word.id}>
                <span className="word-number">{word.number}</span>
                <strong>{word.english}</strong>
                <span>{word.japanese}</span>
                <small>{word.unit}</small>
                <small>ミス {item?.wrong ?? 0}</small>
                <small>{formatDateTime(item?.dueAt ?? null)}</small>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProgressView({ stats, clearProgress }: { stats: AppStats; clearProgress: () => void }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h1>進捗</h1>
          <p>{stats.attempted} / {stats.total}語</p>
        </div>
        <button className="secondary-command" onClick={clearProgress} type="button">
          <RotateCcw aria-hidden="true" />
          <span>リセット</span>
        </button>
      </div>

      <div className="progress-summary">
        <Metric label="定着" value={`${stats.mastered}`} suffix="語" />
        <Metric label="復習" value={`${stats.due}`} suffix="語" />
        <Metric label="苦手" value={`${stats.weak}`} suffix="語" />
        <Metric label="正答" value={`${stats.correct}`} suffix={` / ${stats.attempts}`} />
      </div>

      <div className="unit-progress-table">
        {stats.units.map((unit) => (
          <div className="progress-row" key={unit.unit}>
            <span>{unit.unit}</span>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${pct(unit.mastered, unit.total)}%` }} />
            </div>
            <strong>{pct(unit.mastered, unit.total)}%</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuizView({
  session,
  meta,
  currentIndex,
  answerState,
  sessionComplete,
  sessionResult,
  chooseAnswer,
  goHome,
}: {
  session: QuizQuestion[];
  meta: SessionMeta | null;
  currentIndex: number;
  answerState: AnswerState;
  sessionComplete: boolean;
  sessionResult: SessionResult;
  chooseAnswer: (answer: string) => void;
  goHome: () => void;
}) {
  if (!meta) {
    return null;
  }

  if (session.length === 0) {
    return (
      <section className="quiz-panel">
        <EmptyState title={`${meta.title}はありません`} />
        <button className="primary-command" onClick={goHome} type="button">
          <Home aria-hidden="true" />
          <span>ホーム</span>
        </button>
      </section>
    );
  }

  if (sessionComplete) {
    return (
      <section className="quiz-panel">
        <div className="result-block">
          <CheckCircle2 aria-hidden="true" />
          <h1>{meta.title}</h1>
          <p>
            正解 {sessionResult.correct} / {session.length}
          </p>
        </div>
        <div className="result-actions">
          <button className="primary-command" onClick={goHome} type="button">
            <Home aria-hidden="true" />
            <span>ホーム</span>
          </button>
        </div>
      </section>
    );
  }

  const current = session[currentIndex];

  return (
    <section className="quiz-panel">
      <div className="quiz-topline">
        <span>{meta.title}</span>
        <strong>
          {currentIndex + 1} / {session.length}
        </strong>
      </div>

      <div className="question-block">
        <span>No. {current.word.number}・{current.word.unit}</span>
        <h1>{current.prompt}</h1>
      </div>

      <div className="choice-grid">
        {current.options.map((option) => {
          const isSelected = answerState?.selected === option;
          const isCorrect = option === current.correctAnswer;
          const className = answerState
            ? isCorrect
              ? "choice correct"
              : isSelected
                ? "choice wrong"
                : "choice muted"
            : "choice";

          return (
            <button className={className} key={option} onClick={() => chooseAnswer(option)} type="button">
              <span>{option}</span>
              {answerState && isCorrect && <CheckCircle2 aria-hidden="true" />}
              {answerState && isSelected && !isCorrect && <XCircle aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="quiz-footer">
        <div className={answerState?.isCorrect ? "feedback correct" : answerState ? "feedback wrong" : "feedback"}>
          {answerState ? (answerState.isCorrect ? "正解" : `正解は ${current.correctAnswer}`) : ""}
        </div>
        <span className="auto-next">{answerState ? "次の問題へ進みます" : "答えを選んでください"}</span>
      </div>
    </section>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty-state">
      <CheckCircle2 aria-hidden="true" />
      <strong>{title}</strong>
    </div>
  );
}
