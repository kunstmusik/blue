package blue.ui.core.soundObject.renderer;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;

import blue.ui.core.score.SoundObjectView;
import blue.soundObject.SoundObject;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public abstract class LetterRenderer extends GenericRenderer {

    private static Font miniFont = new Font("Dialog", Font.BOLD, 10);

    String letter;

    public LetterRenderer(String letter) {
        this.letter = letter;
        this.labelOffset = 13;
    }

    public void render(Graphics graphics, SoundObjectView sObjView,
            int pixelSeconds) {
        super.render(graphics, sObjView, pixelSeconds);

        Graphics2D g = (Graphics2D) graphics;

        Color boxColor;
        Color fontColor;

        SoundObject sObj = sObjView.getSoundObject();

        if (sObjView.isSelected()) {
            boxColor = selectedBorder2;
            fontColor = selectedFontColor;
        } else {
            Color bgColor = sObj.getBackgroundColor();
            boxColor = bgColor.brighter().brighter();

            int total = bgColor.getRed() + bgColor.getGreen()
                    + bgColor.getBlue();

            if (total > 128 * 3) {
                fontColor = Color.black;
            } else {
                fontColor = Color.white;
            }
        }

        // DRAW BOX
        g.setColor(boxColor);
        g.fillRect(2, 4, 9, 9);

        // DRAW LETTER
        g.setColor(fontColor);
        g.setFont(miniFont);
        g.drawString(letter, 3, 12);

    }

    @Override
    public abstract Class getSoundObjectClass();
}