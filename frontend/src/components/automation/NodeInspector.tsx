import type { CanvasItem } from "../../types/canvas";
import { useState } from "react";

type InspectorTab = "settings" | "input" | "output" | "validation" | "permissions";

interface NodeInfo {
  name: string;
  purpose: string;
  kind: string;
}

const nodeInfoMap: Record<string, NodeInfo> = {
  trigger: {
    name: "Task status changed",
    purpose: "Begins when a confirmed task event is received.",
    kind: "Trigger · Project Manager",
  },
  condition: {
    name: "Dependency check",
    purpose: "Routes a task only when its blocking status is confirmed.",
    kind: "Decision · Branch",
  },
  notify: {
    name: "Notify task owner",
    purpose: "Would send a scoped message to the task owner.",
    kind: "Action · Connector",
  },
  review: {
    name: "Request human review",
    purpose: "Pauses any consequential action until a reviewer decides.",
    kind: "Human gate · Approval",
  },
  error_handler: {
    name: "Error handler",
    purpose: "Recovers from failures during workflow execution.",
    kind: "Safety",
  },
};

export function NodeInspector({
  item,
  selectedTab = "settings",
}: {
  item: CanvasItem | null;
  selectedTab?: InspectorTab;
}) {
  const [tab, setTab] = useState<InspectorTab>(selectedTab || "settings");

  const nodeInfo = item ? nodeInfoMap[item.item_type] : undefined;

  return (
    <aside className="pm-node-inspector">
      <header>
        <div>
          <small>Node inspector</small>
          <h2>{nodeInfo?.name || item?.content || "Unknown"}</h2>
        </div>
      </header>
      <nav>
        <button className={tab === "settings" ? "is-active" : ""} onClick={() => setTab("settings")}>
          Settings
        </button>
        <button className={tab === "input" ? "is-active" : ""} onClick={() => setTab("input")}>
          Input
        </button>
        <button className={tab === "output" ? "is-active" : ""} onClick={() => setTab("output")}>
          Output
        </button>
        <button className={tab === "validation" ? "is-active" : ""} onClick={() => setTab("validation")}>
          Validation
        </button>
        <button className={tab === "permissions" ? "is-active" : ""} onClick={() => setTab("permissions")}>
          Permissions
        </button>
      </nav>
      <div className="pm-inspector-content">
        {tab === "settings" && (
          <>
            <label>Node name</label>
            <input readOnly value={nodeInfo?.name || item?.content || ""} />
            <label>Purpose</label>
            <textarea readOnly rows={3} value={nodeInfo?.purpose || item?.content || ""} />
            <div className="pm-inspector-divider" />
            <h3>Node kind</h3>
            <pre>{nodeInfo?.kind || item?.item_type || ""}</pre>
            <p className="pm-inspector-warning">
              Sample data only. A live builder needs a versioned execution
              API, redacted logs, connector permission scopes, safe replay
              rules, and owner-approved publishing.
            </p>
          </>
        )}
        {tab === "input" && (
          <>
            <h3>Sample input preview</h3>
            <pre>{nodeInfo?.name === "Dependency check" ? "task_id: sample-042\nstatus: blocked\nblocked_by: sample-028" : "event: task.updated\nstatus: blocked"}</pre>
            <div className="pm-inspector-divider" />
            <h3>Input schema</h3>
            <pre>{`{
  "task_id": "string",
  "status": "blocked | in_progress | done",
  "blocked_by": "string (optional)"
}`}</pre>
            <p className="pm-inspector-warning">
              Input values are illustrative. Live execution requires a
              connected task event source.
            </p>
          </>
        )}
        {tab === "output" && (
          <>
            <h3>Sample output preview</h3>
            <pre>{nodeInfo?.name === "Dependency check" ? "branch: YES\nitems: 1" : "items: 1"}</pre>
            <div className="pm-inspector-divider" />
            <h3>Output schema</h3>
            <pre>{`{
  "branch": "YES | NO",
  "items": "number",
  "delivery": "queued | sent | failed"
}`}</pre>
            <p className="pm-inspector-warning">
              Output values are illustrative. Live execution requires a
              connected runtime.
            </p>
          </>
        )}
        {tab === "validation" && (
          <>
            <h3>Validation issues</h3>
            <p>No issues</p>
          </>
        )}
        {tab === "permissions" && (
          <>
            <h3>Connector scope</h3>
            <p>No connector assigned</p>
          </>
        )}
      </div>
    </aside>
  );
}
