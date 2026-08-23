export type TraversalBatchMeasurement = Readonly<{
  capacity: number;
  drawCalls: number;
  uploadBytes: number;
}>;

export const TRAVERSAL_MEASUREMENT_NOTE =
  'Finite Antiky courier course; embedded-image Kenney and Quaternius GLBs rendered by BroMetal';

export function summarizeTraversalMeasurements(batches: readonly TraversalBatchMeasurement[]) {
  return Object.freeze({
    instances: batches.reduce((total, batch) => total + batch.capacity * batch.drawCalls, 0),
    drawCalls: batches.reduce((total, batch) => total + batch.drawCalls, 0),
    uploadBytesPerFrame: batches.reduce((total, batch) => total + batch.uploadBytes, 0),
    note: TRAVERSAL_MEASUREMENT_NOTE,
  });
}
