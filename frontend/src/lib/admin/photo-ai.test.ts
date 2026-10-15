import { describe, expect, it } from 'vitest';
import { generationAttempt, scenePrompt, photoAiStatus } from './photo-ai';

describe('photo AI prompt and request identity', () => {
  it('retains uncertain same-prompt request identity across retries', () => {
    const first = generationAttempt(null, 'scene', ' Studio ', () => 'request-1');
    expect(generationAttempt(first, 'scene', 'Studio', () => 'request-2')).toBe(first);
    expect(generationAttempt(first, 'enhance', 'Studio', () => 'request-2').requestId).toBe(
      'request-2',
    );
    expect(generationAttempt(first, 'scene', 'New studio', () => 'request-3').requestId).toBe(
      'request-3',
    );
  });
  it('includes every editable scene constructor field', () => {
    const prompt = scenePrompt('Concrete', 'Morning', 'Cloudy', 'Keep reflections subtle');
    for (const value of ['Concrete', 'Morning', 'Cloudy', 'Keep reflections subtle'])
      expect(prompt).toContain(value);
  });
  it('labels interrupted work truthfully', () =>
    expect(photoAiStatus('interrupted')).toBe('Обробку перервано'));
});
