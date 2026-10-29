import { describe, expect, it } from "vitest";
import { taskEditScope } from "./task-permissions";

describe("taskEditScope", () => {
  it("gives Super Admin and PM full edit on any task", () => {
    expect(taskEditScope("super_admin", "u1", [])).toBe("all");
    expect(taskEditScope("project_manager", "u1", ["u2"])).toBe("all");
  });

  it("lets a developer edit only tasks assigned to them", () => {
    expect(taskEditScope("developer", "u1", ["u1", "u2"])).toBe("all");
    expect(taskEditScope("developer", "u1", ["u2"])).toBe("status_only");
  });

  it("limits testers to status", () => {
    expect(taskEditScope("tester", "u1", ["u1"])).toBe("status_only");
  });
});
