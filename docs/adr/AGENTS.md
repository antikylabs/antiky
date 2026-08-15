# Architecture Decision Record instructions

## Scope and ownership

These instructions apply to `docs/adr/` and all its child folders.

Read these files before you create or change an Architecture Decision Record (ADR):

- [`README.md`](README.md)
- [`../GOOD_ENGINEERING_H.md`](../GOOD_ENGINEERING_H.md)
- [`team-simplified-technical-english`](../../.agents/skills/team-simplified-technical-english/SKILL.md)

ADRs are human-owned records. An agent can create or change an `_H` ADR only when a human gives an
explicit instruction. Preserve the decision and the intent of the human owner.

## Required language standard

Every new or changed ADR must use ASD-STE100 Simplified Technical English, Issue 9. Use the
`team-simplified-technical-english` skill and its bundled rule guide, controlled dictionary, and
linter. Read the reference files that the selected skill mode requires.

Do not describe text as compliant only because it has short sentences, active voice, or a clean
linter result.

Issue 9 has 53 writing rules and a controlled dictionary. Apply all the rules that are relevant to
descriptive text. Validate each general word against the dictionary. Use each approved word only
with its approved meaning, part of speech, and form.

An unapproved word is permitted only when Issue 9 permits it as:

- A technical noun
- Part of a technical noun
- A technical verb.

Before you write, make a list of the necessary technical nouns and technical verbs. For each term,
identify an authoritative Antiky, industry, or subject-field source. Define an uncommon term when it
first occurs. Use one term for one meaning throughout the ADR.

Report the machine checks and the judgment checks separately. State which rules the audit could not
decide.

## ADR writing workflow

1. Confirm that the human owner made one architecture decision.
2. Select the next unused number in the applicable ADR area.
3. Use the five-part format in [`README.md`](README.md).
4. Identify and validate the technical terminology.
5. Write the Context, Decision, and Consequences sections.
6. Audit each sentence against all applicable Issue 9 rules.
7. Audit each general word against the Issue 9 dictionary.
8. Validate links, record numbering, status, and the ADR index entry.
9. Give the human owner the audit result and any term that needs owner approval.

Use this checklist during the language audit. This checklist does not replace Issue 9:

- Use active voice.
- Keep one topic in each sentence.
- Use no more than 25 words in a descriptive sentence.
- Use multi-word nouns that contain no more than three words, unless Issue 9 permits an official
  longer term.
- Use only the permitted verb forms and tenses.
- Do not use an `-ing` word unless Issue 9 approves it or permits it in a technical noun.
- Put a condition before its result when the reader must know the condition first.
- Make each vertical-list item connect correctly to its introductory text.
- Do not use a semicolon.
- Do not use a synonym only to add variety.
- Do not use an approved word with an unapproved meaning.
- Do not use a technical noun as a verb.

A sentence-length script, spelling tool, grammar tool, STE checker, or language model is only an
aid. None of these tools proves compliance. The writer remains responsible for the complete Issue 9
audit.

## Changes to accepted ADRs

Do not change an accepted decision in place. Create a new ADR and set the old ADR status to
`Superseded` when the architecture decision changes.

For an owner-approved clarification, preserve the committed text before you edit it. Run
`docs/adr/tag-hash.sh` while `HEAD` still contains the prior text. The script appends the
revision-history entry. Then make the clarification.

Do not rewrite an existing `_H` ADR only because it does not conform to Issue 9. Get an explicit
instruction from the human owner first.

## Verification

Before you commit ADR work:

- Confirm that the ADR has Title, Status, Context, Decision, and Consequences sections.
- Confirm that the status value is permitted by [`README.md`](README.md).
- Confirm that the record appears in the ADR index.
- Confirm that all local links resolve.
- Run `git diff --check`.
- Report the Issue 9 audit separately from format and link checks.

Never report that an ADR is ASD-STE100 compliant when you completed only format, link, sentence
length, or automated checks.
