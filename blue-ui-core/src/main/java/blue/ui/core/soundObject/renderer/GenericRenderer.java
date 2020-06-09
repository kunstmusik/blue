package blue.ui.core.soundObject.renderer;

import blue.plugin.BarRendererPlugin;
import blue.score.layers.Layer;
import blue.soundObject.GenericViewable;
import blue.soundObject.SoundObject;
import blue.ui.core.score.layers.soundObject.SoundObjectView;
import blue.ui.utilities.BlueGradientFactory;
import java.awt.*;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
@BarRendererPlugin(scoreObjectType = GenericViewable.class)
public class GenericRenderer implements BarRenderer {

    protected int labelOffset = 5;

    private static Font renderFont = new Font("Dialog", Font.BOLD, 12);

    public GenericRenderer() {
        // this(Color.darkGray);
    }

    @Override
    public void render(Graphics graphics, SoundObjectView sObjView,
            int pixelSeconds) {

        Graphics2D g = (Graphics2D) graphics;

        int w = sObjView.getSize().width;
        int h = sObjView.getSize().height;

        Color bgColor;
        Color border1;
        Color border2;
        Color fontColor;

        SoundObject sObj = sObjView.getSoundObject();

        if (sObjView.isSelected()) {
            bgColor = sObj.getBackgroundColor().brighter().brighter();
            border1 = Color.WHITE;
            border2 = Color.WHITE;
            fontColor = Color.WHITE;
        } else {
            bgColor = sObj.getBackgroundColor();
            border1 = bgColor.brighter().brighter();
            border2 = bgColor.darker().darker();
            int total = bgColor.getRed() + bgColor.getGreen()
                    + bgColor.getBlue();

            if (total > 128 * 3) {
                fontColor = Color.BLACK;
            } else {
                fontColor = Color.WHITE;
            }
        }

        g.setPaint(BlueGradientFactory.getGradientPaint(bgColor));

        g.fillRect(0, 2, w, h - 4);

        if (sObjView.isSelected()) {
            g.setColor(bgColor.darker().darker().darker().darker());
            g.fillRect(0, 2, w, 18);
        }

        g.setColor(border1);
        g.drawLine(0, 2, w, 2);
        g.drawLine(0, 2, 0, h - 2);

        g.setColor(border2);
        g.drawLine(0, h - 2, w, h - 2);
        g.drawLine(w - 1, h - 2, w - 1, 2);
        
        if(sObjView.isSelected()) {
            g.setColor(new Color(255,255,255,196));
            g.drawRect(1, 3, w - 3, h - 6);
        }
        

        // paint repeat
        double repeatPoint = sObj.getRepeatPoint();

        if (sObj.getTimeBehavior() == SoundObject.TIME_BEHAVIOR_REPEAT
                && repeatPoint > 0.0f) {

            double lineTime = repeatPoint;
            double dur = sObj.getSubjectiveDuration();

            int[] x = new int[3];
            int[] y = new int[3];

            while (lineTime <= dur) {

                g.setColor(border2);

                int lineX = (int) (lineTime * pixelSeconds);

                // g.drawLine(lineX, 3, lineX, h - 4);
                x[0] = lineX - 5;
                x[1] = lineX;
                x[2] = lineX;

                y[0] = 3;
                y[1] = 8;
                y[2] = 3;

                g.fillPolygon(x, y, 3);

                y[0] = h - 3;
                y[1] = h - 8;
                y[2] = h - 3;

                g.fillPolygon(x, y, 3);

                lineTime += repeatPoint;
            }
        }

        g.setPaint(fontColor);

        if (h >= 20) {
            g.setComposite(AlphaComposite.Src);
            g.setFont(renderFont);

            String[] parts = sObjView.getSoundObject().getName().split(
                    "\\\\[n]");

            for (int i = 0; i < parts.length; i++) {
                int y = 15 + (i * Layer.LAYER_HEIGHT);
                g.drawString(parts[i], labelOffset, y);
            }
        }

        // EMPTY OUT CORNERS
        // g.setColor(Color.BLACK);
        // g.drawLine(0, 2, 0, 2);
        // g.drawLine(0, h - 3, 0, h - 3);
        // g.drawLine(w - 1, 2, w - 1, 2);
        // g.drawLine(w - 1, h - 3, w - 1, h - 3);
    }

    @Override
    public void cleanup(SoundObjectView sObjView) {
    }

}
