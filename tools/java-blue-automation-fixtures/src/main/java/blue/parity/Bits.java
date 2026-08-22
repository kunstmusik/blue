package blue.parity;

/** Raw IEEE 754 binary64 <-> 16 lowercase hexadecimal digit helpers. */
public final class Bits {

    private Bits() {
    }

    public static String toBits(double value) {
        long raw = Double.doubleToRawLongBits(value);
        return String.format("%016x", raw);
    }

    public static double fromBits(String hex) {
        return Double.longBitsToDouble(Long.parseUnsignedLong(hex, 16));
    }

    /** Next representable value after {@code value} in direction of {@code toward}. */
    public static double nextAfter(double value, double toward) {
        return Math.nextAfter(value, toward);
    }
}
