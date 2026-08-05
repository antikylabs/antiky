# Slice 01 Baseline

Run `s01-20260805T014602Z` freezes the pre-feature Antiky Town renderer at revision `38329dbe549d069897022a79309cdbeb97a07a74`.

- Practical-light slot 0 uses position `[-3.565,4.237,6.82]`, radius `4`, color `[1,0.52,0.22]`, and base power `1.05`.
- One steady frame uses 16 draws and 3 queue submissions.
- The four affected complete uniform blocks use 2,112 bytes per frame.
- All uniform blocks use 4,288 bytes per frame. All measured buffer writes use 1,470,624 through 1,564,368 bytes per frame.
- The ordinary per-frame resource creation pattern is `{"buffers":{"minimum":0,"median":0,"maximum":8},"bindGroups":{"minimum":14,"median":14,"maximum":14}}`. The device-created resource totals are in `baseline.json`.
- The fixed-camera reference is `captures/before.png`. The full host reference is `captures/before-host.png`.
