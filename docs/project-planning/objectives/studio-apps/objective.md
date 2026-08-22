# Objective: Studio apps

**Started:** 2026-08-14
**Status:** Being defined

> This file is yours. It holds raw intent - what you want and why. Nothing else in the objective
> starts until it has content. It is deliberately unstructured: prose, bullets, half-formed
> worries, all fine. The prompts below are prompts, not a form.
>
> Delete this block when you start writing.

## What we want

<!-- What should be true when this is done? Write it however it comes out. -->

Studio should allow plugin-based extensions that allows the addition of new "apps" to the studio.

## Why now

<!-- What makes this worth doing at this moment? A deadline, a blocker, an opportunity,
     an accumulating cost? -->

We have a few first apps that we want to extend the studio with, and we want to make it easy to add new ones in the future including these ones.

## What good looks like

<!-- How would you recognise success? A demo you would show someone, a number that moves,
     a class of bug that stops happening? Vague is fine - "it should feel less janky" is
     a real answer and research can sharpen it. -->

Well defined system for panels, webgpu viewport, terminal, etc. That are composable and mountable.

mini apps should be able to load and configure the workspace of the studio in order to reflect the needs it has.


## What worries me

<!-- The parts you expect to go wrong, the decisions you are unsure about, the thing you
     suspect is harder than it looks. This is the most useful section for research -
     it points at what to investigate. -->

- making it too complex out the gate.
- your implementation drifting from our design and functionality (The project page already does not reflect the design of the main page or settings page).
- Apps looking like standard slop (use impeccable skill to help keep that from happening)
- not offering enough customizability that an app we want to build can't be built.
- that we accidently setup in a way that makes it harder to extend or add more mini app/plugin hooks etc.

## Constraints

<!-- What must not change? What is fixed - deadlines, platforms, existing decisions,
     other work in flight, people's availability? -->

Current experience of main workspace (game editor) view.

## Explicitly not this

<!-- Adjacent work you do NOT want swept in. Saying so here prevents scope creep in
     the plan, which is much harder to reverse later. -->

## Open questions for research

<!-- Anything you want answered before planning. Leave empty if you would rather
     research work that out. -->

- best way to have extension system?
- best way to have reusable webgpu canvas viewport?
