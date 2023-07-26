/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.plaf.fonts;

import java.awt.Font;
import java.awt.FontFormatException;
import java.awt.GraphicsEnvironment;
import java.io.IOException;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class Fonts {

    public static void registerRobotoFonts() {
        var fonts = new String[]{"Roboto-Black.ttf",
            "Roboto-BlackItalic.ttf",
            "Roboto-Bold.ttf",
            "Roboto-BoldItalic.ttf",
            "Roboto-Italic.ttf",
            "Roboto-Light.ttf",
            "Roboto-LightItalic.ttf",
            "Roboto-Medium.ttf",
            "Roboto-MediumItalic.ttf",
            "Roboto-Regular.ttf",
            "Roboto-Thin.ttf",
            "Roboto-ThinItalic.ttf"};
        var gfx = GraphicsEnvironment.getLocalGraphicsEnvironment();

        for (var font : fonts) {
            try {

                var f = Font.createFont(Font.TRUETYPE_FONT,
                        Fonts.class.getResourceAsStream(font));
                gfx.registerFont(f);
            } catch (FontFormatException ex) {
                Exceptions.printStackTrace(ex);
            } catch (IOException ex) {
                Exceptions.printStackTrace(ex);
            }

        }

    }
}
