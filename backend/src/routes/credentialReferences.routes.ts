
import { Router } from "express";
import { requireUserOrAgent } from "../middleware/agentAuthMiddleware.ts";
import {
  createCredentialReference,
  getCredentialMetadataByConnector,
  listCredentialMetadata,
  revokeCredentialReference,
  rotateCredentialReference,
} from "../services/credentialReference.service.ts";
import {
  getRequestId,
  resolveActor,
  sendSafeError,
} from "../services/actor.service.ts";

const router = Router();

function objectBody(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

router.use(requireUserOrAgent);

// Lists safe metadata only. Credential-reference IDs and secret-store pointers
// are never included in these response objects.
router.get("/", (req, res) => {
  try {
    const projectId =
      typeof req.query.project_id === "string" ? req.query.project_id : "";

    if (!projectId) {
      return res.status(400).json({
        error: "project_id is required",
        request_id: getRequestId(req),
      });
    }

    return res.json({
      credential_references: listCredentialMetadata(
        projectId,
        resolveActor(req),
      ),
    });
  } catch (error) {
    return sendSafeError(req, res, error, "Credential metadata could not be listed");
  }
});

router.post("/", (req, res) => {
  try {
    const body = objectBody(req.body);
    const scopes = Array.isArray(body.scopes)
      ? body.scopes.filter((scope): scope is string => typeof scope === "string")
      : [];

    const metadata = createCredentialReference(
      {
        project_id: typeof body.project_id === "string" ? body.project_id : "",
        connector_id: typeof body.connector_id === "string" ? body.connector_id : "",
        environment_id:
          typeof body.environment_id === "string" ? body.environment_id : "",
        reference: typeof body.reference === "string" ? body.reference : "",
        scopes,
        expires_at:
          typeof body.expires_at === "string" ? body.expires_at : null,
      },
      resolveActor(req),
    );

    return res.status(201).json({ credential_reference: metadata });
  } catch (error) {
    return sendSafeError(req, res, error, "Credential reference could not be created");
  }
});

router.get("/connector/:connectorId", (req, res) => {
  try {
    const metadata = getCredentialMetadataByConnector(
      String(req.params.connectorId),
      resolveActor(req),
    );
    return res.json({ credential_reference: metadata });
  } catch (error) {
    return sendSafeError(req, res, error, "Credential metadata could not be read");
  }
});

// Rotation is addressed by connector ID so the write-only API does not return
// or require the stored credential_reference_id.
router.put("/connector/:connectorId", (req, res) => {
  try {
    const body = objectBody(req.body);
    const scopes = Array.isArray(body.scopes)
      ? body.scopes.filter((scope): scope is string => typeof scope === "string")
      : undefined;

    const metadata = rotateCredentialReference(
      String(req.params.connectorId),
      typeof body.reference === "string" ? body.reference : "",
      scopes,
      resolveActor(req),
    );

    return res.json({ credential_reference: metadata });
  } catch (error) {
    return sendSafeError(req, res, error, "Credential reference could not be rotated");
  }
});

router.post("/connector/:connectorId/revoke", (req, res) => {
  try {
    const metadata = revokeCredentialReference(
      String(req.params.connectorId),
      resolveActor(req),
    );
    return res.json({ credential_reference: metadata });
  } catch (error) {
    return sendSafeError(req, res, error, "Credential reference could not be revoked");
  }
});

// There are intentionally no routes that read or return the stored reference.

export default router;
