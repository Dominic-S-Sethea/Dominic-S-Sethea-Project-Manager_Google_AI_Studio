import { randomUUID } from "crypto";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Test data constants
export const testUser = {
  username: "testuser",
  email: "test@example.com",
  password: "password123",
};

export const testProject = {
  name: "Test Project",
  description: "A test project for acceptance testing",
};

export const testTask = {
  project_id: "test-project-1",
  title: "Test Task",
  description: "A test task",
};

// Helper to generate unique IDs
export const genId = (prefix: string) => `${prefix}-${randomUUID()}`;

// Global test counter
export let testCount = 0;
export const getTestId = (name: string) => `test-${++testCount}-${name}`;
