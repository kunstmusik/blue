/*
 * blue - object composition environment for csound
 * Copyright (c) 2025 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.score;

/**
 * Predefined snap values for timeline editing.
 * Based on DAW research (Ardour, Logic Pro, Reaper, Pro Tools).
 *
 * @author Steven Yi
 */
public enum SnapValue {
    
    // Musical values (in beats, assuming 4/4 time signature)
    BAR("Bar", 4.0, SnapCategory.MUSICAL),
    BEAT("Beat", 1.0, SnapCategory.MUSICAL),
    HALF("1/2", 0.5, SnapCategory.MUSICAL),
    QUARTER("1/4", 0.25, SnapCategory.MUSICAL),
    EIGHTH("1/8", 0.125, SnapCategory.MUSICAL),
    SIXTEENTH("1/16", 0.0625, SnapCategory.MUSICAL),
    THIRTY_SECOND("1/32", 0.03125, SnapCategory.MUSICAL),
    SIXTY_FOURTH("1/64", 0.015625, SnapCategory.MUSICAL),
    
    // Triplets
    QUARTER_TRIPLET("1/4T", 1.0 / 3.0, SnapCategory.TRIPLET),
    EIGHTH_TRIPLET("1/8T", 0.5 / 3.0, SnapCategory.TRIPLET),
    SIXTEENTH_TRIPLET("1/16T", 0.25 / 3.0, SnapCategory.TRIPLET),
    
    // Time-based (in seconds, converted to beats at runtime)
    ONE_SECOND("1 sec", 1.0, SnapCategory.TIME),
    HUNDRED_MS("100 ms", 0.1, SnapCategory.TIME),
    TEN_MS("10 ms", 0.01, SnapCategory.TIME),
    ONE_MS("1 ms", 0.001, SnapCategory.TIME),
    
    // SMPTE (frame-based, converted at runtime using frame rate)
    FRAME("Frame", 1.0, SnapCategory.SMPTE),
    
    // Sample-based (converted at runtime using sample rate)
    SAMPLE("Sample", 1.0, SnapCategory.SAMPLE),
    
    // Smart/Auto mode
    AUTO("Auto", 0.0, SnapCategory.AUTO);
    
    private final String displayName;
    private final double baseValue;
    private final SnapCategory category;
    
    SnapValue(String displayName, double baseValue, SnapCategory category) {
        this.displayName = displayName;
        this.baseValue = baseValue;
        this.category = category;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    /**
     * Gets the base value for this snap setting.
     * For MUSICAL and TRIPLET: value in beats
     * For TIME: value in seconds
     * For SMPTE: value in frames (multiply by frame duration)
     * For SAMPLE: value in samples (divide by sample rate)
     * For AUTO: returns 0 (calculated dynamically)
     */
    public double getBaseValue() {
        return baseValue;
    }
    
    public SnapCategory getCategory() {
        return category;
    }
    
    /**
     * Calculates the snap value in beats.
     * 
     * @param tempo current tempo in BPM (for time-based conversions)
     * @param smpteFrameRate SMPTE frame rate (for frame-based conversions)
     * @param sampleRate audio sample rate (for sample-based conversions)
     * @param pixelSecond current zoom level (for auto mode)
     * @return snap value in beats
     */
    public double toBeats(double tempo, double smpteFrameRate, double sampleRate, double pixelSecond) {
        return switch (category) {
            case MUSICAL, TRIPLET -> baseValue;
            case TIME -> {
                // Convert seconds to beats: beats = seconds * (tempo / 60)
                double beatsPerSecond = tempo / 60.0;
                yield baseValue * beatsPerSecond;
            }
            case SMPTE -> {
                // Convert frames to beats
                double secondsPerFrame = 1.0 / smpteFrameRate;
                double beatsPerSecond = tempo / 60.0;
                yield baseValue * secondsPerFrame * beatsPerSecond;
            }
            case SAMPLE -> {
                // Convert samples to beats
                double secondsPerSample = 1.0 / sampleRate;
                double beatsPerSecond = tempo / 60.0;
                yield baseValue * secondsPerSample * beatsPerSecond;
            }
            case AUTO -> {
                // Auto mode: calculate based on zoom level
                // Target ~60 pixels between snap points
                double targetPixelSpacing = 60.0;
                double beatsPerPixel = 1.0 / pixelSecond;
                double rawSnapValue = targetPixelSpacing * beatsPerPixel;
                // Round to nearest power of 2 subdivision
                yield roundToNearestSnapValue(rawSnapValue);
            }
        };
    }
    
    /**
     * Finds the SnapValue whose baseValue is closest to the given legacy double value.
     * Only considers MUSICAL and TRIPLET categories (the ones historically stored as doubles).
     * Falls back to BEAT if no close match is found.
     */
    public static SnapValue closestMatch(double legacyValue) {
        SnapValue best = BEAT;
        double bestDiff = Double.MAX_VALUE;
        for (SnapValue sv : values()) {
            if (sv.category == SnapCategory.MUSICAL || sv.category == SnapCategory.TRIPLET) {
                double diff = Math.abs(sv.baseValue - legacyValue);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    best = sv;
                }
            }
        }
        return best;
    }

    /**
     * Rounds a raw snap value to the nearest musical subdivision.
     */
    private static double roundToNearestSnapValue(double rawValue) {
        // Find the nearest power of 2 that's >= rawValue
        double[] musicalValues = {4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625};
        for (double val : musicalValues) {
            if (rawValue >= val) {
                return val;
            }
        }
        return 0.015625; // Minimum: 1/64
    }
    
    /**
     * Category of snap values for UI grouping.
     */
    public enum SnapCategory {
        MUSICAL("Musical"),
        TRIPLET("Triplets"),
        TIME("Time"),
        SMPTE("SMPTE"),
        SAMPLE("Samples"),
        AUTO("Auto");
        
        private final String displayName;
        
        SnapCategory(String displayName) {
            this.displayName = displayName;
        }
        
        public String getDisplayName() {
            return displayName;
        }
    }
}
