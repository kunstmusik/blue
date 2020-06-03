package blue.ui.core.soundObject.renderer;

import blue.plugin.BarRendererPlugin;
import blue.score.layers.Layer;
import blue.soundObject.Comment;
import blue.soundObject.SoundObject;
import blue.ui.core.score.layers.soundObject.SoundObjectView;
import blue.ui.utilities.BlueGradientFactory;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
@BarRendererPlugin(scoreObjectType = Comment.class)
public class CommentRenderer implements BarRenderer {

    private static Font renderFont = new Font("Dialog", Font.ITALIC, 12);

    protected static Color selectedBgColor = Color.white;

    protected static Color selectedBorder1 = selectedBgColor.brighter()
            .brighter();

    protected static Color selectedBorder2 = selectedBgColor.darker().darker();

    protected static Color selectedFontColor = Color.darkGray;

    @Override
    public void render(Graphics graphics, SoundObjectView sObjView,
            int pixelSeconds) {

        Graphics2D g = (Graphics2D) graphics;
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,
                RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        int w = sObjView.getSize().width;
        int h = sObjView.getSize().height;

        Color bgColor;
        Color border1;
        Color border2;
        Color fontColor;

        SoundObject sObj = sObjView.getSoundObject();

        if (sObjView.isSelected()) {
            bgColor = selectedBgColor;
            border1 = selectedBorder1;
            border2 = selectedBorder2;
            fontColor = selectedFontColor;
        } else {
            bgColor = sObj.getBackgroundColor();
            border1 = bgColor.brighter().brighter();
            border2 = bgColor.darker().darker();

            int total = bgColor.getRed() + bgColor.getGreen()
                    + bgColor.getBlue();

            if (total > 128 * 3) {
                fontColor = Color.black;
            } else {
                fontColor = Color.white;
            }
        }

        g.setPaint(BlueGradientFactory.getGradientPaint(bgColor));
        g.fillRect(0, 2, w, h - 4);

        g.setColor(border1);
        g.drawLine(0, 2, w, 2);
        g.drawLine(0, 2, 0, h - 2);

        g.setColor(border2);
        g.drawLine(0, h - 2, w, h - 2);
        g.drawLine(w, h - 2, w, 2);

        g.setPaint(fontColor);

        if (h >= 20) {
            g.setComposite(AlphaComposite.Src);
            g.setFont(renderFont);

            String[] parts = sObjView.getSoundObject().getName().split(
                    "\\\\[n]");

            for (int i = 0; i < parts.length; i++) {
                int y = 15 + (i * Layer.LAYER_HEIGHT);
                g.drawString(parts[i], 5, y);
            }

        }
    }

    @Override
    public void cleanup(SoundObjectView sObjView) {
    }

}
