package blue.parity;

/**
 * SplitMix64 - the generator-owned seeded pseudo-random stream used to derive
 * the deterministic seeded realtime fixture cases.
 *
 * Reference: Guy L. Steele, Doug Lea, Christine H. Flood, "Fast Splittable
 * Pseudorandom Number Generators", PLDI 2014.
 */
public final class SplitMix64 {

    private long state;

    public SplitMix64(long seed) {
        this.state = seed;
    }

    public long nextLong() {
        state += 0x9E3779B97F4A7C15L;
        long z = state;
        z = (z ^ (z >>> 30)) * 0xBF58476D1CE4E5B9L;
        z = (z ^ (z >>> 27)) * 0x94D049BB133111EBL;
        return z ^ (z >>> 31);
    }

    /** Uniform non-negative value in [0, bound). */
    public int nextInt(int bound) {
        // rejection-free for the small bounds used by the generator
        long r = Long.remainderUnsigned(nextLong(), bound);
        return (int) r;
    }

    /** Uniform value in [0.0, 1.0) with 53 random significand bits. */
    public double nextUnit() {
        return (nextLong() >>> 11) * 0x1.0p-53;
    }
}
