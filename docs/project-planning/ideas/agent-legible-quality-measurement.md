# Agent-legible quality measurement

**Recorded:** 2026-08-11
**Status:** the capability exists. The *skills* that would teach it remain deferred; the
[demo-refining archive](../objectives/_archives/2026-08-17-demo-refining-summary.md) records the completed
measurement boundary.
**Origin:** owner observation after goal 13 - "no other game engine is providing this, and this is
prime skill material."

## The claim, stated carefully

An engine that can tell an agent **whether the frame it just rendered is any good** - in numbers
the agent can act on, without the agent seeing the frame - is unusual. That is what
`demos:shoot` → `frame-stats` → a failing budget, and `motion-stats` → a failing camera assertion,
now do here.

It is worth being precise about which part is new, because overclaiming would make the idea easy
to dismiss.

**Not new.** Automated screenshot capture. Golden-image and perceptual-diff comparison. Performance
and frame-time capture. Unity and Unreal both ship versions of these, and perceptual diffing is
decades old.

**Also not new.** The individual measurements. CIE L\*, Rec.709 luminance, autocorrelation and
ITU-T P.910 Temporal Information are all standard. Nothing here invented a metric.

**What is unusual is the combination and its consumer:**

1. **Measurement designed for a reader that cannot see.** Golden-image diffing answers "did this
   change?" against a previous frame. It cannot answer "is this good?" with no reference. A local
   contrast number can, and an agent can act on it without a baseline and without eyes.
2. **Motion judged without video.** No production model takes video, and two 2025–26 benchmarks put
   models near chance on temporal glitch detection. Computing the camera path from the simulation
   sidesteps the modality problem entirely - the shake defect reproduces in under a second with no
   browser, no GPU and no capture.
3. **A second suite that is supposed to be red.** `npm test` is the regression gate; `demos:verify`
   is the target tracker. Budgets that pass on the day they are written measure nothing. That
   inversion - a deliberately failing suite as a contract - is not something engines ship.
4. **Failures that say what to do.** `camera position moves 0.0988 but the look-at target moves
   0.0000` names the defect and the fix. A pixel-diff percentage does not.

The honest summary: **the parts are standard, the assembly is aimed at a consumer no engine has
had before**, and that consumer is now the majority of the people writing game code here.

## Why this is skill material rather than documentation

An agent that knows `demos:shoot` exists will still not know:

- that a budget failure is a *target*, not a regression, and must not be "fixed" by lowering it;
- that local contrast, not luminance spread, is the measure of form - and *why*, since the obvious
  metric is the wrong one and was shipped first;
- that motion comes from the simulation and pixels only prove the renderer did not lie;
- that a probe partly off-frame is an error rather than a shifted window;
- that a passing measurement can still be measuring nothing, and how to tell.

Every one of those is non-obvious, project-specific, and was learned by getting it wrong. That is
the bar `../scratch/skill-research/recommended-library.md` sets for what earns a skill: non-obvious
knowledge an agent cannot infer, tied to a recurring job.

## Why not yet

**The measurement has already been wrong once.** `luminanceSpread` was the headline metric for a
day before a critic showed it tracked peak brightness (r = 0.99 against p95). A skill teaching a
wrong measurement is worse than no skill - it would spread the error faster and make it harder to
retract.

The thresholds are also unvalidated by the owner, and no budget has yet survived a real render
slice. Goals 06–08 are the test. If the budgets need another rewrite, the skill would have needed
one too.

## The cheapest next step, when the time comes

Do not write a skill that documents the API. Write one that carries the **judgement**: how to read
a failing budget, when a number means "not done" versus "wrong metric", and the three specific
traps above. Then run it against a fresh-context agent on a real render task and compare with a
no-skill baseline, which is the evaluation method `execute-goal-01.md` in the skill-research folder
already describes.

## Related

- [Demo-refining archive](../objectives/_archives/2026-08-17-demo-refining-summary.md) - the harness, motion,
  and corrected visual-measurement conclusions
- `executable-requirement-contracts.md` - where this goes if it generalises
