export type NodeDef = {
  id: string;
  name: string;
  purpose: string;
  kind: string;
  icon: string;
  configSchema?: Record<string, unknown>;
};

export const nodeLibrary: NodeDef[] = [
  {
    id: "trigger",
    name: "Task event",
    purpose: "Begins when a confirmed task event is received.",
    kind: "Trigger · Project Manager",
    icon: "automation",
    configSchema: {
      event_type: ["task.updated", "task.created"],
      subscription_id: "",
    },
  },
  {
    id: "condition",
    name: "Dependency check",
    purpose: "Routes a task only when its blocking status is confirmed.",
    kind: "Decision · Branch",
    icon: "warning",
    configSchema: {
      branches: [{ label: "YES", condition: "status = blocked" }],
      default_target_node_id: "",
    },
  },
  {
    id: "notify",
    name: "Notify task owner",
    purpose: "Would send a scoped message to the task owner.",
    kind: "Action · Connector",
    icon: "success",
    configSchema: {
      target: "assignee",
      message: "",
    },
  },
  {
    id: "review",
    name: "Request human review",
    purpose: "Pauses any consequential action until a reviewer decides.",
    kind: "Human gate · Approval",
    icon: "check_circle",
    configSchema: {
      reviewer: "project owner",
      change: "status update",
    },
  },
  {
    id: "error_handler",
    name: "Error handler",
    purpose: "Recovers from failures during workflow execution.",
    kind: "Safety",
    icon: "error",
    configSchema: {
      recovery: ["retry", "notify", "create_review", "end"],
      max_retries: 3,
    },
  },
];
