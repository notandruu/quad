"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./QuadWorkspaceDashboard.module.css";

const ORG_ID = "org_acme";

type RunStatus = "idle" | "resetting" | "running" | "needs_approval" | "done" | "error";

type TrustQuestion = {
  id: string;
  text: string;
};

type TrustSource = {
  id: string;
  kind: "brain" | "connector";
  title: string;
  quote?: string;
};

type EnterpriseProofResponse = {
  ok?: boolean;
  result?: {
    status?: "answered" | "needs_human";
    question?: string;
    answer?: string;
    confidence?: number;
    wasReused?: boolean;
    sources?: TrustSource[];
    quadChain?: {
      certificateId?: string;
      openObligations?: unknown[];
      sourceCount?: number;
      evidenceCount?: number;
    } | null;
  };
  brainGrowth?: {
    status: "learned" | "reused" | "needs_human";
    memoryId: string | null;
    title: string | null;
    visibility: "company" | "team" | "personal";
    approvalRequired: boolean;
  } | null;
  run?: {
    runId: string;
    title: string;
    status: string;
    nextAction: string;
    approvals?: unknown[];
    artifacts?: unknown[];
    receipts?: unknown[];
  } | null;
  error?: string;
};

type OperatorState = {
  ok?: boolean;
  runs?: OperatorRunSummary[];
  pendingApprovals?: Array<{
    id: string;
    runId: string;
    runTitle: string;
    reason: string;
    evidenceVisible: boolean;
  }>;
  memory?: {
    memories?: Array<{ id: string; title: string; sourceType?: string; confidence?: number; createdAt?: string }>;
  } | null;
  quadChain?: {
    total?: number;
    ready?: number;
    blocked?: number;
    latest?: Array<{ id: string; type: string; producer: string; consumer: string; createdAt: string }>;
  };
  evidence?: {
    total?: number;
    bundles?: Array<{ id: string; title: string; sourceCount?: number }>;
  };
  capabilities?: {
    active?: Array<{ id: string; label?: string; status?: string }>;
    blocked?: Array<{ id: string; reason?: string }>;
  };
  backendReadiness?: {
    ready?: boolean;
    mode?: string;
    checks?: Array<{ name: string; ok: boolean; message?: string }>;
  } | null;
};

type OperatorRunSummary = {
  runId: string;
  title: string;
  status: string;
  nextAction: string;
  artifacts: unknown[];
  receipts: unknown[];
  approvals: unknown[];
};

type AnswerCard = {
  id: string;
  question: string;
  status: "answered" | "needs_human" | "error";
  answer: string;
  confidence: number | null;
  sources: TrustSource[];
  reused: boolean;
  learnedTitle: string | null;
  approvalRequired: boolean;
  certificateId: string | null;
  runId: string | null;
};

type BrainGraphNode = {
  id: string;
  label: string;
  kind: string;
  answerId: string | null;
};

type LogLine = {
  id: string;
  tone: "read" | "collect" | "learn" | "judge" | "act" | "error";
  text: string;
};

type BrowserEvent = {
  id: string;
  tone: "session" | "nav" | "focus" | "write" | "proof" | "pause" | "error";
  label: string;
  detail: string;
  questionId?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "quad";
  text: string;
};

const TRUST_QUESTIONS: TrustQuestion[] = [
  { id: "mfa", text: "Do you enforce MFA for production access?" },
  { id: "encryption", text: "Is customer data encrypted at rest and in transit?" },
  { id: "access_reviews", text: "How often are production access reviews performed?" },
  { id: "incident_response", text: "Do you maintain an incident response plan?" },
  { id: "breach_history", text: "Have you experienced a data breach or P0 security incident in the past 24 months?" },
  { id: "regions", text: "Where is customer data processed and stored?" },
  { id: "subprocessors", text: "Do you review subprocessors annually?" },
  { id: "deletion", text: "How quickly are customer data deletion requests fulfilled?" },
  { id: "pen_test", text: "Do you perform third-party penetration tests annually?" },
  { id: "tls13", text: "Is TLS 1.3 enforced everywhere with TLS 1.2 disabled?" },
];

const initialChat: ChatMessage[] = [
  {
    id: "hello",
    role: "quad",
    text:
      "hand me the questionnaire. i’ll retrieve the company brain, collect connector evidence, judge each answer, and write back only validated facts.",
  },
];

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function pct(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function sourceLabel(source: TrustSource) {
  return `${source.kind === "brain" ? "brain" : "connector"} · ${source.title}`;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function QuadWorkspaceDashboard() {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [answers, setAnswers] = useState<AnswerCard[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [browserEvents, setBrowserEvents] = useState<BrowserEvent[]>([]);
  const [browserPhase, setBrowserPhase] = useState("idle");
  const [chat, setChat] = useState<ChatMessage[]>(initialChat);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"brain" | "questionnaire" | "logs">("brain");
  const [operator, setOperator] = useState<OperatorState | null>(null);
  const [composer, setComposer] = useState("Complete the SecureFlow security questionnaire");
  const [selectedSource, setSelectedSource] = useState<TrustSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChatting, setIsChatting] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const cancelledRef = useRef(false);

  const answeredCount = answers.filter((answer) => answer.status === "answered").length;
  const needsHumanCount = answers.filter((answer) => answer.status === "needs_human" || answer.status === "error").length;
  const sourceCount = answers.reduce((sum, answer) => sum + answer.sources.length, 0);
  const learnedCount = answers.filter((answer) => answer.learnedTitle && !answer.reused).length;
  const progress = Math.round(((answeredCount + needsHumanCount) / TRUST_QUESTIONS.length) * 100);
  const latestRun = operator?.runs?.[0] ?? null;
  const brainMemories = operator?.memory?.memories ?? [];
  const capabilityCount = operator?.capabilities?.active?.length ?? 0;
  const receiptCount = operator?.quadChain?.total ?? 0;

  const graphNodes = useMemo(() => {
    const sourceNodes = answers.flatMap((answer) =>
      answer.sources.slice(0, 3).map((source) => ({
        id: source.id,
        label: source.title,
        kind: source.kind,
        answerId: answer.id,
      }))
    );
    const memoryNodes = brainMemories.slice(0, 8).map((memory) => ({
      id: memory.id,
      label: memory.title,
      kind: "memory",
      answerId: null,
    }));
    return [...memoryNodes, ...sourceNodes].slice(0, 18);
  }, [answers, brainMemories]);

  useEffect(() => {
    void refreshOperator();
    const interval = window.setInterval(() => void refreshOperator(), 4000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [answers, chat, logs]);

  async function refreshOperator() {
    try {
      const response = await fetch(`/api/operator?orgId=${ORG_ID}&limit=8`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as OperatorState | null;
      if (response.ok && data?.ok) setOperator(data);
    } catch {
      // dashboard should degrade gracefully while the demo workflow still runs.
    }
  }

  function addLog(tone: LogLine["tone"], text: string) {
    setLogs((current) => [...current, { id: uid("log"), tone, text }].slice(-80));
  }

  function addBrowserEvent(tone: BrowserEvent["tone"], label: string, detail: string, questionId?: string) {
    setBrowserEvents((current) => [...current, { id: uid("browser"), tone, label, detail, questionId }].slice(-60));
  }

  function addChat(role: ChatMessage["role"], text: string) {
    setChat((current) => [...current, { id: uid("msg"), role, text }]);
  }

  async function streamBrowserStep(index: number, question: TrustQuestion) {
    setBrowserPhase(`q${index + 1} controlled browser`);
    addBrowserEvent("session", "browserbase session", `reuse authenticated vendor session · org ${ORG_ID}`, question.id);
    await wait(130);
    if (cancelledRef.current) return;
    addBrowserEvent("nav", "page.goto", "https://trust.secureflow.com/vendor/redcross/security-questionnaire", question.id);
    await wait(160);
    if (cancelledRef.current) return;
    addBrowserEvent("focus", "locator.focus", `[data-question-id="${question.id}"]`, question.id);
    await wait(190);
    if (cancelledRef.current) return;
    addBrowserEvent("proof", "read company brain", "retrieve memories, connector docs, and quadchain receipts", question.id);
  }

  async function completeBrowserStep(index: number, card: AnswerCard) {
    setBrowserPhase(`q${index + 1} writing answer`);
    addBrowserEvent(
      card.status === "answered" ? "write" : "pause",
      card.status === "answered" ? "locator.fill" : "pause_before_submit",
      card.status === "answered" ? `${card.answer.slice(0, 116)}${card.answer.length > 116 ? "…" : ""}` : "unsupported claim requires human review",
      card.id
    );
    await wait(120);
    if (cancelledRef.current) return;
    addBrowserEvent(
      "proof",
      "evidence attached",
      `${card.sources.length} sources · ${card.certificateId ?? card.runId ?? "receipt pending"}`,
      card.id
    );
  }

  async function runQuestionnaire() {
    if (status === "running" || status === "resetting") return;
    cancelledRef.current = false;
    setStatus("resetting");
    setError(null);
    setAnswers([]);
    setLogs([]);
    setBrowserEvents([]);
    setBrowserPhase("opening browserbase session");
    setActiveIndex(null);
    setActiveView("questionnaire");
    setSelectedSource(null);
    setChat([
      ...initialChat,
      { id: uid("user"), role: "user", text: composer || "Complete the SecureFlow security questionnaire" },
    ]);

    try {
      addLog("act", "demo.enterprise_proof.reset requested");
      const reset = await fetch("/api/demo/enterprise-proof/reset", { method: "POST" });
      if (!reset.ok) throw new Error(`reset failed (${reset.status})`);
      const resetData = await reset.json().catch(() => ({}));
      addLog(
        "learn",
        `brain seeded · ${resetData.brainMemoriesSeeded ?? 0} memories · ${resetData.connectorDocsRegistered ?? 0} connector docs`
      );
      addChat("quad", "enterprise proof brain is seeded. now i’m running each questionnaire row through the real answer/judge/writeback loop.");
      setStatus("running");

      for (let index = 0; index < TRUST_QUESTIONS.length; index += 1) {
        if (cancelledRef.current) return;
        const question = TRUST_QUESTIONS[index];
        setActiveIndex(index);
        addLog("read", `question.started q${index + 1} · ${question.text}`);
        const browserStep = streamBrowserStep(index, question);

        const responsePromise = fetch("/api/enterprise-proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: ORG_ID,
            question: question.text,
            targetVisibility: "company",
          }),
        });
        await browserStep;
        const response = await responsePromise;
        const data = (await response.json().catch(() => ({}))) as EnterpriseProofResponse;
        if (!response.ok || !data.result) {
          throw new Error(data.error ?? `enterprise proof failed (${response.status})`);
        }

        const result = data.result;
        const sources = Array.isArray(result.sources) ? result.sources : [];
        const card: AnswerCard = {
          id: question.id,
          question: question.text,
          status: result.status === "answered" ? "answered" : "needs_human",
          answer:
            result.status === "answered"
              ? result.answer ?? "answered from evidence."
              : result.answer ?? "not enough support in the brain or connectors. routed to human review.",
          confidence: typeof result.confidence === "number" ? result.confidence : null,
          sources,
          reused: Boolean(result.wasReused),
          learnedTitle: data.brainGrowth?.title ?? null,
          approvalRequired: Boolean(data.brainGrowth?.approvalRequired),
          certificateId: result.quadChain?.certificateId ?? null,
          runId: data.run?.runId ?? null,
        };

        addLog("collect", `context.collected · ${sources.length} sources`);
        addLog("judge", `answer.evaluated · ${card.status === "answered" ? "pass" : "needs human"}`);
        if (data.brainGrowth?.status === "learned") addLog("learn", `brain.learned · ${data.brainGrowth.title ?? data.brainGrowth.memoryId}`);
        if (data.brainGrowth?.status === "reused") addLog("read", `brain.reused · ${data.brainGrowth.title ?? data.brainGrowth.memoryId}`);

        setAnswers((current) => [...current, card]);
        await completeBrowserStep(index, card);
        await refreshOperator();
      }

      setActiveIndex(null);
      setStatus("needs_approval");
      setBrowserPhase("waiting on operator approval");
      addBrowserEvent("pause", "pause_before_submit", "all fields staged; browser is waiting for operator approval", "submit");
      addChat("quad", "done. the questionnaire is filled from real enterprise-proof runs. new facts are behind approval receipts before customer-facing use.");
      addLog("act", "approval.required · operator review before submit");
      setActiveView("questionnaire");
      await refreshOperator();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("error");
      setBrowserPhase("browser stream failed");
      addBrowserEvent("error", "workflow.error", message);
      addLog("error", message);
      addChat("quad", `that run failed: ${message}`);
    }
  }

  async function sendComposer(event?: FormEvent) {
    event?.preventDefault();
    const text = composer.trim();
    if (!text || isChatting) return;
    if (/questionnaire|secureflow|vendor/i.test(text)) {
      await runQuestionnaire();
      return;
    }

    setIsChatting(true);
    addChat("user", text);
    setComposer("");
    try {
      addLog("act", "core.run.chat requested");
      const response = await fetch("/api/core/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "chat",
          orgId: ORG_ID,
          text,
          workflow: "enterprise_proof",
          surface: "dashboard",
        }),
      });
      const data = await response.json().catch(() => ({}));
      addChat("quad", data.message ?? data.result?.message ?? data.error ?? "core runtime returned no message.");
      await refreshOperator();
    } catch (err) {
      addChat("quad", `core runtime failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsChatting(false);
    }
  }

  function approveSubmit() {
    setStatus("done");
    setActiveView("questionnaire");
    setBrowserPhase("submitted");
    addBrowserEvent("write", "click submit", "operator approved; questionnaire submitted through controlled browser", "submit");
    addLog("act", `operator.approved · ${answeredCount}/${TRUST_QUESTIONS.length} answers submitted`);
    addChat("quad", "submitted. approval captured locally; run receipts remain visible in the operator ledger.");
  }

  function stopRun() {
    cancelledRef.current = true;
    setStatus("idle");
    setActiveIndex(null);
    setBrowserPhase("stopped");
    addBrowserEvent("pause", "session.paused", "operator stopped the browser workflow");
    addLog("act", "run.cancelled by operator");
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.orgPane}>
        <div className={styles.orgTop}>
          <div className={styles.orgChip}>
            <span className={styles.avatar} style={{ background: "#E11900" }}>✚</span>
            <span className={styles.orgName}>American Red Cross</span>
            <span className={styles.chevron}>⌄</span>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>Employees</div>
          <button className={`${styles.agent} ${styles.agentActive}`} type="button">
            <span className={styles.agentIcon}>□</span>
            Compliance
            <span className={styles.statusDot} />
          </button>
          <button className={styles.agent} type="button">
            <span className={styles.agentIcon}>◇</span>
            Chief of Staff
            <span className={styles.soon}>soon</span>
          </button>
          <button className={styles.agent} type="button">
            <span className={styles.agentIcon}>○</span>
            Growth
            <span className={styles.soon}>soon</span>
          </button>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>Workspace</div>
          <button className={styles.navItem} onClick={() => setActiveView("questionnaire")} type="button">Questionnaires</button>
          <button className={styles.navItem} onClick={() => setActiveView("brain")} type="button">Brain</button>
          <button className={styles.navItem} onClick={() => setActiveView("logs")} type="button">Evidence</button>
          <a className={styles.navItem} href="/app">Classic runtime</a>
          <a className={styles.navItem} href="/quadchain">Quadchain</a>
        </section>

        <div className={styles.operator}>
          <span className={styles.operatorAvatar}>S</span>
          <span>Silas · admin</span>
        </div>
      </aside>

      <section className={styles.workPane}>
        <header className={styles.topbar}>
          <div>
            <strong>Compliance</strong>
            <span> · SecureFlow vendor questionnaire</span>
          </div>
          <div className={`${styles.pill} ${styles[`pill_${status}`]}`}>{status.replace("_", " ")}</div>
        </header>

        <div className={styles.runbar}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.metrics}>
            <span><b>{answeredCount}</b> / {TRUST_QUESTIONS.length} answered</span>
            <span><b>{needsHumanCount}</b> need you</span>
            <span><b>{sourceCount}</b> sources collected</span>
            <span><b>{learnedCount}</b> learned this run</span>
            <span><b>{receiptCount}</b> receipts</span>
          </div>
        </div>

        <div className={styles.thread} ref={threadRef}>
          {answers.length === 0 && status !== "running" ? (
            <div className={styles.emptyState}>
              <div className={styles.glyph}>□</div>
              <h1>Hand Quad a questionnaire.</h1>
              <p>
                it now calls the real enterprise proof api: retrieve brain, collect connector evidence, judge the answer, write back validated facts, and expose the run in operator observability.
              </p>
              <button className={styles.primaryButton} onClick={runQuestionnaire} type="button">
                Run the SecureFlow questionnaire
              </button>
              {error ? <div className={styles.errorText}>{error}</div> : null}
            </div>
          ) : null}

          {chat.map((message) => (
            <div key={message.id} className={`${styles.messageRow} ${message.role === "user" ? styles.userMessage : styles.quadMessage}`}>
              <div className={styles.messageAvatar}>{message.role === "user" ? "S" : "Q"}</div>
              <div className={styles.messageBody}>
                <div className={styles.messageWho}>{message.role === "user" ? "you" : "quad"}</div>
                <p>{message.text}</p>
              </div>
            </div>
          ))}

          {TRUST_QUESTIONS.map((question, index) => {
            const answer = answers.find((item) => item.id === question.id);
            const isActive = activeIndex === index;
            if (!answer && !isActive) return null;
            return answer ? (
              <AnswerCardView key={question.id} answer={answer} onSource={setSelectedSource} />
            ) : (
              <div key={question.id} className={styles.stepLine}>
                <span className={styles.liveDot} />
                q{index + 1}: {question.text}
              </div>
            );
          })}

          {status === "needs_approval" || status === "done" ? (
            <div className={styles.approvalCard}>
              <div>
                <div className={styles.kicker}>approval required before submit</div>
                <h2>{status === "done" ? "questionnaire submitted." : "submit to the vendor portal?"}</h2>
                <p>
                  {answeredCount} answered from {sourceCount} sources · {needsHumanCount} routed to human review · {learnedCount} learned facts protected by receipts.
                </p>
              </div>
              <div className={styles.approvalActions}>
                <button className={styles.secondaryButton} onClick={() => setActiveView("questionnaire")} type="button">review form</button>
                {status !== "done" ? <button className={styles.primaryButton} onClick={approveSubmit} type="button">approve & submit</button> : null}
              </div>
            </div>
          ) : null}
        </div>

        <form className={styles.composer} onSubmit={sendComposer}>
          <label className={styles.composerLabel} htmlFor="quad-composer">message quad</label>
          <input
            id="quad-composer"
            name="quad-composer"
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            placeholder="ask quad, or hand it a questionnaire…"
            autoComplete="off"
          />
          {status === "running" ? (
            <button aria-label="stop questionnaire run" className={styles.iconButton} onClick={stopRun} type="button">×</button>
          ) : null}
          <button aria-label="send message" className={styles.sendButton} disabled={isChatting || status === "resetting"} type="submit">→</button>
        </form>
      </section>

      <aside className={styles.obsPane}>
        <header className={styles.obsTop}>
          <span>Observability</span>
          <span className={styles.miniStatus}>{operator?.backendReadiness?.ready ? "ready" : "live"}</span>
        </header>

        <div className={styles.tabs}>
          <button className={activeView === "brain" ? styles.tabActive : ""} onClick={() => setActiveView("brain")} type="button">Brain <span>{brainMemories.length || graphNodes.length}</span></button>
          <button className={activeView === "questionnaire" ? styles.tabActive : ""} onClick={() => setActiveView("questionnaire")} type="button">Questionnaire</button>
          <button className={activeView === "logs" ? styles.tabActive : ""} onClick={() => setActiveView("logs")} type="button">Logs <span>{logs.length}</span></button>
        </div>

        <div className={styles.obsBody}>
          {activeView === "brain" ? (
            <BrainPanel nodes={graphNodes} operator={operator} capabilityCount={capabilityCount} latestRun={latestRun} />
          ) : null}
          {activeView === "questionnaire" ? (
            <QuestionnairePanel
              questions={TRUST_QUESTIONS}
              answers={answers}
              status={status}
              activeIndex={activeIndex}
              browserEvents={browserEvents}
              browserPhase={browserPhase}
            />
          ) : null}
          {activeView === "logs" ? (
            <LogsPanel logs={logs} />
          ) : null}
        </div>
      </aside>

      {selectedSource ? (
        <div className={styles.modalBackdrop} onClick={() => setSelectedSource(null)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHead}>
              <span>{selectedSource.kind} evidence</span>
              <button onClick={() => setSelectedSource(null)} type="button">×</button>
            </div>
            <h3>{selectedSource.title}</h3>
            <pre>{selectedSource.quote || selectedSource.id}</pre>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function AnswerCardView({ answer, onSource }: { answer: AnswerCard; onSource: (source: TrustSource) => void }) {
  return (
    <article className={`${styles.answerCard} ${answer.status === "needs_human" ? styles.answerNeedsHuman : ""}`}>
      <div className={styles.answerHead}>
        <span className={styles.answerStatus}>{answer.status === "answered" ? (answer.reused ? "reused" : "answered") : "needs human"}</span>
        <span className={styles.answerQuestion}>{answer.question}</span>
        <span className={styles.confidence}>{pct(answer.confidence)}</span>
      </div>
      <p>{answer.answer}</p>
      <div className={styles.sourceRow}>
        {answer.sources.length ? (
          answer.sources.map((source) => (
            <button key={`${answer.id}-${source.id}`} onClick={() => onSource(source)} type="button">
              {sourceLabel(source)}
            </button>
          ))
        ) : (
          <span>no supporting source returned</span>
        )}
      </div>
      <div className={styles.receiptRow}>
        {answer.certificateId ? <span>quadchain · {answer.certificateId}</span> : null}
        {answer.runId ? <span>run · {answer.runId}</span> : null}
        {answer.approvalRequired ? <span>approval required</span> : null}
        {answer.learnedTitle ? <span>{answer.reused ? "reused" : "learned"} · {answer.learnedTitle}</span> : null}
      </div>
    </article>
  );
}

function BrainPanel({
  nodes,
  operator,
  capabilityCount,
  latestRun,
}: {
  nodes: BrainGraphNode[];
  operator: OperatorState | null;
  capabilityCount: number;
  latestRun: OperatorRunSummary | null;
}) {
  return (
    <div className={styles.brainPanel}>
      <div className={styles.brainHeader}>
        <div>
          <span>company brain</span>
          <small>{operator?.memory?.memories?.length ?? nodes.length} verified memories · drag to explore</small>
        </div>
        <strong>{operator?.backendReadiness?.ready ? "live" : "local"}</strong>
      </div>
      <DashboardMemoryGraph nodes={nodes} />
      <div className={styles.brainStats}>
        <span>capabilities <b>{capabilityCount}</b></span>
        <span>evidence <b>{operator?.evidence?.total ?? 0}</b></span>
        <span>quadchain <b>{operator?.quadChain?.total ?? 0}</b></span>
      </div>
      {latestRun ? (
        <div className={styles.runSnapshot}>
          <div className={styles.kicker}>latest run</div>
          <strong>{latestRun.title}</strong>
          <p>{latestRun.status} · {latestRun.nextAction}</p>
        </div>
      ) : null}
    </div>
  );
}

function DashboardMemoryGraph({ nodes }: { nodes: BrainGraphNode[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const labels = (nodes.length ? nodes : [
      { id: "security", label: "Security", kind: "memory", answerId: null },
      { id: "mfa", label: "MFA policy", kind: "brain", answerId: null },
      { id: "soc2", label: "SOC 2", kind: "connector", answerId: null },
      { id: "access", label: "Access reviews", kind: "memory", answerId: null },
      { id: "privacy", label: "Privacy posture", kind: "connector", answerId: null },
      { id: "deletion", label: "Deletion SLA", kind: "memory", answerId: null },
      { id: "regions", label: "Data regions", kind: "brain", answerId: null },
      { id: "pen-test", label: "Pen test", kind: "connector", answerId: null },
    ]).slice(0, 24);

    const seed = labels.reduce((sum, node) => sum + node.label.charCodeAt(0) * 17 + node.id.length, 2161);
    const rand = createSeededRandom(seed);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const norm = (value: number[]) => {
      const magnitude = Math.hypot(value[0], value[1], value[2]) || 1;
      return [value[0] / magnitude, value[1] / magnitude, value[2] / magnitude];
    };
    const hueFor = (kind: string, index: number) => {
      if (kind === "connector") return 214 + (index % 4) * 8;
      if (kind === "memory" || kind === "brain") return 318 + (index % 5) * 7;
      return 148 + (index % 4) * 8;
    };

    type VizNode = { bx: number; by: number; bz: number; r: number; hue: number; light: number; label: string | null; hub: boolean };

    const vizNodes: VizNode[] = [];
    const edges: [number, number][] = [];
    labels.forEach((node, index) => {
      const y = 1 - (index / Math.max(labels.length - 1, 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = index * golden;
      const center = [Math.cos(theta) * radius, y, Math.sin(theta) * radius];
      const base = vizNodes.length;
      const hue = hueFor(node.kind, index);
      vizNodes.push({ bx: center[0], by: center[1], bz: center[2], r: 3.8, hue, light: 72, label: node.label, hub: true });
      for (let child = 0; child < 8; child += 1) {
        const jitter = norm([
          center[0] + (rand() - 0.5) * 0.7,
          center[1] + (rand() - 0.5) * 0.7,
          center[2] + (rand() - 0.5) * 0.7,
        ]);
        const shell = 0.88 + rand() * 0.16;
        vizNodes.push({
          bx: jitter[0] * shell,
          by: jitter[1] * shell,
          bz: jitter[2] * shell,
          r: child < 2 ? 1.9 : 0.85 + rand() * 1.1,
          hue,
          light: 50 + rand() * 16,
          label: child === 0 ? node.kind : null,
          hub: false,
        });
        edges.push([base, base + child + 1]);
      }
      if (index > 0) edges.push([base, Math.max(0, base - 9)]);
    });

    const fieldCount = Math.max(90, 170 - labels.length * 2);
    for (let index = 0; index < fieldCount; index += 1) {
      const y = 1 - (index / Math.max(fieldCount - 1, 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = index * golden;
      const shell = 0.93 + rand() * 0.1;
      vizNodes.push({
        bx: Math.cos(theta) * radius * shell,
        by: y * shell,
        bz: Math.sin(theta) * radius * shell,
        r: 0.7 + rand() * 0.9,
        hue: hueFor(labels[index % labels.length]?.kind ?? "memory", index),
        light: 46 + rand() * 12,
        label: null,
        hub: false,
      });
    }

    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let sphereRadius = 1;
    let perspective = 1;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      centerX = width / 2;
      centerY = height / 2;
      sphereRadius = Math.min(width, height) * 0.44;
      perspective = sphereRadius * 2.65;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    let angleY = 0.48;
    let tilt = 0.4;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let velocityY = 0;
    const onDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      velocityY = (event.clientX - lastX) * 0.006;
      angleY += velocityY;
      tilt = Math.max(-1.05, Math.min(1.05, tilt + (event.clientY - lastY) * 0.006));
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onUp = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onUp);

    const total = vizNodes.length;
    const order = vizNodes.map((_, index) => index);
    const sx = new Float32Array(total);
    const sy = new Float32Array(total);
    const scale = new Float32Array(total);
    const alpha = new Float32Array(total);
    const depth = new Float32Array(total);

    const frame = () => {
      if (!dragging) {
        angleY += 0.002;
        velocityY *= 0.94;
        angleY += velocityY;
      }
      const cosAngle = Math.cos(angleY);
      const sinAngle = Math.sin(angleY);
      const cosTilt = Math.cos(tilt);
      const sinTilt = Math.sin(tilt);
      for (let index = 0; index < total; index += 1) {
        const node = vizNodes[index];
        const x = node.bx * cosAngle + node.bz * sinAngle;
        const z = -node.bx * sinAngle + node.bz * cosAngle;
        const y = node.by * cosTilt - z * sinTilt;
        const z2 = node.by * sinTilt + z * cosTilt;
        const projectedDepth = z2 * sphereRadius;
        const s = perspective / (perspective + projectedDepth);
        sx[index] = centerX + x * sphereRadius * s;
        sy[index] = centerY + y * sphereRadius * s;
        scale[index] = s;
        depth[index] = projectedDepth;
        alpha[index] = 0.18 + 0.82 * ((sphereRadius - projectedDepth) / (2 * sphereRadius));
      }

      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sphereRadius * 1.22);
      gradient.addColorStop(0, "rgba(255,92,171,0.08)");
      gradient.addColorStop(0.44, "rgba(122,168,255,0.04)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(255,170,215,0.055)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      edges.forEach(([a, b]) => {
        ctx.moveTo(sx[a], sy[a]);
        ctx.lineTo(sx[b], sy[b]);
      });
      ctx.stroke();

      order.sort((a, b) => depth[b] - depth[a]);
      order.forEach((index) => {
        const node = vizNodes[index];
        ctx.globalAlpha = alpha[index];
        ctx.fillStyle = `hsl(${node.hue}, 78%, ${node.light}%)`;
        ctx.beginPath();
        ctx.arc(sx[index], sy[index], Math.max(0.4, node.r * scale[index]), 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      let drawn = 0;
      for (let orderIndex = total - 1; orderIndex >= 0 && drawn < 28; orderIndex -= 1) {
        const index = order[orderIndex];
        const node = vizNodes[index];
        if (!node.label || alpha[index] < 0.7) continue;
        ctx.globalAlpha = Math.min(1, (alpha[index] - 0.58) * 2.6);
        ctx.fillStyle = node.hub ? "rgba(255,255,255,0.94)" : "rgba(243,239,243,0.68)";
        ctx.font = `${node.hub ? 10 : 8}px "IBM Plex Mono", ui-monospace, monospace`;
        ctx.fillText(node.label.slice(0, 24), sx[index], sy[index] + node.r * scale[index] + 4);
        drawn += 1;
      }
      ctx.globalAlpha = 1;
      canvas.style.cursor = dragging ? "grabbing" : "grab";
    };

    let raf = 0;
    let running = false;
    const loop = () => {
      frame();
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!running && !reduce) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    let visibilityObserver: IntersectionObserver | null = null;
    if (reduce) frame();
    else {
      visibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
      });
      visibilityObserver.observe(wrap);
    }

    return () => {
      visibilityObserver?.disconnect();
      stop();
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
    };
  }, [nodes]);

  return (
    <div ref={wrapRef} className={styles.brainGraphShell}>
      <canvas ref={canvasRef} className={styles.brainGraphCanvas} aria-label="interactive company brain graph" />
    </div>
  );
}

function QuestionnairePanel({
  questions,
  answers,
  status,
  activeIndex,
  browserEvents,
  browserPhase,
}: {
  questions: TrustQuestion[];
  answers: AnswerCard[];
  status: RunStatus;
  activeIndex: number | null;
  browserEvents: BrowserEvent[];
  browserPhase: string;
}) {
  const latestEvents = browserEvents.slice(-7).reverse();

  return (
    <div className={styles.formPanel}>
      <div className={styles.browserBar}>
        <span />
        <span />
        <span />
        <strong>trust.secureflow.com/vendor/redcross</strong>
      </div>
      <section className={styles.browserStream}>
        <div className={styles.browserStreamHead}>
          <div>
            <div className={styles.kicker}>browserbase write stream</div>
            <strong>{browserPhase}</strong>
          </div>
          <span className={styles.browserLive}>{status === "running" || status === "resetting" ? "live" : "ready"}</span>
        </div>
        <div className={styles.browserViewport}>
          <div className={styles.vendorHeader}>
            <span>secureflow trust portal</span>
            <b>vendor: American Red Cross</b>
          </div>
          <div className={styles.browserEventList}>
            {latestEvents.length ? (
              latestEvents.map((event) => (
                <div key={event.id} className={`${styles.browserEvent} ${styles[`browser_${event.tone}`]}`}>
                  <span>{event.label}</span>
                  <p>{event.detail}</p>
                </div>
              ))
            ) : (
              <div className={styles.browserEmpty}>controlled browser will stream actions here</div>
            )}
          </div>
        </div>
      </section>
      <div className={styles.formScroll}>
        <h2>Vendor Security Questionnaire</h2>
        <p>SecureFlow · SIG-lite · {questions.length} items</p>
        {questions.map((question, index) => {
          const answer = answers.find((item) => item.id === question.id);
          const isActive = activeIndex === index;
          return (
            <label key={question.id} className={`${styles.field} ${isActive ? styles.fieldActive : ""}`}>
              <span>{index + 1}. {question.text}</span>
              <div className={`${styles.fieldValue} ${answer?.status === "needs_human" ? styles.fieldFlagged : ""}`}>
                {answer ? answer.status === "answered" ? answer.answer : "flagged for human review" : isActive ? "quad is typing through browserbase…" : status === "running" ? "waiting…" : ""}
              </div>
            </label>
          );
        })}
        <div className={`${styles.submitButton} ${status === "done" ? styles.submitDone : ""}`}>
          {status === "done" ? "submitted" : "submit questionnaire"}
        </div>
      </div>
    </div>
  );
}

function LogsPanel({ logs }: { logs: LogLine[] }) {
  return (
    <div className={styles.logsPanel}>
      {logs.length ? logs.map((log) => (
        <div key={log.id} className={`${styles.logLine} ${styles[`log_${log.tone}`]}`}>
          <span>{log.tone}</span>
          {log.text}
        </div>
      )) : <div className={styles.emptyLogs}>no run logs yet</div>}
    </div>
  );
}
