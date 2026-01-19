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
  }>;
}
