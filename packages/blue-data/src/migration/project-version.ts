/**
 * ProjectVersion — handles parsing of version strings and comparison.
 * Used by UpgradeManager to determine if a migration is necessary.
 * Mirrors the Java ProjectVersion class.
 *
 * Version format: "2.3.0" or "2.3.0_beta1"
 */
export class ProjectVersion {
  private versionParts: number[] = [];
  private beta = false;

  private constructor() {}

  /**
   * Parse a version string into a ProjectVersion.
   * Examples: "2.3.0", "2.1.10", "0.95.0", "2.3.0_beta1"
   */
  static parse(versionString: string): ProjectVersion {
    const version = new ProjectVersion();

    if (versionString != null && versionString.length > 0) {
      const parts = versionString.split('_');

      if (parts.length >= 2) {
        version.beta = true;
      }

      const versionNums = parts[0].split('.');
      version.versionParts = versionNums.map((p) => {
        try {
          return parseInt(p, 10);
        } catch {
          return -1;
        }
      });
    }

    return version;
  }

  /**
   * Compare this version to another. Returns true if this < other.
   * Used to determine if an upgrade should be applied.
   */
  lessThan(other: ProjectVersion): boolean {
    for (let i = 0; i < 3; i++) {
      const thisPart = this.versionParts[i] ?? 0;
      const otherPart = other.versionParts[i] ?? 0;
      if (thisPart !== otherPart) {
        return thisPart < otherPart;
      }
    }
    // If versions are equal on major.minor.patch, beta is "less than" release
    return this.beta && !other.beta;
  }

  /** Formats the numeric version components as text. */
  toString(): string {
    const parts = this.versionParts.length > 0 ? this.versionParts.join('.') : 'Empty';
    return `Version:${parts}${this.beta ? ' BETA' : ''}`;
  }
}
