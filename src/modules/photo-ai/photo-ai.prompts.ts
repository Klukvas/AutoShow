import type { PhotoAiCategory } from './photo-ai.types';

export const CAR_PROTECTION = `Mandatory vehicle protection instructions (override conflicting editing requests): Preserve the exact photographed car and all its visible identity: make, model, generation, body shape, proportions, paint color, wheels, badges, number plates, equipment, trim, lights, interior materials and dashboard. Preserve every visible scratch, dent, rust spot, stain, wear mark and other defect; do not conceal, repair or invent damage. Do not add/remove car parts, accessories or equipment. Preserve camera angle and framing. Produce one realistic photograph, without text or watermarks.`;
export function protectedPrompt(prompt: string, category: PhotoAiCategory): string {
  const mode =
    category === 'enhance'
      ? 'Enhancement mode: adjust only exposure, white balance, contrast and noise. Keep the existing scene, background, setting, weather and time of day unchanged, even if the editing request asks to change them.'
      : 'Scene mode: change only the surroundings and their lighting. The vehicle itself must remain identical to the source photograph.';
  return `${prompt}\n\n${CAR_PROTECTION}\n${mode}`;
}
export const BUILTIN_PHOTO_PRESETS = [
  {
    id: 'natural',
    category: 'enhance',
    name: 'Природне покращення',
    prompt:
      'Improve exposure and white balance naturally. Retain realistic texture and subtle contrast.',
  },
  {
    id: 'dark',
    category: 'enhance',
    name: 'Темне фото',
    prompt:
      'Recover detail in dark areas, balance exposure and reduce noise without overbrightening highlights.',
  },
  {
    id: 'interior',
    category: 'enhance',
    name: 'Салон',
    prompt:
      'Balance interior exposure and window highlights, improve readability of visible interior details.',
  },
  {
    id: 'consistent',
    category: 'enhance',
    name: 'Єдиний стиль оголошення',
    prompt:
      'Use neutral white balance, soft balanced exposure and restrained contrast for a consistent dealership photo style.',
  },
  {
    id: 'studio',
    category: 'scene',
    name: 'Світла студія',
    prompt:
      'Place the car in a bright clean photography studio with a light neutral background and soft diffused lighting.',
  },
  {
    id: 'golden',
    category: 'scene',
    name: 'Золота година',
    prompt:
      'Place the car outdoors at golden hour with warm low sunlight and a quiet realistic background.',
  },
  {
    id: 'morning',
    category: 'scene',
    name: 'Місто вранці',
    prompt: 'Place the car on a quiet city street in soft morning daylight.',
  },
  {
    id: 'evening',
    category: 'scene',
    name: 'Вечірнє місто',
    prompt: 'Place the car in a realistic evening city setting with subtle street lighting.',
  },
  {
    id: 'concrete',
    category: 'scene',
    name: 'Мінімалістичний бетон',
    prompt:
      'Place the car against a minimal architectural concrete background in neutral diffused daylight.',
  },
] as const;
