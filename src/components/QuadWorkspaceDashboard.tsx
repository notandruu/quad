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

type LogLine = {
  id: string;
  tone: "read" | "collect" | "learn" | "judge" | "act" | "error";
  text: string;
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

export function QuadWorkspaceDashboard() {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [answers, setAnswers] = useState<AnswerCard[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
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

  function addChat(role: ChatMessage["role"], text: string) {
    setChat((current) => [...current, { id: uid("msg"), role, text }]);
  }

  async function runQuestionnaire() {
    if (status === "running" || status === "resetting") return;
    cancelledRef.current = false;
    setStatus("resetting");
    setError(null);
    setAnswers([]);
    setLogs([]);
    setActiveIndex(null);
    setActiveView("brain");
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

        const response = await fetch("/api/enterprise-proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: ORG_ID,
            question: question.text,
            targetVisibility: "company",
          }),
        });
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
        await refreshOperator();
      }

      setActiveIndex(null);
      setStatus("needs_approval");
      addChat("quad", "done. the questionnaire is filled from real enterprise-proof runs. new facts are behind approval receipts before customer-facing use.");
      addLog("act", "approval.required · operator review before submit");
      setActiveView("questionnaire");
      await refreshOperator();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("error");
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
    addLog("act", `operator.approved · ${answeredCount}/${TRUST_QUESTIONS.length} answers submitted`);
    addChat("quad", "submitted. approval captured locally; run receipts remain visible in the operator ledger.");
  }

  function stopRun() {
    cancelledRef.current = true;
    setStatus("idle");
    setActiveIndex(null);
    addLog("act", "run.cancelled by operator");
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.orgPane}>
        <div className={styles.orgTop}>
          <div className={styles.orgChip}>
            <span className={styles.avatar}>A</span>
            <span className={styles.orgName}>Acme Software</span>
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
            <div key={message.id} className={`${styles.message} ${message.role === "user" ? styles.userMessage : styles.quadMessage}`}>
              {message.role === "quad" ? <div className={styles.messageWho}>Quad</div> : null}
              {message.text}
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
          <input
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            placeholder="ask quad, or hand it a questionnaire..."
          />
          {status === "running" ? (
            <button className={styles.iconButton} onClick={stopRun} type="button">×</button>
          ) : null}
          <button className={styles.sendButton} disabled={isChatting || status === "resetting"} type="submit">→</button>
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
            <QuestionnairePanel questions={TRUST_QUESTIONS} answers={answers} status={status} />
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
  nodes: Array<{ id: string; label: string; kind: string; answerId: string | null }>;
  operator: OperatorState | null;
  capabilityCount: number;
  latestRun: OperatorRunSummary | null;
}) {
  return (
    <div className={styles.brainPanel}>
      <div className={styles.brainHeader}>
        <span>company brain</span>
        <strong>{operator?.memory?.memories?.length ?? nodes.length} artifacts</strong>
      </div>
      <div className={styles.graph}>
        <div className={styles.rootNode}>Acme</div>
        {nodes.map((node, index) => {
          const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
          const radius = 36 + (index % 3) * 18;
          const x = 50 + Math.cos(angle) * radius;
          const y = 50 + Math.sin(angle) * radius;
          return (
            <div
              key={`${node.kind}-${node.id}-${index}`}
              className={`${styles.graphNode} ${styles[`node_${node.kind}`] ?? ""}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              title={node.label}
            >
              {node.label.slice(0, 22)}
            </div>
          );
        })}
      </div>
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

function QuestionnairePanel({
  questions,
  answers,
  status,
}: {
  questions: TrustQuestion[];
  answers: AnswerCard[];
  status: RunStatus;
}) {
  return (
    <div className={styles.formPanel}>
      <div className={styles.browserBar}>
        <span />
        <span />
        <span />
        <strong>trust.secureflow.com/vendor/acme</strong>
      </div>
      <div className={styles.formScroll}>
        <h2>Vendor Security Questionnaire</h2>
        <p>SecureFlow · SIG-lite · {questions.length} items</p>
        {questions.map((question, index) => {
          const answer = answers.find((item) => item.id === question.id);
          return (
            <label key={question.id} className={styles.field}>
              <span>{index + 1}. {question.text}</span>
              <div className={`${styles.fieldValue} ${answer?.status === "needs_human" ? styles.fieldFlagged : ""}`}>
                {answer ? answer.status === "answered" ? answer.answer : "flagged for human review" : status === "running" ? "waiting..." : ""}
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
