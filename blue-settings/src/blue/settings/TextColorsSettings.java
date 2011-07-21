/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General private License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General private License for more
 * details.
 * 
 * You should have received a copy of the GNU General private License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.settings;

import java.awt.Color;
import java.util.Vector;
import java.util.prefs.BackingStoreException;
import java.util.prefs.Preferences;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import org.openide.util.Exceptions;
import org.openide.util.NbPreferences;

/**
 *
 * @author syi
 */
public class TextColorsSettings {

    private static final String TEXT_BACKGROUND = "textBackground";

    private static final String TEXT_COMMENT = "textComment";

    private static final String TEXT_KEYWORD = "textKeyword";

    private static final String TEXT_NORMAL = "textNormal";

    private static final String TEXT_QUOTE = "textQuote";

    private static final String TEXT_VARIABLE = "textVariable";

    private static final String TEXT_PFIELD = "textPfield";

    private static final String TEXT_FONT_SIZE = "textFontSize";
	
    public Color blueSyntaxNormal;

    public Color blueSyntaxKeyword;

    public Color blueSyntaxVariable;

    public Color blueSyntaxComment;

    public Color blueSyntaxQuote;

    public Color blueSyntaxBackground;

    public Color blueSyntaxPfield;

	public int blueSyntaxFontSize = 12;

    private static TextColorsSettings instance = null;

    private Vector<ChangeListener> listeners = new Vector<ChangeListener>();

    private TextColorsSettings() {
    }

    public static TextColorsSettings getInstance() {
        if (instance == null) {
            instance = new TextColorsSettings();

            final Preferences prefs = NbPreferences.forModule(TextColorsSettings.class);


            instance.blueSyntaxBackground = new Color(
                    prefs.getInt(TEXT_BACKGROUND, Color.BLACK.getRGB()));
            instance.blueSyntaxComment = new Color(
                    prefs.getInt(TEXT_COMMENT, Color.GRAY.getRGB()));
            instance.blueSyntaxKeyword = new Color(
                    prefs.getInt(TEXT_KEYWORD, Color.ORANGE.getRGB()));
            instance.blueSyntaxNormal = new Color(
                    prefs.getInt(TEXT_NORMAL, Color.WHITE.getRGB()));
            instance.blueSyntaxQuote = new Color(
                    prefs.getInt(TEXT_QUOTE, Color.PINK.getRGB()));
            instance.blueSyntaxVariable = new Color(
                    prefs.getInt(TEXT_VARIABLE, Color.PINK.getRGB()));

            instance.blueSyntaxPfield = new Color(
                    prefs.getInt(TEXT_PFIELD, Color.WHITE.getRGB()));

			instance.blueSyntaxFontSize = prefs.getInt(TEXT_FONT_SIZE, 12);

        }
        return instance;
    }

    public void save() {
        final Preferences prefs = NbPreferences.forModule(TextColorsSettings.class);

        prefs.putInt(TEXT_BACKGROUND, blueSyntaxBackground.getRGB());
        prefs.putInt(TEXT_COMMENT, blueSyntaxComment.getRGB());
        prefs.putInt(TEXT_KEYWORD, blueSyntaxKeyword.getRGB());
        prefs.putInt(TEXT_NORMAL, blueSyntaxNormal.getRGB());
        prefs.putInt(TEXT_QUOTE, blueSyntaxQuote.getRGB());
        prefs.putInt(TEXT_VARIABLE, blueSyntaxVariable.getRGB());
        prefs.putInt(TEXT_PFIELD, blueSyntaxPfield.getRGB());
		prefs.putInt(TEXT_FONT_SIZE, blueSyntaxFontSize);
		
        try {
            prefs.sync();
        } catch (BackingStoreException ex) {
            Exceptions.printStackTrace(ex);
        }

        ChangeEvent ce = new ChangeEvent(this);

        for (ChangeListener cl : listeners) {
            cl.stateChanged(ce);
        }
    }

    public void addChangeListener(ChangeListener cl) {
        listeners.add(cl);
    }

    public void removeChangeListener(ChangeListener cl) {
        listeners.remove(cl);
    }
}
