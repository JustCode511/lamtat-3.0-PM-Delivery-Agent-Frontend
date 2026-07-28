/* The four agent modules. One source of truth used by the home cards
   and the module view. `id` is used in routes and API paths (/{id}/chat). */

export const MODULES = {
  pm: {
    id: "pm",
    name: "PM Delivery Agent",
    tagline: "Track projects, flag risks, resolve them with AI",
    accent: "var(--pm)",
    code: "PM",
    hasProjects: true,
    description:
      "Reads live Jira data across your projects. See health at a glance, surface critical risks, and get AI-recommended resolutions with root cause and effort.",
  },
  talent: {
    id: "talent",
    name: "Talent Management",
    tagline: "Match people to work, balance capacity",
    accent: "var(--talent)",
    code: "TM",
    hasProjects: false,
    description:
      "Map skills, plan capacity, and surface the right people for the right work across project accounts.",
  },
  code: {
    id: "code",
    name: "Code Generation",
    tagline: "Generate, document, and auto-review code",
    accent: "var(--code)",
    code: "CG",
    hasProjects: false,
    description:
      "Generate code and docs, then run a first-pass automated review before routing to a human reviewer for merge.",
  },
  finops: {
    id: "finops",
    name: "Cloud FinOps",
    tagline: "Cost visibility, anomalies, rightsizing",
    accent: "var(--finops)",
    code: "FO",
    hasProjects: false,
    description:
      "Real-time AWS cost visibility, anomaly detection, and rightsizing recommendations your teams can act on.",
  },
};

export const MODULE_LIST = Object.values(MODULES);
