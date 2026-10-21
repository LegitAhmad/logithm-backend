export interface PistonLanguage {
  language: string;
  version: string;
}

export const PISTON_LANGUAGES: Record<string, PistonLanguage> = {
  python: { language: 'python', version: '3.12.0' },
  python3: { language: 'python', version: '3.12.0' },
  javascript: { language: 'javascript', version: '20.11.1' },
  typescript: { language: 'typescript', version: '5.0.3' },
  go: { language: 'go', version: '1.16.2' },
};

export function resolvePistonLanguage(
  language: string,
): PistonLanguage | undefined {
  return PISTON_LANGUAGES[language.toLowerCase()];
}
