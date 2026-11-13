import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "../hooks/useAuth";
import { Icon } from "../components/layout/Icon";

interface ConnectorDef {
  id: string;
  name: string;
  provider: string;
  type: string;
  description: string;
  icon: string;
  configFields: { key: string; label: string; type: string; required: boolean; placeholder?: string }[];
  actions: { id: string; label: string; description: string }[];
}

interface ConnectorInstance {
  connector_id: string;
  name: string;
  type: string;
  provider: string;
  status: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export default function ConnectorsPage() {
  const queryClient = useQueryClient();
  const [selectedDef, setSelectedDef] = useState<ConnectorDef | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: availableData } = useQuery({
    queryKey: ["connectors-available"],
    queryFn: async () => {
      const res = await fetch("/api/connectors/available", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to load available connectors");
      return res.json();
    },
  });

  const { data: instancesData, isLoading } = useQuery({
    queryKey: ["connectors"],
    queryFn: async () => {
      const res = await fetch("/api/connectors", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to load connectors");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { provider: string; name: string; config: Record<string, string> }) => {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed to create"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connectors"] });
      setShowCreate(false);
      setSelectedDef(null);
      setConfigValues({});
      setMessage("Connector created successfully");
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: Error) => setError(err.message),
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/connectors/${id}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Test failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
      queryClient.invalidateQueries({ queryKey: ["connectors"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/connectors/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Delete failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connectors"] });
      setMessage("Connector deleted");
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: Error) => setError(err.message),
  });

  const available: ConnectorDef[] = availableData?.connectors || [];
  const instances: ConnectorInstance[] = instancesData?.connectors || [];

  const handleCreate = () => {
    if (!selectedDef) return;
    createMutation.mutate({
      provider: selectedDef.provider,
      name: selectedDef.name,
      config: configValues,
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "connected":
        return { background: "rgba(34,197,94,0.15)", color: "#22c55e" };
      case "error":
        return { background: "rgba(239,68,68,0.15)", color: "#ef4444" };
      case "pending":
        return { background: "rgba(234,179,8,0.15)", color: "#eab308" };
      default:
        return { background: "var(--pm-accent-soft)", color: "var(--pm-text-muted)" };
    }
  };

  return (
    <section className="pm-view">
      <div className="pm-view-heading">
        <div>
          <span className="pm-eyebrow">WORK · INTEGRATIONS</span>
          <h1>Connectors.</h1>
          <p>Manage external service integrations and connectors.</p>
        </div>

        <button
          type="button"
          className="pm-button pm-button-primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Icon name="plus" size={15} />
          {showCreate ? "Cancel" : "Add Connector"}
        </button>
      </div>

      <section className="pm-glass-panel pm-task-surface">
        {message && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: "12px",
              borderRadius: "var(--pm-radius-sm)",
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.3)",
              color: "#22c55e",
              fontSize: "12px",
            }}
          >
            {message}
          </div>
        )}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: "12px",
              borderRadius: "var(--pm-radius-sm)",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
            >
              x
            </button>
          </div>
        )}

        {/* Create Connector Form */}
        {showCreate && (
          <div
            className="pm-glass-panel"
            style={{ padding: "16px", marginBottom: "16px" }}
          >
            <h2
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--pm-text)",
                marginBottom: "12px",
              }}
            >
              Add New Connector
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              {available.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => {
                    setSelectedDef(def);
                    setConfigValues({});
                  }}
                  className="pm-task-row"
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    border:
                      selectedDef?.id === def.id
                        ? "1px solid var(--pm-accent)"
                        : "1px solid var(--pm-border)",
                    background:
                      selectedDef?.id === def.id
                        ? "var(--pm-accent-soft)"
                        : "var(--pm-glass-strong)",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: "var(--pm-text)",
                      fontSize: "12px",
                    }}
                  >
                    {def.name}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--pm-text-muted)",
                      marginTop: "4px",
                    }}
                  >
                    {def.description}
                  </div>
                </button>
              ))}
            </div>

            {selectedDef && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
                <h3
                  style={{
                    fontWeight: 600,
                    color: "var(--pm-text)",
                    fontSize: "12px",
                  }}
                >
                  Configure {selectedDef.name}
                </h3>
                {selectedDef.configFields.map((field) => (
                  <label key={field.key} className="pm-field">
                    <span>
                      {field.label}{" "}
                      {field.required && (
                        <span style={{ color: "#ef4444" }}>*</span>
                      )}
                    </span>
                    <input
                      type={field.type === "password" ? "password" : "text"}
                      value={configValues[field.key] || ""}
                      onChange={(e) =>
                        setConfigValues({ ...configValues, [field.key]: e.target.value })
                      }
                      placeholder={field.placeholder}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        border: "1px solid var(--pm-border)",
                        borderRadius: "var(--pm-radius-sm)",
                        background: "var(--pm-glass-strong)",
                        color: "var(--pm-text)",
                        fontSize: "12px",
                        fontFamily: "inherit",
                      }}
                    />
                  </label>
                ))}
                <button
                  type="button"
                  className="pm-button pm-button-primary"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Connector"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Connector Instances */}
        <div>
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid var(--pm-border)",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--pm-text-secondary)",
            }}
          >
            Your Connectors
          </div>
          {isLoading ? (
            <div className="pm-skeleton-list">
              <i />
              <i />
              <i />
            </div>
          ) : instances.length === 0 ? (
            <div className="pm-empty-state">
              <strong>No connectors configured</strong>
              <p>Click "Add Connector" to get started.</p>
            </div>
          ) : (
            <div>
              {instances.map((inst) => (
                <div
                  key={inst.connector_id}
                  className="pm-task-row"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <h3
                          style={{
                            fontWeight: 600,
                            color: "var(--pm-text)",
                            fontSize: "12px",
                            margin: 0,
                          }}
                        >
                          {inst.name}
                        </h3>
                        <span
                          style={{
                            ...statusColor(inst.status),
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            fontSize: "9px",
                            fontWeight: 500,
                          }}
                        >
                          {inst.status}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: "10px",
                          color: "var(--pm-text-muted)",
                          margin: "4px 0 0",
                        }}
                      >
                        {inst.provider} connector
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        className="pm-button pm-button-quiet"
                        onClick={() => testMutation.mutate(inst.connector_id)}
                        disabled={testMutation.isPending}
                      >
                        {testMutation.isPending ? "Testing..." : "Test"}
                      </button>
                      <button
                        type="button"
                        className="pm-button"
                        style={{
                          background: "rgba(239,68,68,0.15)",
                          color: "#ef4444",
                        }}
                        onClick={() => {
                          if (confirm("Delete this connector?"))
                            deleteMutation.mutate(inst.connector_id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {testResult && testMutation.variables === inst.connector_id && (
                    <div
                      style={{
                        padding: "8px 10px",
                        borderRadius: "var(--pm-radius-sm)",
                        fontSize: "11px",
                        background: testResult.ok
                          ? "rgba(34,197,94,0.1)"
                          : "rgba(239,68,68,0.1)",
                        color: testResult.ok ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {testResult.message}
                    </div>
                  )}
                  {inst.provider === "github" && inst.status === "connected" && (
                    <div
                      style={{
                        marginTop: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 500,
                          color: "var(--pm-text-secondary)",
                        }}
                      >
                        GitHub Actions
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <a
                          href={`/api/connectors/${inst.connector_id}/github/repos`}
                          target="_blank"
                          style={{
                            fontSize: "11px",
                            color: "var(--pm-accent)",
                            textDecoration: "none",
                          }}
                        >
                          List Repos
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
