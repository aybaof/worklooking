export interface CandidatureConfig {
  candidate: {
    name: string;
    position: string;
    location: string;
    experience: string;
    languages: string[];
    skills: Array<{
      category: string;
      technologies: string;
    }>;
    strengths: string[];
  };
  goals: {
    salary_target: string;
    contract_type: string;
    remote_policy: string;
    criteria: string[];
  };
  target_companies: Array<{
    name: string;
    sector: string;
    reason: string;
    stack: string;
  }>;
  applications: Array<{
    company: string;
    position: string;
    date: string;
    status: string;
    follow_up: string;
    notes_path: string;
    // Path to the generated CV (HTML/PDF) written by a full-success
    // `validate()`, populated by `App.tsx`'s match-or-create wiring
    // (`shared/candidatureMatch.ts`) — independent of `notes_path`. Declared
    // non-optional per the spec, but `useCandidatureConfig.loadConfig` does an
    // unchecked `JSON.parse(...) as CandidatureConfig` cast, so pre-existing
    // persisted rows may have this key absent at runtime — all readers MUST
    // treat it defensively (falsy/absent check).
    resume_path: string;
  }>;
}
