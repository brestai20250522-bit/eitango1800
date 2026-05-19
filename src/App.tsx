import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Home,
  ListChecks,
  Play,
  RotateCcw,
  Save,
  Target,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import wordsData from "./data/words.json";
import { createQuizSession, selectSessionWords, shuffle } from "./lib/quiz";
import { applyAnswer } from "./lib/review";
import { getAppStats, type AppStats, type UnitStat } from "./lib/stats";
import { loadProgress, loadTrainingMenus, resetProgress, saveProgress, saveTrainingMenus } from "./lib/storage";
import type { ProgressMap, QuizQuestion, SessionKind, TrainingMenu, Word } from "./types";

type View = "home" | "modeSelect" | "testSetup" | "trainingMenus" | "trainingEdit" | "quiz" | "units" | "weak" | "progress";
type SessionLimit = 10 | 20 | "unitAll";
type SessionMeta = {
  kind: SessionKind;
  title: string;
  unit?: string;
  trainingMenuId?: string;
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
const SESSION_LIMITS: SessionLimit[] = [10, 20, "unitAll"];
const AUTO_ADVANCE_DELAY_MS = 800;
const ALL_UNITS = "all";

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

function formatSessionLimit(limit: SessionLimit, hasUnitScope = true): string {
  if (limit !== "unitAll") {
    return `${limit}問`;
  }
  return hasUnitScope ? "1単元全問" : "全単元全問";
}

export default function App() {
  const [progress, setProgress] = useState<ProgressMap>(() => loadProgress(words));
  const [trainingMenus, setTrainingMenus] = useState<TrainingMenu[]>(() => loadTrainingMenus(words));
  const [view, setView] = useState<View>("home");
  const [sessionLimit, setSessionLimit] = useState<SessionLimit>(10);
  const [selectedTestUnit, setSelectedTestUnit] = useState<string | null>(null);
  const [activeTrainingMenuId, setActiveTrainingMenuId] = useState(trainingMenus[0]?.id ?? "menu-a");
  const [trainingUnitFilter, setTrainingUnitFilter] = useState<string>(ALL_UNITS);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
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
    saveTrainingMenus(trainingMenus);
  }, [trainingMenus]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => getAppStats(words, progress, nowMs), [progress, nowMs]);
  const wordById = useMemo(() => new Map(words.map((word) => [word.id, word])), []);
  const activeTrainingMenu = trainingMenus.find((menu) => menu.id === activeTrainingMenuId) ?? trainingMenus[0];

  function goHome() {
    setView("home");
  }

  function startSession(kind: SessionKind, unit?: string, limitOverride?: number) {
    const title = (() => {
      if (kind === "review") {
        return "今日の復習";
      }
      if (kind === "test" || kind === "new") {
        return unit ? `${unit}テスト` : "全範囲ランダムテスト";
      }
      if (kind === "training") {
        return "徹底特訓モード";
      }
      if (kind === "weak") {
        return "苦手単語";
      }
      return unit ?? "単元学習";
    })();
    const selectedWords = selectSessionWords(words, progress, {
      kind,
      unit,
      limit: limitOverride ?? (sessionLimit === "unitAll" ? words.length : sessionLimit),
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

  function startTrainingMenu(menu: TrainingMenu) {
    const selectedWords = shuffle(
      menu.wordIds.map((wordId) => wordById.get(wordId)).filter((word): word is Word => Boolean(word)),
    );

    setSession(createQuizSession(selectedWords, words));
    setSessionMeta({ kind: "training", title: `${menu.name} 徹底特訓`, trainingMenuId: menu.id });
    setCurrentIndex(0);
    setAnswerState(null);
    setSessionComplete(false);
    setSessionResult({ correct: 0, wrong: 0 });
    setView("quiz");
  }

  function openTrainingEditor(menuId: string) {
    setActiveTrainingMenuId(menuId);
    setTrainingUnitFilter(ALL_UNITS);
    setShowSelectedOnly(false);
    setView("trainingEdit");
  }

  function updateTrainingMenu(menuId: string, updates: Pick<TrainingMenu, "name" | "wordIds">) {
    setTrainingMenus((menus) =>
      menus.map((menu) =>
        menu.id === menuId
          ? {
              ...menu,
              name: updates.name.trim() || menu.name,
              wordIds: [...new Set(updates.wordIds)],
              updatedAt: new Date().toISOString(),
            }
          : menu,
      ),
    );
  }

  function clearTrainingMenu(menuId: string) {
    const confirmed = window.confirm("この特訓メニューの単語をすべて削除しますか？");
    if (!confirmed) {
      return;
    }
    setTrainingMenus((menus) =>
      menus.map((menu) =>
        menu.id === menuId
          ? {
              ...menu,
              wordIds: [],
              updatedAt: new Date().toISOString(),
            }
          : menu,
      ),
    );
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
    if (sessionMeta?.kind !== "training") {
      setProgress((currentProgress) => applyAnswer(currentProgress, current.word, isCorrect, Date.now()));
    }
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
          <button
            className={
              view === "home" || view === "modeSelect" || view === "testSetup" || view === "trainingMenus" || view === "trainingEdit"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={goHome}
            type="button"
          >
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
            startSession={startSession}
            setView={setView}
          />
        )}
        {view === "modeSelect" && <ModeSelectView setView={setView} goHome={goHome} />}
        {view === "testSetup" && (
          <TestSetupView
            stats={stats}
            selectedUnit={selectedTestUnit}
            setSelectedUnit={setSelectedTestUnit}
            sessionLimit={sessionLimit}
            setSessionLimit={setSessionLimit}
            startSession={startSession}
            goHome={goHome}
          />
        )}
        {view === "trainingMenus" && (
          <TrainingMenusView
            menus={trainingMenus}
            startTrainingMenu={startTrainingMenu}
            openTrainingEditor={openTrainingEditor}
            clearTrainingMenu={clearTrainingMenu}
            goHome={goHome}
          />
        )}
        {view === "trainingEdit" && activeTrainingMenu && (
          <TrainingMenuEditor
            menu={activeTrainingMenu}
            words={words}
            units={stats.units}
            unitFilter={trainingUnitFilter}
            setUnitFilter={setTrainingUnitFilter}
            showSelectedOnly={showSelectedOnly}
            setShowSelectedOnly={setShowSelectedOnly}
            saveMenu={updateTrainingMenu}
            backToMenus={() => setView("trainingMenus")}
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
  startSession,
  setView,
}: {
  stats: AppStats;
  startSession: (kind: SessionKind, unit?: string) => void;
  setView: (view: View) => void;
}) {
  return (
    <div className="view-stack">
      <section className="start-panel" aria-label="テスト開始">
        <button className="start-test-button" onClick={() => setView("modeSelect")} type="button">
          <span className="action-icon">
            <Play aria-hidden="true" />
          </span>
          <span>
            <strong>テストを実施する</strong>
            <small>ランダム確認か徹底特訓を選んでスタート</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
      </section>

      <section className="support-grid" aria-label="復習メニュー">
        <ActionButton
          accent="teal"
          count={stats.due}
          icon={<CalendarCheck aria-hidden="true" />}
          label="今日の復習"
          onClick={() => startSession("review")}
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

function ModeSelectView({ setView, goHome }: { setView: (view: View) => void; goHome: () => void }) {
  return (
    <section className="panel mode-select">
      <div className="section-heading">
        <div>
          <h1>モード選択</h1>
          <p>目的に合わせて選んでください</p>
        </div>
        <button className="secondary-command" onClick={goHome} type="button">
          <Home aria-hidden="true" />
          <span>戻る</span>
        </button>
      </div>

      <div className="mode-grid">
        <button className="mode-card random" onClick={() => setView("testSetup")} type="button">
          <span className="action-icon">
            <Play aria-hidden="true" />
          </span>
          <span>
            <strong>ランダム確認モード</strong>
            <small>範囲と問題数を選んでランダム出題。正答率・苦手単語・復習予定に反映されます。</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>

        <button className="mode-card training" onClick={() => setView("trainingMenus")} type="button">
          <span className="action-icon">
            <Target aria-hidden="true" />
          </span>
          <span>
            <strong>徹底特訓モード</strong>
            <small>覚えにくい単語だけをメニューに保存して練習。通常の成績データには反映されません。</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function TestSetupView({
  stats,
  selectedUnit,
  setSelectedUnit,
  sessionLimit,
  setSessionLimit,
  startSession,
  goHome,
}: {
  stats: AppStats;
  selectedUnit: string | null;
  setSelectedUnit: (unit: string | null) => void;
  sessionLimit: SessionLimit;
  setSessionLimit: (limit: SessionLimit) => void;
  startSession: (kind: SessionKind, unit?: string, limitOverride?: number) => void;
  goHome: () => void;
}) {
  const selectedUnitStat = selectedUnit ? stats.units.find((unit) => unit.unit === selectedUnit) : null;
  const scopeTotal = selectedUnitStat?.total ?? stats.total;
  const scopeLabel = selectedUnit ?? "全単元";
  const questionCount = sessionLimit === "unitAll" ? scopeTotal : Math.min(sessionLimit, scopeTotal);

  function startTest() {
    startSession("test", selectedUnit ?? undefined, questionCount);
  }

  return (
    <section className="panel test-setup">
      <div className="section-heading">
        <div>
          <h1>ランダム確認モード</h1>
          <p>範囲と問題数を選んでください</p>
        </div>
        <button className="secondary-command" onClick={goHome} type="button">
          <Home aria-hidden="true" />
          <span>戻る</span>
        </button>
      </div>

      <div className="setup-section">
        <h2>1. 出題範囲</h2>
        <div className="scope-grid">
          <button
            className={selectedUnit === null ? "scope-button active" : "scope-button"}
            onClick={() => setSelectedUnit(null)}
            type="button"
          >
            <strong>全単元</strong>
            <span>{stats.total}語からランダム</span>
          </button>
          {stats.units.map((unit) => (
            <button
              className={selectedUnit === unit.unit ? "scope-button active" : "scope-button"}
              key={unit.unit}
              onClick={() => setSelectedUnit(unit.unit)}
              type="button"
            >
              <strong>{unit.unit}</strong>
              <span>{unit.total}語</span>
            </button>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <h2>2. 問題数</h2>
        <div className="segmented setup-segments" role="group" aria-label="問題数">
          {SESSION_LIMITS.map((limit) => (
            <button
              className={sessionLimit === limit ? "segment active" : "segment"}
              key={limit}
              onClick={() => setSessionLimit(limit)}
              type="button"
            >
              {formatSessionLimit(limit, Boolean(selectedUnit))}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-actions">
        <div className="setup-summary">
          <span>選択中</span>
          <strong>
            {scopeLabel}・{questionCount}問
          </strong>
        </div>
        <button className="primary-command start-command" onClick={startTest} type="button">
          <Play aria-hidden="true" />
          <span>スタート</span>
        </button>
      </div>
    </section>
  );
}

function TrainingMenusView({
  menus,
  startTrainingMenu,
  openTrainingEditor,
  clearTrainingMenu,
  goHome,
}: {
  menus: TrainingMenu[];
  startTrainingMenu: (menu: TrainingMenu) => void;
  openTrainingEditor: (menuId: string) => void;
  clearTrainingMenu: (menuId: string) => void;
  goHome: () => void;
}) {
  return (
    <section className="panel training-menu-panel">
      <div className="section-heading">
        <div>
          <h1>徹底特訓モード</h1>
          <p>保存したメニューから実施、または単語を編集できます</p>
        </div>
        <button className="secondary-command" onClick={goHome} type="button">
          <Home aria-hidden="true" />
          <span>戻る</span>
        </button>
      </div>

      <div className="training-menu-grid">
        {menus.map((menu) => (
          <article className="training-menu-card" key={menu.id}>
            <div>
              <strong>{menu.name}</strong>
              <span>{menu.wordIds.length}語登録</span>
              <small>{menu.updatedAt ? `${formatDateTime(menu.updatedAt)} 更新` : "未編集"}</small>
            </div>
            <div className="menu-card-actions">
              <button
                className="primary-command"
                disabled={menu.wordIds.length === 0}
                onClick={() => startTrainingMenu(menu)}
                type="button"
              >
                <Play aria-hidden="true" />
                <span>実施</span>
              </button>
              <button className="secondary-command" onClick={() => openTrainingEditor(menu.id)} type="button">
                <Edit3 aria-hidden="true" />
                <span>編集</span>
              </button>
              <button className="secondary-command danger-command" onClick={() => clearTrainingMenu(menu.id)} type="button">
                <Trash2 aria-hidden="true" />
                <span>削除</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TrainingMenuEditor({
  menu,
  words,
  units,
  unitFilter,
  setUnitFilter,
  showSelectedOnly,
  setShowSelectedOnly,
  saveMenu,
  backToMenus,
}: {
  menu: TrainingMenu;
  words: Word[];
  units: UnitStat[];
  unitFilter: string;
  setUnitFilter: (unit: string) => void;
  showSelectedOnly: boolean;
  setShowSelectedOnly: (show: boolean) => void;
  saveMenu: (menuId: string, updates: Pick<TrainingMenu, "name" | "wordIds">) => void;
  backToMenus: () => void;
}) {
  const [draftName, setDraftName] = useState(menu.name);
  const [draftWordIds, setDraftWordIds] = useState<string[]>(menu.wordIds);
  const selectedWordIds = useMemo(() => new Set(draftWordIds), [draftWordIds]);

  useEffect(() => {
    setDraftName(menu.name);
    setDraftWordIds(menu.wordIds);
  }, [menu]);

  const visibleWords = useMemo(() => {
    const scopedWords = unitFilter === ALL_UNITS ? words : words.filter((word) => word.unit === unitFilter);
    return showSelectedOnly ? scopedWords.filter((word) => selectedWordIds.has(word.id)) : scopedWords;
  }, [draftWordIds, selectedWordIds, showSelectedOnly, unitFilter, words]);

  function toggleWord(wordId: string) {
    setDraftWordIds((current) =>
      current.includes(wordId) ? current.filter((currentWordId) => currentWordId !== wordId) : [...current, wordId],
    );
  }

  function saveAndBack() {
    saveMenu(menu.id, { name: draftName, wordIds: draftWordIds });
    backToMenus();
  }

  return (
    <section className="panel training-editor">
      <div className="section-heading">
        <div>
          <h1>特訓メニュー編集</h1>
          <p>単元を切り替えながら、練習したい単語だけを選びます</p>
        </div>
        <button className="secondary-command" onClick={backToMenus} type="button">
          <Target aria-hidden="true" />
          <span>一覧へ</span>
        </button>
      </div>

      <div className="menu-name-row">
        <label htmlFor="training-menu-name">メニュー名</label>
        <input
          id="training-menu-name"
          maxLength={24}
          onChange={(event) => setDraftName(event.target.value)}
          type="text"
          value={draftName}
        />
        <strong>{draftWordIds.length}語選択中</strong>
      </div>

      <div className="setup-section">
        <h2>表示する単元</h2>
        <div className="scope-grid training-filter-grid">
          <button
            className={unitFilter === ALL_UNITS ? "scope-button active" : "scope-button"}
            onClick={() => setUnitFilter(ALL_UNITS)}
            type="button"
          >
            <strong>全単元</strong>
            <span>{words.length}語</span>
          </button>
          {units.map((unit) => (
            <button
              className={unitFilter === unit.unit ? "scope-button active" : "scope-button"}
              key={unit.unit}
              onClick={() => setUnitFilter(unit.unit)}
              type="button"
            >
              <strong>{unit.unit}</strong>
              <span>{unit.total}語</span>
            </button>
          ))}
        </div>
      </div>

      <div className="word-picker-toolbar">
        <button
          className={showSelectedOnly ? "secondary-command active-filter" : "secondary-command"}
          onClick={() => setShowSelectedOnly(!showSelectedOnly)}
          type="button"
        >
          <CheckCircle2 aria-hidden="true" />
          <span>選択済みだけ</span>
        </button>
        <button className="secondary-command" onClick={() => setDraftWordIds([])} type="button">
          <Trash2 aria-hidden="true" />
          <span>全選択解除</span>
        </button>
        <button className="primary-command" onClick={saveAndBack} type="button">
          <Save aria-hidden="true" />
          <span>保存</span>
        </button>
      </div>

      <div className="word-picker-list">
        {visibleWords.map((word) => {
          const selected = selectedWordIds.has(word.id);
          return (
            <button
              className={selected ? "word-pick-row selected" : "word-pick-row"}
              key={word.id}
              onClick={() => toggleWord(word.id)}
              type="button"
            >
              <span className="word-number">{word.number}</span>
              <strong>{word.english}</strong>
              <span>{word.japanese}</span>
              <small>{word.unit}</small>
              <CheckCircle2 aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
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
