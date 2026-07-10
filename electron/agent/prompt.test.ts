/**
 * Tier 1 — system prompt builder in electron/agent/prompt.ts
 *
 * CRITICAL security rule (AGENTS.md #7): no PII in the LLM prompt. These tests
 * are the executable guarantee of that rule — keep them strict.
 *
 * See tests/TEST_PLAN.md → "Tier 1: prompt.ts".
 */
import { describe, it, expect } from "vitest";
import { GenerateSystemPrompt } from "./prompt";
import type { Resume } from "../../shared/resume-types";
import type { CandidatureConfig } from "../../shared/candidature-types";

const candidature: CandidatureConfig = {
  candidate: {
    name: "Config Candidate",
    position: "Developer",
    location: "Paris",
    experience: "5y",
    languages: ["fr"],
    skills: [{ category: "web", technologies: "React" }],
    strengths: ["autonomy"],
  },
  goals: {
    salary_target: "50k",
    contract_type: "CDI",
    remote_policy: "hybrid",
    criteria: ["remote"],
  },
  target_companies: [],
  applications: [],
};

const fullResume: Resume = {
  basics: {
    name: "Jane Doe",
    label: "Senior Engineer",
    image: "data:image/png;base64,SECRETIMAGE",
    email: "jane@example.com",
    phone: "+33 6 12 34 56 78",
    url: "https://jane.example.com",
    summary: "Experienced engineer with a focus on frontend.",
    location: {
      address: "12 rue Secrète",
      postalCode: "75001",
      city: "Paris",
      countryCode: "FR",
      region: "IDF",
    },
    profiles: [
      { network: "LinkedIn", username: "janedoe", url: "https://ln.com/janedoe" },
    ],
  },
  work: [{ name: "Acme", position: "Engineer" }],
};

describe("GenerateSystemPrompt", () => {
  it("embeds the agent.md instructions", () => {
    const prompt = GenerateSystemPrompt(candidature, fullResume);
    expect(prompt).toContain("Context from agent.md:");
    // agent.md content is non-empty
    expect(prompt.length).toBeGreaterThan(200);
  });

  it("includes the candidature config JSON", () => {
    const prompt = GenerateSystemPrompt(candidature, fullResume);
    expect(prompt).toContain("Config Candidate");
    expect(prompt).toContain("salary_target");
  });

  it("includes resume basics.summary and basics.label", () => {
    const prompt = GenerateSystemPrompt(candidature, fullResume);
    expect(prompt).toContain("Experienced engineer with a focus on frontend.");
    expect(prompt).toContain("Senior Engineer");
  });

  it("STRIPS basics.name from the prompt", () => {
    const prompt = GenerateSystemPrompt(candidature, fullResume);
    expect(prompt).not.toContain("Jane Doe");
  });

  it("STRIPS basics.email / phone from the prompt", () => {
    const prompt = GenerateSystemPrompt(candidature, fullResume);
    expect(prompt).not.toContain("jane@example.com");
    expect(prompt).not.toContain("+33 6 12 34 56 78");
  });

  it("STRIPS basics.image / photo from the prompt", () => {
    const prompt = GenerateSystemPrompt(candidature, fullResume);
    expect(prompt).not.toContain("SECRETIMAGE");
  });

  it("STRIPS basics.location (address) from the prompt", () => {
    const prompt = GenerateSystemPrompt(candidature, fullResume);
    expect(prompt).not.toContain("12 rue Secrète");
  });

  it("STRIPS basics.profiles from the prompt", () => {
    const prompt = GenerateSystemPrompt(candidature, fullResume);
    expect(prompt).not.toContain("janedoe");
    expect(prompt).not.toContain("https://ln.com/janedoe");
  });

  it("handles an empty/undefined resume without throwing", () => {
    expect(() =>
      GenerateSystemPrompt(candidature, {} as Resume),
    ).not.toThrow();
  });
});
