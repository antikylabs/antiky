# Studio objective guidance

Use the complete [Antiky Town slice workflow](../antiky-town/SLICE_WORKFLOW_A.md) and its
[plan template](../antiky-town/SLICE_PLAN_TEMPLATE_A.md) for every Studio slice.

Before planning or implementation, read the relevant Studio architecture and ADRs,
[`GOOD_ENGINEERING_H.md`](../../GOOD_ENGINEERING_H.md), the current website
[design system](../../../packages/website/DESIGN.md), and the applicable general research under
[`../general-stuff`](../general-stuff/).

Keep Studio web code in `packages/studio/app` and native Tauri code in `packages/studio/tauri`.
Keep user documentation general. Keep temporary verification and raw run output in ignored active
slice folders. Remove both after completion. Keep durable closeout facts in `slice-summary.md`.
Never add slice-only verification commands to a package manifest.

Write plans and maintained documentation in ASD-STE100 Issue 9 style.
