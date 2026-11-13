import { useNavigate } from "react-router-dom";
import WorkspaceOverview from "./WorkspaceOverview";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <WorkspaceOverview
      onOpenWork={() => navigate("/projects")}
      onNewTask={() => navigate("/projects?create=task")}
    />
  );
}
