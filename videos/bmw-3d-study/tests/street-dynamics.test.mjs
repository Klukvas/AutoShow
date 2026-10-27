import test from 'node:test';
import assert from 'node:assert/strict';
import { STREET_RATE, STREET_STOP, STREET_PUSH, CARD_START, streetScale, streetCardProgress, streetCardPose } from '../street-dynamics.js';

test('street camera is static through arrival, stop, hold, backward seeks and reduced motion', () => {
  assert.equal(STREET_RATE, 1.3);
  assert.equal(STREET_PUSH, 0);
  assert.equal(streetScale(0), 1);
  assert.equal(streetScale(STREET_STOP), 1);
  for (const time of [5, 2.5, 4, 1, 0, 2.5]) {
    const scale = streetScale(time);
    assert.equal(scale, 1);
    if (time >= 2.5) assert.equal(scale, 1);
  }
  assert.equal(streetScale(1.25), 1);
  for (const time of [0, 1.25, 2.5, 5]) assert.equal(streetScale(time, true), 1);
});

test('cards reveal immediately from t=0 with real-time stagger independent of source rate', () => {
  assert.equal(CARD_START, 0);
  for (let index = 0; index < 3; index += 1) {
    assert.equal(streetCardProgress(0, index), 0);
    assert.equal(streetCardProgress(5, index), 1);
    const start = CARD_START + index * 0.075 * STREET_RATE;
    assert.ok(Math.abs(streetCardProgress(start + 0.21 * STREET_RATE, index) - 0.5) < 1e-12);
    assert.ok(streetCardProgress(start + 0.42 * STREET_RATE + 1e-12, index) === 1);
  }
});

test('card photo and text are fully revealed within 630ms and forced states reveal every part', () => {
  for (let index = 0; index < 3; index += 1) {
    const final = streetCardPose(5, index);
    assert.equal(final.complete, true);
    assert.equal(final.interactive, true);
    assert.equal(final.opacity, 1);
    assert.equal(final.y, 0);
    assert.equal(final.scale, 1);
    assert.equal(final.photoScale, 1);
    assert.equal(final.photoInset, 0);
    assert.equal(final.skeletonOpacity, 0);
    assert.ok(final.text.every(row => row.opacity === 1 && row.y === 0));
    for (const time of [0, 2.5, 2.7]) assert.deepEqual(streetCardPose(time, index, true), final);
    assert.equal(streetCardPose(0.63 * STREET_RATE + 1e-9, index).complete, true);
    const start = CARD_START + index * 0.075 * STREET_RATE;
    assert.equal(streetCardPose(start, index).interactive, false);
    assert.equal(streetCardPose(start + 0.085 * STREET_RATE, index).interactive, true);
  }
});

test('skeleton occupies every deferred slot and crossfades away before the photo finishes', () => {
  for (let index = 0; index < 3; index += 1) {
    assert.equal(streetCardPose(0, index).skeletonOpacity, 1);
    assert.equal(streetCardPose(0, index).interactive, false);
    const start = CARD_START + index * 0.075 * STREET_RATE;
    const partial = streetCardPose(start + 0.08 * STREET_RATE, index);
    assert.ok(partial.skeletonOpacity > 0 && partial.skeletonOpacity < 1);
    const revealed = streetCardPose(start + 0.23 * STREET_RATE, index);
    assert.equal(revealed.skeletonOpacity, 0);
    assert.equal(revealed.opacity, 1);
    assert.equal(revealed.complete, false);
    for (const time of [0, 1, 2.65]) assert.equal(streetCardPose(time, index, true).skeletonOpacity, 0);
  }
});

test('skeleton reset and partial opacity are deterministic across replay and backward seek', () => {
  const partial = streetCardPose(0.15, 0);
  streetCardPose(5, 0);
  assert.equal(streetCardPose(0, 0).skeletonOpacity, 1);
  assert.deepEqual(streetCardPose(0.15, 0), partial);
  assert.equal(streetCardPose(5, 0).skeletonOpacity, 0);
});

test('card entrance remains bounded and reconstructs the same partial pose after backward seeks', () => {
  const first = streetCardPose(0.3, 0);
  for (const time of [5, 0, 1.2, 0.6, 0.3]) {
    const pose = streetCardPose(time, 0);
    assert.ok(pose.opacity >= 0 && pose.opacity <= 1);
    assert.ok(pose.y >= 0 && pose.y <= 24);
    assert.ok(pose.scale >= 0.975 && pose.scale <= 1);
    assert.ok(pose.photoScale >= 1 && pose.photoScale <= 1.04);
    assert.ok(pose.photoInset >= 0 && pose.photoInset <= 10);
  }
  assert.deepEqual(streetCardPose(0.3, 0), first);
  assert.equal(streetCardPose(0, 0).visible, false);
  assert.equal(streetCardPose(0, 2).visible, false);
});
