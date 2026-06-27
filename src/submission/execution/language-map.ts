// Confirmed against a live Piston instance's GET /api/v2/runtimes — verify
// against yours if you install different versions.
export interface PistonLanguage {
  language: string;
  version: string;
}

export const PISTON_LANGUAGES: Record<string, PistonLanguage> = {
  python: { language: 'python', version: '3.12.0' },
  python3: { language: 'python', version: '3.12.0' },
  javascript: { language: 'javascript', version: '20.11.1' },
  typescript: { language: 'typescript', version: '5.0.3' },
  java: { language: 'java', version: '15.0.2' },
  c: { language: 'c', version: '10.2.0' },
  cpp: { language: 'c++', version: '10.2.0' },
  go: { language: 'go', version: '1.16.2' },
  rust: { language: 'rust', version: '1.68.2' },
};

export function resolvePistonLanguage(
  language: string,
): PistonLanguage | undefined {
  return PISTON_LANGUAGES[language.toLowerCase()];
}
