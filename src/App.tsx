import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { callTestingApi } from "./api";
import { supabase } from "./supabase";
import QuarterlyTestResult,{type QuarterlyResult} from "./QuarterlyTestResult";

type AttemptSummary = QuarterlyResult & {
  id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total: number | null;
  percent: number | null;
  grade: number | null;
  passed: boolean | null;
};

type Assignment = {
  id: string;
  due_at: string;
  attempt_limit: number;
  attempts_used: number;
  status: "assigned" | "in_progress" | "completed";
  best_percent: number | null;
  best_grade: number | null;
  best_attempt_id?:string;best_average_grade?:number|null;
  test: {
    assessment_kind?:"lesson"|"quarterly";
    title: string;
    description: string | null;
    passing_percent: number;
    time_limit_minutes: number;
    question_count: number;
    subject: { name: string; short_name: string | null } | null;
  };
  session: {
    topic: string;
    starts_at: string;
    ends_at: string;
    guard_number: string;
  };
  attempts: AttemptSummary[];
};

type Dashboard = {
  profile: { full_name: string; fire_station: string; requested_position: string };
  assignments: Assignment[];
};

type Attempt = {
  id: string;
  assignment_id: string;
  test_title: string;
  passing_percent: number;
  started_at: string;
  expires_at: string;
  questions: Array<{
    id: string;
    prompt: string;
    answers: Array<{ id: string; answer_text: string }>;
  }>;
};

type Result = QuarterlyResult & {
  attempt_id: string;
  score: number;
  total: number;
  percent: number;
  grade: number;
  passed: boolean;
  attempts_used: number;
  attempt_limit: number;
  can_retry: boolean;
  expired: boolean;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function remainingTime(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function App() {
  const [logged, setLogged] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDashboard(await callTestingApi<Dashboard>({ action: "my_assignments" }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить назначения");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLogged(Boolean(data.session));
      if (data.session) void loadDashboard();
      else setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setLogged(Boolean(session));
      if (!session) { setDashboard(null); setAttempt(null); setResult(null); }
    });
    return () => data.subscription.unsubscribe();
  }, [loadDashboard]);

  useEffect(() => {
    if (!attempt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => { window.clearInterval(timer); window.removeEventListener("beforeunload", warn); };
  }, [attempt]);

  const active = useMemo(
    () => dashboard?.assignments.filter((assignment) => assignment.status !== "completed") || [],
    [dashboard?.assignments],
  );
  const completed = useMemo(
    () => dashboard?.assignments.filter((assignment) => assignment.status === "completed") || [],
    [dashboard?.assignments],
  );

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }
    setLogged(true);
    await loadDashboard();
  };

  const logout = async () => { await supabase.auth.signOut(); };

  const startAttempt = async (assignment: Assignment) => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await callTestingApi<{ attempt: Attempt }>({
        action: "start_attempt",
        assignment_id: assignment.id,
      });
      setAttempt(response.attempt);
      setAnswers({});
      setNow(Date.now());
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Не удалось начать тест");
      await loadDashboard();
    } finally { setLoading(false); }
  };

  const submitAttempt = async (event: FormEvent) => {
    event.preventDefault();
    if (!attempt) return;
    const unanswered = attempt.questions.length - Object.keys(answers).length;
    if (unanswered && !window.confirm(`Без ответа останется: ${unanswered}. Завершить тест?`)) return;
    setLoading(true);
    setError("");
    try {
      const response = await callTestingApi<{ result: Result }>({
        action: "submit_attempt",
        attempt_id: attempt.id,
        answers: Object.entries(answers).map(([question_id, answer_id]) => ({ question_id, answer_id })),
      });
      setResult(response.result);
      setAttempt(null);
      setAnswers({});
      await loadDashboard();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось завершить тест");
    } finally { setLoading(false); }
  };

  if (!logged) return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">92</div>
        <span className="eyebrow">Цифровая ПСЧ</span>
        <h1>Тестирование</h1>
        <p>Войдите с той же учётной записью, которая используется в основном приложении.</p>
        {error ? <div className="message error">{error}</div> : null}
        <form onSubmit={login}>
          <label><span>Email</span><input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label><span>Пароль</span><input autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="primary" disabled={loading}>{loading ? "Входим…" : "Войти"}</button>
        </form>
        <a href="https://cifrovaya-psch.vercel.app">← Вернуться в Цифровую ПСЧ</a>
      </section>
    </main>
  );

  if (attempt) return (
    <main className="exam-shell">
      <header className="exam-header">
        <div><span className="eyebrow">Текущая попытка</span><h1>{attempt.test_title}</h1></div>
        <div className={new Date(attempt.expires_at).getTime() - now < 300_000 ? "timer warning" : "timer"}><small>Осталось</small><b>{remainingTime(attempt.expires_at, now)}</b></div>
      </header>
      {error ? <div className="message error">{error}</div> : null}
      <form className="exam-form" onSubmit={submitAttempt}>
        {attempt.questions.map((question, index) => (
          <fieldset key={question.id}>
            <legend><span>{index + 1}</span>{question.prompt}</legend>
            {question.answers.map((answer) => <label className={answers[question.id] === answer.id ? "selected" : ""} key={answer.id}><input type="radio" name={question.id} value={answer.id} checked={answers[question.id] === answer.id} onChange={() => setAnswers((current) => ({ ...current, [question.id]: answer.id }))} /><span>{answer.answer_text}</span></label>)}
          </fieldset>
        ))}
        <footer><span>Отвечено: {Object.keys(answers).length} из {attempt.questions.length}</span><button className="primary" disabled={loading}>{loading ? "Проверяем…" : "Завершить тест"}</button></footer>
      </form>
    </main>
  );

  return (
    <main className="dashboard-shell">
      <header className="topbar"><div><div className="brand-mark small">92</div><div><span className="eyebrow">Цифровая ПСЧ · 3.2.1</span><b>Тестирование личного состава</b></div></div><button type="button" onClick={logout}>Выйти</button></header>
      <section className="welcome"><div><h1>{dashboard?.profile.full_name || "Сотрудник"}</h1><p>{dashboard?.profile.requested_position} · {dashboard?.profile.fire_station}</p></div><a href="https://cifrovaya-psch.vercel.app">Основное приложение ↗</a></section>
      {error ? <div className="message error">{error}</div> : null}
      {result ? <section className={`result-card ${result.passed ? "passed" : "failed"}`}><span>{result.passed ? "✅" : "⚠️"}</span><div><small>Результат сохранён в «Боевой подготовке»</small><h2>{result.percent}% · оценка {result.grade}</h2><p>{result.score} правильных ответов из {result.total}.{result.can_retry ? " Доступна повторная попытка." : ""}{result.expired ? " Время попытки истекло." : ""}</p>{result.average_grade!=null?<p>Оценки по предметам автоматически переносятся в квартальную ведомость. Если она ещё не создана — при её создании.</p>:null}<QuarterlyTestResult result={result}/></div><button type="button" onClick={() => setResult(null)}>Закрыть</button></section> : null}
      <section className="section-heading"><div><h2>Нужно пройти</h2><p>Откройте тест до указанного срока. Незавершённая попытка продолжится с прежним таймером.</p></div><b>{active.length}</b></section>
      <div className="assignment-grid">
        {active.map((assignment) => <article className="assignment-card" key={assignment.id}><header><span>{assignment.test.subject?.short_name || "Тест"}</span><small>{assignment.status === "in_progress" ? "Попытка начата" : "Назначен"}</small></header><h3>{assignment.test.title}</h3><p>{assignment.test.description || assignment.session.topic}</p><dl><div><dt>Вопросов</dt><dd>{assignment.test.question_count}</dd></div><div><dt>Время</dt><dd>{assignment.test.time_limit_minutes} мин</dd></div><div><dt>{assignment.test.assessment_kind==="quarterly"?"По каждой теме":"Проходной"}</dt><dd>{assignment.test.assessment_kind==="quarterly"?"5 случайных вопросов":`${assignment.test.passing_percent}%`}</dd></div></dl>{assignment.test.assessment_kind==="quarterly"?<QuarterlyTestResult result={assignment.attempts.find(a=>a.id===assignment.best_attempt_id)||{}}/>:null}<footer><div><small>Срок</small><b>{formatDate(assignment.due_at)}</b><small>Попытки: {assignment.attempts_used}/{assignment.attempt_limit}</small></div><button className="primary" disabled={loading} onClick={() => void startAttempt(assignment)}>{assignment.status === "in_progress" ? "Продолжить" : "Начать"}</button></footer></article>)}
        {!active.length ? <section className="empty"><span>🎉</span><h2>Обязательных тестов нет</h2><p>Все назначения выполнены.</p></section> : null}
      </div>
      <section className="section-heading completed-heading"><div><h2>Завершённые</h2><p>Лучшие результаты по пройденным тестам.</p></div></section>
      <div className="history-list">{completed.map((assignment) => <article key={assignment.id}><div><b>{assignment.test.title}</b><small>{assignment.test.subject?.name} · {assignment.session.topic}</small></div><div><b>{assignment.best_percent}%</b><small>{assignment.best_average_grade!=null?`Средняя ${Number(assignment.best_average_grade).toLocaleString("ru-RU")}`:`Оценка ${assignment.best_grade||"—"}`}</small></div><span className={(assignment.test.assessment_kind==="quarterly"?(assignment.best_grade||2)>=3:(assignment.best_percent||0)>=assignment.test.passing_percent) ? "passed" : "failed"}>{(assignment.test.assessment_kind==="quarterly"?(assignment.best_grade||2)>=3:(assignment.best_percent||0)>=assignment.test.passing_percent) ? "Пройден" : "Не пройден"}</span>{assignment.test.assessment_kind==="quarterly"?<QuarterlyTestResult result={assignment.attempts.find(a=>a.id===assignment.best_attempt_id)||{}}/>:null}</article>)}{!completed.length ? <p className="history-empty">Завершённых тестов пока нет.</p> : null}</div>
    </main>
  );
}

