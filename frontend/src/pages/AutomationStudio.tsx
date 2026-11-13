import { useEffect, useState } from "react";
import { Icon } from "../components/layout/Icon";
import { getToken } from "../hooks/useAuth";
import type {
  AutomationEnvironmentOption,
  AutomationExecutionListItem,
  AutomationExecutionListResponse,
  AutomationPublishResponse,
  AutomationTestRunResponse,
  AutomationTraceResponse,
  AutomationWorkflowOption,
  ExecutionStep,
  PinnedDatasetName,
} from "../types/automation";

type NodeId = "trigger" | "condition" | "notify" | "review";
type InspectorTab = "settings" | "input" | "output";

const nodeInfo: Record<
  NodeId,
  {
    title: string;
    kind: string;
    description: string;
    input: string;
    output: string;
  }
> = {
  trigger: {
    title: "Task status changed",
    kind: "Trigger · Project Manager",
    description: "Begins when a confirmed task event is received.",
    input: "event: task.updated\nstatus: blocked",
    output: "items: 1",
  },
  condition: {
    title: "Dependency check",
    kind: "Decision · Branch",
    description: "Routes a task only when its blocking status is confirmed.",
    input: "task_id: sample-042\nstatus: blocked\nblocked_by: sample-028",
    output: "branch: YES\nitems: 1",
  },
  notify: {
    title: "Notify task owner",
    kind: "Action · Connector",
    description: "Would send a scoped message to the task owner.",
    input: "target: assignee\nmessage: dependency context",
    output: "delivery: queued",
  },
  review: {
    title: "Request human review",
    kind: "Human gate · Approval",
    description: "Pauses any consequential action until a reviewer decides.",
    input: "reviewer: project owner\nchange: status update",
    output: "state: awaiting_review",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function extractArray<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!isRecord(payload)) return [];

  const keyedValue = payload[key];
  if (Array.isArray(keyedValue)) return keyedValue as T[];

  const items = payload.items;
  if (Array.isArray(items)) return items as T[];

  if (typeof payload.data !== "undefined") {
    return extractArray<T>(payload.data, key);
  }

  return [];
}

function extractWorkflow(payload: unknown): AutomationWorkflowOption | null {
  if (!isRecord(payload)) return null;

  if (
    typeof payload.workflow_id === "string" &&
    typeof payload.project_id === "string" &&
    typeof payload.name === "string"
  ) {
    return payload as unknown as AutomationWorkflowOption;
  }

  if (isRecord(payload.workflow)) {
    return extractWorkflow(payload.workflow);
  }

  if (typeof payload.data !== "undefined") {
    return extractWorkflow(payload.data);
  }

  return null;
}

async function apiJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const rawBody = await response.text();
  let payload: unknown = {};

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : isRecord(payload) && typeof payload.message === "string"
          ? payload.message
          : `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload as T;
}

function formatStepPreview(value: string | undefined): string {
  if (!value) return "No preview data was returned.";
  return value;
}

export default function AutomationStudio() {
  const [selected, setSelected] = useState<NodeId>("condition");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("settings");
  const [executionTab, setExecutionTab] = useState<"history" | "failures">(
    "history",
  );

  const [projectId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("project_id") ??
      window.localStorage.getItem("pm-selected-project") ??
      ""
    );
  });

  const [requestedWorkflowId] = useState(() => {
    return new URLSearchParams(window.location.search).get("workflow_id") ?? "";
  });

  const [workflows, setWorkflows] = useState<AutomationWorkflowOption[]>([]);
  const [environments, setEnvironments] = useState<
    AutomationEnvironmentOption[]
  >([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("");
  const [dataset, setDataset] = useState<PinnedDatasetName>("sample-01");

  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [environmentLoading, setEnvironmentLoading] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
const [publishing, setPublishing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [executions, setExecutions] = useState<
    AutomationExecutionListItem[]
  >([]);
  const [activeTrace, setActiveTrace] =
    useState<AutomationTraceResponse | null>(null);
  const [selectedStepId, setSelectedStepId] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);

  const info = nodeInfo[selected];

  const selectedWorkflow = workflows.find(
    (workflow) => workflow.workflow_id === selectedWorkflowId,
  );

  const activeTraceStep: ExecutionStep | undefined =
    activeTrace?.steps.find((step) => step.step_id === selectedStepId) ??
    activeTrace?.steps[0];

  useEffect(() => {
    let cancelled = false;

    async function loadWorkflows(): Promise<void> {
      setWorkflowLoading(true);
      setApiError(null);

      try {
        const query = projectId
          ? `?project_id=${encodeURIComponent(projectId)}`
          : "";

        const payload = await apiJson<unknown>(
          `/api/v1/automation/workflows${query}`,
        );

        let choices = extractArray<AutomationWorkflowOption>(
          payload,
          "workflows",
        );

        if (
          requestedWorkflowId &&
          !choices.some(
            (workflow) =>
              workflow.workflow_id === requestedWorkflowId,
          )
        ) {
          try {
            const detail = await apiJson<unknown>(
              `/api/v1/automation/workflows/${encodeURIComponent(
                requestedWorkflowId,
              )}`,
            );

            const workflow = extractWorkflow(detail);
            if (workflow) choices = [...choices, workflow];
          } catch {
            // Keep the list response; an inaccessible URL workflow is ignored.
          }
        }

        if (cancelled) return;

        setWorkflows(choices);

        const requestedChoice = choices.find(
          (workflow) =>
            workflow.workflow_id === requestedWorkflowId,
        );

        setSelectedWorkflowId(
          requestedChoice?.workflow_id ??
            choices[0]?.workflow_id ??
            "",
        );
      } catch (error) {
        if (!cancelled) {
          setApiError(
            error instanceof Error
              ? error.message
              : "Unable to load workflows.",
          );
          setWorkflows([]);
          setSelectedWorkflowId("");
        }
      } finally {
        if (!cancelled) setWorkflowLoading(false);
      }
    }

    void loadWorkflows();

    return () => {
      cancelled = true;
    };
  }, [projectId, requestedWorkflowId]);

  useEffect(() => {
    let cancelled = false;

    async function loadEnvironments(): Promise<void> {
      if (!selectedWorkflow) {
        setEnvironments([]);
        setSelectedEnvironmentId("");
        return;
      }

      setEnvironmentLoading(true);
      setSelectedEnvironmentId("");

      try {
        const activeProjectId = selectedWorkflow.project_id;
        const payload = await apiJson<unknown>(
          `/api/v1/automation/environments?project_id=${encodeURIComponent(
            activeProjectId,
          )}`,
        );

        const available = extractArray<AutomationEnvironmentOption>(
          payload,
          "environments",
        ).filter(
          (environment) =>
            environment.mode === "preview" &&
            Number(environment.is_live) === 0 &&
            environment.project_id === activeProjectId,
        );

        if (cancelled) return;

        setEnvironments(available);
        setSelectedEnvironmentId(
          available[0]?.environment_id ?? "",
        );
      } catch (error) {
        if (!cancelled) {
          setEnvironments([]);
          setSelectedEnvironmentId("");
          setApiError(
            error instanceof Error
              ? error.message
              : "Unable to load preview environments.",
          );
        }
      } finally {
        if (!cancelled) setEnvironmentLoading(false);
      }
    }

    void loadEnvironments();

    return () => {
      cancelled = true;
    };
  }, [selectedWorkflow?.project_id]);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory(): Promise<void> {
      if (!selectedWorkflowId) {
        setExecutions([]);
        setActiveTrace(null);
        setSelectedStepId("");
        return;
      }

      setHistoryLoading(true);

      try {
        const payload = await apiJson<AutomationExecutionListResponse>(
          `/api/automation/executions?workflow_id=${encodeURIComponent(
            selectedWorkflowId,
          )}&limit=50&offset=0`,
        );

        if (cancelled) return;

        setExecutions(
          Array.isArray(payload.executions)
            ? payload.executions
            : [],
        );
      } catch (error) {
        if (!cancelled) {
          setExecutions([]);
          setApiError(
            error instanceof Error
              ? error.message
              : "Unable to load execution history.",
          );
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [selectedWorkflowId, historyRefresh]);

  async function loadExecutionTrace(executionId: string): Promise<void> {
    const trace = await apiJson<AutomationTraceResponse>(
      `/api/automation/executions/${encodeURIComponent(executionId)}`,
    );

    setActiveTrace(trace);
    setSelectedStepId(trace.steps[0]?.step_id ?? "");
  }

  async function runPinnedTest(): Promise<void> {
    if (!selectedWorkflowId || !selectedEnvironmentId) return;

    setTestRunning(true);
    setApiError(null);

    try {
      const result = await apiJson<AutomationTestRunResponse>(
        `/api/automation/workflows/${encodeURIComponent(
          selectedWorkflowId,
        )}/test`,
        {
          method: "POST",
          body: JSON.stringify({
            dataset,
            environment_id: selectedEnvironmentId,
          }),
        },
      );

      await loadExecutionTrace(result.execution.execution_id);
      setExecutionTab("history");
      setHistoryRefresh((value) => value + 1);
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Unable to run the pinned test.",
      );
    } finally {
      setTestRunning(false);
    }
  }

  async function publishSelectedWorkflow(): Promise<void> {
    if (!selectedWorkflowId) return;

    setPublishing(true);
    setApiError(null);

    try {
      await apiJson<AutomationPublishResponse>(
        `/api/v1/automation/workflows/${encodeURIComponent(
          selectedWorkflowId,
        )}/publish`,
        {
          method: "POST",
        },
      );

      setApiError(null);

      const query = projectId
        ? `?project_id=${encodeURIComponent(projectId)}`
        : "";

      const payload = await apiJson<unknown>(
        `/api/v1/automation/workflows${query}`,
      );

      const choices = extractArray<AutomationWorkflowOption>(
        payload,
        "workflows",
      );

      setWorkflows(choices);

      const updated = choices.find(
        (w) => w.workflow_id === selectedWorkflowId,
      );
      if (updated) {
        setSelectedWorkflowId(updated.workflow_id);
      }
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Unable to publish the workflow.",
      );
    } finally {
      setPublishing(false);
    }
  }

  const visibleExecutions =
    executionTab === "failures"
      ? executions.filter(
          (execution) =>
            execution.status === "failed" ||
            execution.status === "error",
        )
      : executions;

  return (
    <div className="pm-page pm-automation-page">
      <header className="pm-page-heading">
        <div>
          <div className="pm-kicker">
            AUTOMATION STUDIO · FUTURE MODULE
          </div>
          <h1>
            Make automation inspectable before it becomes executable.
          </h1>
          <p>
            Project Canvas maps work. Automation Studio previews pinned
            workflow data without performing live actions.
          </p>
        </div>
        <div className="pm-heading-actions">
          <span className="pm-future-notice">
            Preview only · no live runtime
          </span>
          <button
            className="pm-secondary-button"
            disabled={
              !selectedWorkflow ||
              selectedWorkflow.status !== "draft" ||
              publishing
            }
            onClick={publishSelectedWorkflow}
            title={
              selectedWorkflow?.status !== "draft"
                ? "Only draft workflows can be published."
                : publishing
                ? "Publishing workflow…"
                : "Publish workflow (preview only · no live runtime)"
            }
          >
            {publishing ? "Publishing…" : "Publish workflow"}
          </button>
        </div>
      </header>

      <section
        className="pm-automation-test-controls"
        aria-label="Pinned test configuration"
      >
        <label>
          Workflow
          <select
            value={selectedWorkflowId}
            onChange={(event) => {
              setSelectedWorkflowId(event.target.value);
              setActiveTrace(null);
              setSelectedStepId("");
            }}
            disabled={workflowLoading || workflows.length === 0}
          >
            <option value="">
              {workflowLoading
                ? "Loading workflows…"
                : "Select workflow"}
            </option>
            {workflows.map((workflow) => (
              <option
                key={workflow.workflow_id}
                value={workflow.workflow_id}
              >
                {workflow.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Preview environment
          <select
            value={selectedEnvironmentId}
            onChange={(event) =>
              setSelectedEnvironmentId(event.target.value)
            }
            disabled={
              environmentLoading ||
              !selectedWorkflowId ||
              environments.length === 0
            }
          >
            <option value="">
              {environmentLoading
                ? "Loading environments…"
                : "Select preview environment"}
            </option>
            {environments.map((environment) => (
              <option
                key={environment.environment_id}
                value={environment.environment_id}
              >
                {environment.name} · Preview
              </option>
            ))}
          </select>
        </label>

        <label>
          Pinned dataset
          <select
            value={dataset}
            onChange={(event) =>
              setDataset(event.target.value as PinnedDatasetName)
            }
          >
            <option value="sample-01">sample-01</option>
            <option value="sample-042">sample-042</option>
            <option value="fail-branch">fail-branch</option>
          </select>
        </label>

        <button
          className="pm-secondary-button"
          type="button"
          onClick={() => void runPinnedTest()}
          disabled={
            testRunning ||
            workflowLoading ||
            environmentLoading ||
            !selectedWorkflowId ||
            !selectedEnvironmentId
          }
        >
          {testRunning ? "Running pinned test…" : "Run pinned test"}
        </button>

        <p className="pm-inspector-warning">
          Test mode uses sample data and mocked connector responses only.
          No live connector, message, task, or HTTP write is performed.
        </p>

        {apiError && (
          <p className="pm-inspector-warning" role="alert">
            {apiError}
          </p>
        )}
      </section>

      <div className="pm-automation-layout">
        <aside className="pm-automation-library">
          <div className="pm-library-title">Node library</div>
          <div className="pm-library-search">
            <Icon name="search" size={13} />
            Search approved nodes
          </div>
          <section>
            <small>Start</small>
            <button onClick={() => setSelected("trigger")}>
              <Icon name="automation" size={14} />
              Task event
            </button>
          </section>
          <section>
            <small>Logic</small>
            <button onClick={() => setSelected("condition")}>
              <span className="pm-node-letter warning">◇</span>
              Condition
            </button>
          </section>
          <section>
            <small>Actions</small>
            <button onClick={() => setSelected("notify")}>
              <span className="pm-node-letter success">↗</span>
              Connector action
            </button>
            <button onClick={() => setSelected("review")}>
              <span className="pm-node-letter success">✓</span>
              Human gate
            </button>
          </section>
          <section>
            <small>Safety</small>
            <button>
              <span className="pm-node-letter danger">!</span>
              Error handler
            </button>
          </section>
        </aside>

        <section className="pm-automation-canvas">
          <div className="pm-canvas-tools">
            <button className="is-active">Select</button>
            <button>+ Node</button>
            <button>Fit</button>
            <button>Sample data</button>
          </div>
          <span className="pm-draft-tag">Draft · test only</span>
          <svg
            className="pm-workflow-lines"
            viewBox="0 0 950 500"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M222 225 C275 225 280 225 340 225" />
            <path className="yes" d="M505 225 C585 225 580 130 650 130" />
            <path className="no" d="M505 225 C585 225 580 335 650 335" />
            <path className="yes" d="M815 130 C860 130 855 225 890 225" />
            <path className="no" d="M815 335 C860 335 855 225 890 225" />
          </svg>
          <span className="pm-flow-label yes">YES</span>
          <span className="pm-flow-label no">NO</span>
          <button
            className={`pm-flow-node trigger${
              selected === "trigger" ? " is-selected" : ""
            }`}
            onClick={() => setSelected("trigger")}
          >
            <span className="pm-node-symbol">↻</span>
            <span>
              <strong>Task status changed</strong>
              <small>Trigger · Project Manager</small>
            </span>
            <em>event: task.updated</em>
          </button>
          <button
            className={`pm-flow-node condition${
              selected === "condition" ? " is-selected" : ""
            }`}
            onClick={() => setSelected("condition")}
          >
            <span className="pm-node-symbol warning">◇</span>
            <span>
              <strong>Dependency check</strong>
              <small>Decision · Branch</small>
            </span>
            <em>status = blocked</em>
          </button>
          <button
            className={`pm-flow-node notify${
              selected === "notify" ? " is-selected" : ""
            }`}
            onClick={() => setSelected("notify")}
          >
            <span className="pm-node-symbol success">↗</span>
            <span>
              <strong>Notify task owner</strong>
              <small>Action · Connector</small>
            </span>
            <em>target: assignee</em>
          </button>
          <button
            className={`pm-flow-node review${
              selected === "review" ? " is-selected" : ""
            }`}
            onClick={() => setSelected("review")}
          >
            <span className="pm-node-symbol success">✓</span>
            <span>
              <strong>Request human review</strong>
              <small>Human gate · Approval</small>
            </span>
            <em>reviewer: owner</em>
          </button>
          <div className="pm-flow-end">
            <span>·</span>
            <strong>Record</strong>
            <small>Result</small>
          </div>
          <span className="pm-zoom">− &nbsp;100%&nbsp; +</span>
        </section>

        <aside className="pm-node-inspector">
          <header>
            <div>
              <small>Node inspector</small>
              <h2>{info.title}</h2>
            </div>
            <Icon name="close" size={15} />
          </header>
          <nav>
            <button
              className={
                inspectorTab === "settings" ? "is-active" : ""
              }
              onClick={() => setInspectorTab("settings")}
            >
              Settings
            </button>
            <button
              className={inspectorTab === "input" ? "is-active" : ""}
              onClick={() => setInspectorTab("input")}
            >
              Input
            </button>
            <button
              className={inspectorTab === "output" ? "is-active" : ""}
              onClick={() => setInspectorTab("output")}
            >
              Output
            </button>
          </nav>
          <div className="pm-inspector-content">
            {inspectorTab === "settings" && (
              <>
                <label>
                  Node name
                  <input value={info.title} readOnly />
                </label>
                <label>
                  Purpose
                  <textarea
                    value={info.description}
                    readOnly
                    rows={3}
                  />
                </label>
                <div className="pm-inspector-divider" />
                <h3>Node kind</h3>
                <pre>{info.kind}</pre>
                <p className="pm-inspector-warning">
                  Test mode records redacted pinned input/output. Publishing,
                  live execution, and external connector actions remain
                  disabled.
                </p>
              </>
            )}
            {inspectorTab === "input" && (
              <>
                <h3>Sample input preview</h3>
                <pre>{info.input}</pre>
                <div className="pm-inspector-divider" />
                <h3>Input schema</h3>
                <pre>{`{
  "task_id": "string",
  "status": "blocked | in_progress | done",
  "blocked_by": "string (optional)"
}`}</pre>
                <p className="pm-inspector-warning">
                  Input values are illustrative or pinned. The test runner
                  does not read live connector data.
                </p>
              </>
            )}
            {inspectorTab === "output" && (
              <>
                <h3>Sample output preview</h3>
                <pre>{info.output}</pre>
                <div className="pm-inspector-divider" />
                <h3>Output schema</h3>
                <pre>{`{
  "branch": "YES | NO",
  "items": "number",
  "delivery": "mocked | skipped | failed"
}`}</pre>
                <p className="pm-inspector-warning">
                  Connector output is a pinned mock response. No delivery
                  is attempted.
                </p>
              </>
            )}
          </div>
        </aside>

        <section className="pm-execution-drawer">
          <aside>
            <header>Execution history</header>
            <button
              className={executionTab === "history" ? "is-active" : ""}
              onClick={() => setExecutionTab("history")}
            >
              <i />
              Test runs
              <span>
                {historyLoading ? "loading…" : executions.length}
              </span>
            </button>
            <button
              className={executionTab === "failures" ? "is-active" : ""}
              onClick={() => setExecutionTab("failures")}
            >
              <i />
              Failures
              <span>
                {
                  executions.filter(
                    (execution) =>
                      execution.status === "failed" ||
                      execution.status === "error",
                  ).length
                }
              </span>
            </button>

            <div className="pm-step-list">
              {visibleExecutions.map((execution) => (
                <button
                  key={execution.execution_id}
                  type="button"
                  className={
                    activeTrace?.execution.execution_id ===
                    execution.execution_id
                      ? "is-active"
                      : ""
                  }
                  onClick={() =>
                    void loadExecutionTrace(execution.execution_id).catch(
                      (error: unknown) => {
                        setApiError(
                          error instanceof Error
                            ? error.message
                            : "Unable to load this trace.",
                        );
                      },
                    )
                  }
                >
                  <i />
                  {execution.dataset} · {execution.status}
                  <span>{execution.execution_id.slice(0, 8)}</span>
                </button>
              ))}
              {!historyLoading && visibleExecutions.length === 0 && (
                <span>No matching pinned test runs.</span>
              )}
            </div>
          </aside>

          <div className="pm-trace">
            <header>
              <div>
                <strong>Step inspector</strong>
                <span>
                  {activeTrace
                    ? `${activeTrace.execution.dataset} · pinned trace`
                    : "Sample data"}
                </span>
              </div>
              <button disabled title="Replay is disabled in preview-only mode.">
                Replay node · future
              </button>
            </header>
            <div className="pm-trace-grid">
              <div className="pm-step-list">
                {activeTrace ? (
                  activeTrace.steps.map((step) => (
                    <button
                      key={step.step_id}
                      type="button"
                      className={
                        selectedStepId === step.step_id
                          ? "is-active"
                          : ""
                      }
                      onClick={() => setSelectedStepId(step.step_id)}
                    >
                      <i />
                      {step.node_type} · {step.status}
                    </button>
                  ))
                ) : (
                  <>
                    <span className="is-done">
                      <i />
                      Task status changed
                    </span>
                    <span className="is-active">
                      <i />
                      Dependency check
                    </span>
                    <span>
                      <i />
                      Notify task owner
                    </span>
                    <span>
                      <i />
                      Human review
                    </span>
                  </>
                )}
              </div>

              <div className="pm-output-box">
                <div>
                  <span>Selected node I/O</span>
                  <span>
                    {activeTrace ? "JSON · Redacted" : "JSON · Sample"}
                  </span>
                </div>

                {activeTraceStep ? (
                  <>
                    <h3>Input</h3>
                    <pre>
                      {formatStepPreview(activeTraceStep.input_preview)}
                    </pre>
                    <h3>Output</h3>
                    <pre>
                      {formatStepPreview(activeTraceStep.output_preview)}
                    </pre>
                    {activeTraceStep.error_message && (
                      <p className="pm-inspector-warning">
                        {activeTraceStep.error_message}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <pre>
                      {'{ "task_id": "sample-042", "status": "blocked", "branch": "YES" }'}
                    </pre>
                    <p>
                      Run a pinned test to inspect its server-recorded,
                      redacted step trace. No live activity is simulated.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}