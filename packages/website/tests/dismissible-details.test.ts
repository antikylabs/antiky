import assert from 'node:assert/strict';
import test from 'node:test';
import { bindDetailsDismissal } from '../src/lib/dismissible-details.ts';

function detailsFixture() {
  const details = Object.assign(new EventTarget(), { open: true });

  return { details };
}

function pointerEvent(path: EventTarget[]) {
  const event = new Event('pointerdown');
  Object.defineProperty(event, 'composedPath', { value: () => path });
  return event;
}

function keyEvent(key: string) {
  const event = new Event('keydown');
  Object.defineProperty(event, 'key', { value: key });
  return event;
}

test('an open details menu stays open for an inside pointer and closes for an outside pointer', () => {
  const { details } = detailsFixture();
  const events = new EventTarget();
  bindDetailsDismissal(details, events);

  events.dispatchEvent(pointerEvent([details]));

  assert.equal(details.open, true);

  events.dispatchEvent(pointerEvent([new EventTarget()]));

  assert.equal(details.open, false);
});

test('Escape closes an open details menu', () => {
  const { details } = detailsFixture();
  const events = new EventTarget();
  bindDetailsDismissal(details, events);

  events.dispatchEvent(keyEvent('Escape'));

  assert.equal(details.open, false);
});

test('removing the dismissal listeners leaves the menu state alone', () => {
  const { details } = detailsFixture();
  const events = new EventTarget();
  const unbind = bindDetailsDismissal(details, events);

  unbind();
  events.dispatchEvent(pointerEvent([new EventTarget()]));

  assert.equal(details.open, true);
});
