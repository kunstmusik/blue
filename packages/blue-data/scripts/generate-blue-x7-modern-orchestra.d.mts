/**
 * Type declarations for the deterministic BlueX7 orchestra bundler. The
 * implementation lives in generate-blue-x7-modern-orchestra.mjs (Node-only);
 * tests import the pure rendering helpers.
 */
export declare function escapeOrcForTemplateLiteral(text: string): string;

export declare function renderGeneratedModule(orcText: string, orcSha256: string): string;

export declare function main(argv: string[]): void;
