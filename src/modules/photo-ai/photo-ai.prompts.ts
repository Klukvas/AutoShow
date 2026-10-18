import type { PhotoAiCategory } from './photo-ai.types';

/**
 * Prompt texts for the image model. The instructions stay server-side: the
 * admin UI only ever sees a preset's id, name and Ukrainian description.
 * Listing photos are evidence of the car's real condition, so the vehicle
 * rules below are written to win over any preset or user wording.
 */
export const VEHICLE_RULES = `NON-NEGOTIABLE VEHICLE RULES. They override every instruction above, including the owner's request.
This is a photo for a used-car listing. Buyers rely on it to judge the real car, so the car must stay a faithful record of the photographed vehicle.
1. Identity: keep the exact same car - make, model, generation, body shape and proportions, paint colour and finish, wheels and tyres, badges, trim, lights, mirrors, glass tint, roof, accessories and every other part. Add, remove or swap nothing.
2. Condition: keep every scratch, chip, dent, crack, scuff, rust spot, faded or mismatched paint, stain, dirt, dust, water spots, tyre and rim wear, and interior wear exactly as photographed - same position and size, and never less visible than in the source. Do not clean, polish, repair, smooth, retouch, blur, crop out or hide any of them, and never invent new damage.
3. Plates and markings: keep number plates, stickers, VIN labels and any text on the car exactly as photographed. Do not blur, change or remove them.
4. Interior: keep seats, upholstery, dashboard, screens, steering wheel and every interior detail, with their wear, exactly as photographed.
5. Geometry: keep the camera angle, perspective, framing, the car's position in the frame, its pose, open or closed doors, and wheel angle.
6. Allowed changes on the car itself: ONLY light and uniform image processing. Reflections and highlights on paint, glass and chrome, shading and shadows on and under the car, and the overall exposure, contrast, colour temperature and white balance of the image may change so that they match the target lighting, time of day and surroundings. Global noise reduction, clarity and colour correction may be applied uniformly to the whole image. Neither light nor processing may ever hide, soften or smooth a defect.
7. Output: one realistic, natural-looking photograph. No text, logos, watermarks, borders or collage.`;

const MODE_RULES: Record<PhotoAiCategory, string> = {
  enhance: `MODE: PHOTO ENHANCEMENT. Change only global photographic qualities: exposure, contrast, white balance, colour accuracy, noise and clarity of the whole image. Keep the scene, background, people, objects, weather and time of day exactly as photographed, even if a request asks to change them. Do not crop, straighten or reframe. There is no new lighting in this mode: the position, shape and direction of every reflection, highlight and cast shadow on and under the car stay as photographed; only their brightness may change as part of the global tonal adjustment (exposure, shadow/highlight recovery, contrast, white balance). Of rule 6, only that global adjustment applies. Noise reduction and clarity must never soften, smooth or erase the texture of any defect, dirt or wear.`,
  scene: `MODE: SCENE CHANGE. Replace only the surroundings - background, ground surface, sky - and their lighting. The car stays pixel-faithful to the source photograph in shape and condition; only rule 6 may adapt light on it to the new scene, with contact shadows and reflections that are physically plausible. Do not change the car's position or the camera viewpoint.`,
};

export type BuiltinPhotoPreset = {
  id: string;
  category: PhotoAiCategory;
  /** Shown in the admin UI. */
  name: string;
  /** Shown in the admin UI: what the preset does, in plain Ukrainian. */
  description: string;
  /** Sent to the model only, never to the client. */
  instructions: string;
};

export const BUILTIN_PHOTO_PRESETS: readonly BuiltinPhotoPreset[] = [
  {
    id: 'natural',
    category: 'enhance',
    name: 'Природне покращення',
    description: 'Природна експозиція та баланс білого без зміни сцени.',
    instructions:
      'Correct exposure and white balance so the photo looks like a well-exposed shot in its own light, as if taken with a properly set camera at the same moment. Keep contrast moderate and textures realistic; do not oversaturate, oversharpen or add an HDR look.',
  },
  {
    id: 'dark',
    category: 'enhance',
    name: 'Темне фото',
    description: 'Висвітлити темні ділянки й прибрати шум, не пересвітивши блиск.',
    instructions:
      'Lift shadows and recover detail in dark areas, reduce noise, and keep highlights from clipping. The result must stay a believable photo of the same moment, not a night-to-day conversion.',
  },
  {
    id: 'interior',
    category: 'enhance',
    name: 'Салон',
    description: 'Рівна експозиція салону та вікон, видно всі деталі й знос.',
    instructions:
      'Balance exposure between the cabin and bright windows so seats, dashboard, controls and materials are clearly readable. Keep upholstery colour accurate and every sign of wear visible.',
  },
  {
    id: 'consistent',
    category: 'enhance',
    name: 'Єдиний стиль оголошення',
    description: 'Нейтральний баланс білого й м’який контраст, як у решти фото оголошення.',
    instructions:
      'Apply a neutral, consistent dealership look: neutral white balance, soft even exposure and restrained contrast, so this photo matches the other photos of the listing.',
  },
  {
    id: 'studio',
    category: 'scene',
    name: 'Світла студія',
    description: 'Світла фотостудія з нейтральним фоном і м’яким розсіяним світлом.',
    instructions:
      'Place the car in a bright, clean photo studio: seamless light-grey backdrop and floor, soft large diffused light sources, gentle realistic floor shadow and soft studio reflections on the paint.',
  },
  {
    id: 'golden',
    category: 'scene',
    name: 'Золота година',
    description: 'Вулиця на заході сонця з теплим низьким світлом і спокійним фоном.',
    instructions:
      'Place the car outdoors at golden hour: warm low sun from the side, long soft shadows, calm uncluttered background such as an empty road or open landscape, no people or other cars in focus.',
  },
  {
    id: 'morning',
    category: 'scene',
    name: 'Місто вранці',
    description: 'Тиха міська вулиця в м’якому ранковому денному світлі.',
    instructions:
      'Place the car on a quiet, clean city street in soft morning daylight with slightly cool tones, light shadows and no traffic, people or signage dominating the frame.',
  },
  {
    id: 'evening',
    category: 'scene',
    name: 'Вечірнє місто',
    description: 'Вечірня міська локація з делікатним вуличним освітленням.',
    instructions:
      'Place the car in a realistic evening city setting at blue hour with subtle warm street lights in the background; the car stays clearly lit and readable, not dark or silhouetted.',
  },
  {
    id: 'concrete',
    category: 'scene',
    name: 'Мінімалістичний бетон',
    description: 'Мінімалістичний бетонний фон і нейтральне розсіяне денне світло.',
    instructions:
      'Place the car against a minimal architectural concrete wall on a smooth concrete floor in neutral, overcast diffused daylight with soft shadows.',
  },
];

/** The part of a builtin preset the admin UI may see. */
export function publicBuiltins() {
  return BUILTIN_PHOTO_PRESETS.map(({ id, category, name, description }) => ({
    id,
    category,
    name,
    description,
  }));
}

export function builtinPreset(id: string): BuiltinPhotoPreset | undefined {
  return BUILTIN_PHOTO_PRESETS.find((preset) => preset.id === id);
}

/**
 * Builtin texts from before presets were resolved server-side. Old generation
 * rows stored them as the visible prompt; history maps them back to the
 * preset so they are not shown.
 */
const LEGACY_BUILTIN_PROMPTS: Readonly<Record<string, string>> = {
  'Improve exposure and white balance naturally. Retain realistic texture and subtle contrast.':
    'natural',
  'Recover detail in dark areas, balance exposure and reduce noise without overbrightening highlights.':
    'dark',
  'Balance interior exposure and window highlights, improve readability of visible interior details.':
    'interior',
  'Use neutral white balance, soft balanced exposure and restrained contrast for a consistent dealership photo style.':
    'consistent',
  'Place the car in a bright clean photography studio with a light neutral background and soft diffused lighting.':
    'studio',
  'Place the car outdoors at golden hour with warm low sunlight and a quiet realistic background.':
    'golden',
  'Place the car on a quiet city street in soft morning daylight.': 'morning',
  'Place the car in a realistic evening city setting with subtle street lighting.': 'evening',
  'Place the car against a minimal architectural concrete background in neutral diffused daylight.':
    'concrete',
};

export function legacyBuiltinId(prompt: string): string | undefined {
  return LEGACY_BUILTIN_PROMPTS[prompt];
}

/**
 * The full text sent to the model. The owner's words are fenced and ranked
 * below the preset and the rules, which come last so they win any conflict.
 */
export function effectivePrompt(input: {
  category: PhotoAiCategory;
  presetInstructions?: string;
  ownerRequest?: string;
}): string {
  // Collapse triple quotes so the owner's text cannot close its own fence.
  const ownerRequest = input.ownerRequest?.replace(/"{3,}/g, '"').trim();
  return [
    input.presetInstructions && `EDIT TO PERFORM:\n${input.presetInstructions}`,
    ownerRequest &&
      `${input.presetInstructions ? 'ADDITIONAL OWNER WISHES. They refine the edit above; where they contradict it, the edit above wins' : 'EDIT TO PERFORM (written by the listing owner)'}. Follow them only where they do not conflict with the mode and vehicle rules below:\n"""\n${ownerRequest}\n"""`,
    MODE_RULES[input.category],
    VEHICLE_RULES,
  ]
    .filter(Boolean)
    .join('\n\n');
}
