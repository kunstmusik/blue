/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.utility;

import java.awt.Color;
import static java.awt.Color.blue;
import static java.awt.Color.green;
import static java.awt.Color.red;

/**
 *
 * @author Steven Yi
 */
public class ColorUtils {

    /**
     * Decodes hex color code string in 0xRRGGBBAA format to Java AWT color.
     * Matches JavaFX's web() method. Used as Blue was using toString() on JFX's
     * Color's class to serialize in BSB, though it wasn't appropriate to do.
     *
     * @param hexColorCode
     * @return Color from hex string
     */
    public static Color decode(String hexColorCode) {
        if (!hexColorCode.startsWith("0x") || hexColorCode.length() != 10) {
            throw new IllegalArgumentException("Invalid hex color code: " + hexColorCode);
        }

        var r = Integer.parseInt(hexColorCode.substring(2, 4), 16);
        var g = Integer.parseInt(hexColorCode.substring(4, 6), 16);
        var b = Integer.parseInt(hexColorCode.substring(6, 8), 16);
        var a = Integer.parseInt(hexColorCode.substring(8, 10), 16);
        return new Color(r, g, b, a);
    }

    /**
     * Encodes AWT Color to 0xRRGGBBAA format to match JavaFX's toString()
     * method. Used as Blue was using toString() on JFX's Color's class to
     * serialize in BSB, though it wasn't appropriate to do.
     *
     * @param color
     * @return Color encoded into hex string with alpha.
     */
    public static String encode(Color color) {
        int r = color.getRed();
        int g = color.getGreen();
        int b = color.getBlue();
        int a = color.getAlpha();
        return String.format("0x%02x%02x%02x%02x", r, g, b, a);
    }
}
