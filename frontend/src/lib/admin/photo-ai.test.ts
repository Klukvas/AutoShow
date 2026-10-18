import { describe, expect, it } from 'vitest';
import { generationAttempt, generationLabel, scenePrompt, photoAiStatus } from './photo-ai';

describe('photo AI prompt and request identity', () => {
  it('retains uncertain same-prompt request identity across retries', () => {
    const first = generationAttempt(null, 'scene', null, ' Studio ', () => 'request-1');
    expect(generationAttempt(first, 'scene', null, 'Studio', () => 'request-2')).toBe(first);
    expect(generationAttempt(first, 'enhance', null, 'Studio', () => 'request-2').requestId).toBe(
      'request-2',
    );
    expect(generationAttempt(first, 'scene', null, 'New studio', () => 'r3').requestId).toBe('r3');
    expect(generationAttempt(first, 'scene', 'studio', 'Studio', () => 'r4').requestId).toBe('r4');
  });
  it('sends a builtin preset by id only, with the wishes as the prompt', () => {
    const attempt = generationAttempt(null, 'scene', 'studio', '', () => 'request-1');
    expect(attempt).toEqual({
      requestId: 'request-1',
      category: 'scene',
      presetId: 'studio',
      prompt: '',
    });
    expect(generationAttempt(attempt, 'scene', 'studio', ' ', () => 'request-2')).toBe(attempt);
    expect(generationAttempt(null, 'scene', null, 'Own', () => 'r')).not.toHaveProperty('presetId');
  });
  it('labels history by preset name and wishes, or by the own instruction', () => {
    expect(generationLabel({ presetName: 'Світла студія', prompt: 'темніша підлога' })).toBe(
      'Світла студія · темніша підлога',
    );
    expect(generationLabel({ presetName: 'Світла студія', prompt: '' })).toBe('Світла студія');
    expect(generationLabel({ presetName: null, prompt: 'Own scene' })).toBe('Own scene');
  });
  it('includes every editable scene constructor field', () => {
    const prompt = scenePrompt('Concrete', 'Morning', 'Cloudy', 'Keep reflections subtle');
    for (const value of ['Concrete', 'Morning', 'Cloudy', 'Keep reflections subtle'])
      expect(prompt).toContain(value);
  });
  it('labels interrupted work truthfully', () =>
    expect(photoAiStatus('interrupted')).toBe('Обробку перервано'));
});
