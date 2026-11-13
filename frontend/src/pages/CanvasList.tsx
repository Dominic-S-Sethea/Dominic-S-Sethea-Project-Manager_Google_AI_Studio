import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "../hooks/useAuth";
import type { Canvas } from "../types/canvas";
import { Icon } from "../components/layout/Icon";

export default function CanvasListPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const projectId = params.projectId || searchParams.get("project_id") || null;

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["canvases", projectId],
    queryFn: async () => {
      const url = projectId
        ? `/api/canvas?project_id=${encodeURIComponent(projectId)}`
        : "/api/canvas";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch canvases");
      const json = await res.json();
      return (json.canvases || []) as Canvas[];
    },
  });

  const createCanvas = useMutation({
    mutationFn: async (canvasName: string) => {
      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          name: canvasName || "Untitled Canvas",
          description: null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create canvas");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["canvases", projectId] });
      setCreating(false);
      setName("");
      navigate(`/canvas/${data.canvas.canvas_id}`);
    },
  });

  const deleteCanvas = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/canvas/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to delete canvas");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvases", projectId] });
    },
  });

  return (
    <section className="pm-view">
      <div className="pm-view-heading">
        <div>
          <span className="pm-eyebrow">WORK · PROJECT CANVAS</span>
          <h1>Visual project mapping.</h1>
          <p>
            Create and manage canvas diagrams for your projects. Map tasks,
            connections, and workflows visually.
          </p>
        </div>

        <button
          type="button"
          className="pm-button pm-button-primary"
          onClick={() => setCreating(true)}
        >
          <Icon name="plus" size={15} />
          New canvas
        </button>
      </div>

      <section className="pm-glass-panel pm-task-surface">
        {creating && (
          <div
            className="pm-inline-form"
            style={{ marginBottom: "16px", padding: "12px" }}
          >
            <input
              className="pm-field"
              style={{ flex: 1 }}
              placeholder="Canvas name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="pm-button pm-button-primary"
              onClick={() => createCanvas.mutate(name)}
              disabled={createCanvas.isPending}
            >
              {createCanvas.isPending ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              className="pm-button pm-button-quiet"
              onClick={() => {
                setCreating(false);
                setName("");
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="pm-skeleton-list">
            <i />
            <i />
            <i />
            <i />
          </div>
        ) : error ? (
          <div className="pm-state-card pm-error-state">
            <Icon name="shield" size={18} />
            <div>
              <strong>Canvases could not be loaded.</strong>
              <span>Check the connection and try again.</span>
            </div>
            <button
              type="button"
              className="pm-button pm-button-small"
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["canvases", projectId],
                })
              }
            >
              Retry
            </button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="pm-empty-state">
            <strong>No canvases yet</strong>
            <p>Create one to get started mapping your project.</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "12px",
              padding: "4px",
            }}
          >
            {data.map((c) => (
              <article
                key={c.canvas_id}
                className="pm-task-row pm-glass-panel"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  cursor: "pointer",
                }}
                onClick={() => navigate(`/canvas/${c.canvas_id}`)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
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
                    {c.name}
                  </h3>
                  <button
                    type="button"
                    className="pm-table-action is-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete canvas?"))
                        deleteCanvas.mutate(c.canvas_id);
                    }}
                  >
                    Delete
                  </button>
                </div>
                <p
                  style={{
                    fontSize: "10px",
                    color: "var(--pm-text-muted)",
                    margin: 0,
                  }}
                >
                  {c.description || "No description"}
                </p>
                <p
                  style={{
                    fontSize: "9px",
                    color: "var(--pm-text-muted)",
                    margin: 0,
                  }}
                >
                  {new Date(c.updated_at).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
