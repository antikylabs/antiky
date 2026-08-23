export const SKILLS_SOURCE_COMMIT = 'c5970383cde4e90588ba7d039f7a665ebe3443fd';
export const SKILLS_SOURCE_URL = 'https://github.com/antikylabs/skills';
export const SKILLS_SNAPSHOT_URL = `${SKILLS_SOURCE_URL}/tree/${SKILLS_SOURCE_COMMIT}`;

export type PublicSkill = Readonly<{
  name: string;
  purpose: string;
  commands: readonly string[];
  invocation?: string;
}>;

export const PUBLIC_SKILLS: readonly PublicSkill[] = [
  {
    name: 'anti-slop',
    purpose: 'Find false evidence in code, tests, scripts, and prose with deterministic checks.',
    commands: ['install', 'code', 'prose', 'structure'],
  },
  {
    name: 'brometal-patching',
    purpose: 'Patch a blocked BroMetal dependency, send the fix upstream, and retire accepted patches.',
    commands: ['update', 'patch', 'pr'],
  },
  {
    name: 'engineering',
    purpose: 'Use a read-only principal-engineer sidekick to challenge a plan or technical judgment.',
    commands: ['gut-check', 'talk-it-out', 'plan-it', 'grill-it'],
  },
  {
    name: 'show-me',
    purpose: 'Explain a technical topic with the smallest useful diagram or focused visual artifact.',
    commands: [],
  },
  {
    name: 'simplified-technical-english',
    purpose: 'Write, audit, or correct documentation against ASD-STE100 Issue 9.',
    commands: ['write', 'audit', 'fix'],
  },
  {
    name: 'wait-what',
    purpose: 'Re-pitch an explanation that did not land.',
    commands: ['init'],
    invocation: 'Human-invoked only',
  },
  {
    name: 'write-adrs',
    purpose: 'Write or suggest a five-part Architecture Decision Record.',
    commands: ['write', 'suggest'],
  },
  {
    name: 'write-docs',
    purpose: 'Classify, write, audit, or split user-facing documentation with Diátaxis.',
    commands: ['classify', 'write', 'audit', 'split'],
  },
  {
    name: 'write-objectives',
    purpose: 'Run the research, planning, goal execution, review, and archive lifecycle.',
    commands: ['init', 'create-research', 'create-plan', 'create-goals', 'execute', 'audit', 'complete-goal', 'complete-objective'],
  },
];
