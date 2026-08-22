type DismissibleDetails = EventTarget & { open: boolean };

export function bindDetailsDismissal(details: DismissibleDetails, eventTarget: EventTarget) {
  const onPointerDown = (event: Event) => {
    if (details.open && !event.composedPath().includes(details)) details.open = false;
  };
  const onKeyDown = (event: Event) => {
    if (details.open && 'key' in event && event.key === 'Escape') details.open = false;
  };

  eventTarget.addEventListener('pointerdown', onPointerDown);
  eventTarget.addEventListener('keydown', onKeyDown);

  return () => {
    eventTarget.removeEventListener('pointerdown', onPointerDown);
    eventTarget.removeEventListener('keydown', onKeyDown);
  };
}
