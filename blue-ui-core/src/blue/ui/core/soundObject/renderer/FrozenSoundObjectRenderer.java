package blue.ui.core.soundObject.renderer;

import blue.plugin.BarRendererPlugin;
import blue.score.layers.Layer;
import blue.soundObject.FrozenSoundObject;
import blue.ui.core.score.layers.soundObject.SoundObjectView;
import java.awt.*;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */
@BarRendererPlugin(scoreObjectType = FrozenSoundObject.class)
public class FrozenSoundObjectRenderer implements BarRenderer {
    private static Font renderFont = new Font("Dialog", Font.BOLD, 12);

    protected static Color selectedBgColor = Color.white;

    protected static Color selectedBorder1 = selectedBgColor.brighter()
            .brighter();

    protected static Color selectedBorder2 = selectedBgColor.darker().darker();

    protected static Color selectedFontColor = Color.darkGray;

    protected static Color normalBgColor = new Color(193, 205, 205);

    private static Color normalBorder1 = normalBgColor.brighter().brighter();

    private static Color normalBorder2 = normalBgColor.darker().darker();

    protected static Color normalFontColor = Color.black;

    private static Color shadeColor = new Color(0, 0, 0, 64);

    @Override
    public void render(Graphics graphics, SoundObjectView sObjView,
            int pixelSeconds) {

        Graphics2D g = (Graphics2D) graphics;
        int w = sObjView.getSize().width;
        int h = sObjView.getSize().height;

        FrozenSoundObject fso = (FrozenSoundObject) sObjView.getSoundObject();
        float percentOriginal = fso.getFrozenSoundObject()
                .getSubjectiveDuration()
                / fso.getSubjectiveDuration();

        Color bgColor;
        Color border1;
        Color border2;
        Color fontColor;

        if (sObjView.isSelected()) {
            bgColor = selectedBgColor;
            border1 = selectedBorder1;
            border2 = selectedBorder2;
            fontColor = selectedFontColor;
        } else {
            bgColor = normalBgColor;
            border1 = normalBorder1;
            border2 = normalBorder2;
            fontColor = normalFontColor;
        }

        g.setPaint(bgColor);

        // fill original soundObject area
        g.fillRect(0, 2, w, h - 4);

        // fill extended area
        g.setColor(shadeColor);
        g.fillRect((int) (w * percentOriginal), 2, w, h - 4);

        // DRAW BORDERS
//        if (ProgramOptions.getGeneralSettings().isDrawFlatSObjBorders()) {
//            g.setColor(Color.LIGHT_GRAY);
//            g.drawRect(0, 2, w - 1, h - 4);
//        } else {
            g.setColor(border1);
            g.drawLine(0, 2, w - 1, 2);
            g.drawLine(0, 2, 0, h - 4);

            g.setColor(border2);
            g.drawLine(0, h - 3, w, h - 3);
            g.drawLine(w - 1, h - 3, w - 1, 2);
//        }

        g.setPaint(fontColor);

        if (h >= 20) {
            g.setComposite(AlphaComposite.Src);
            g.setFont(renderFont);

            String parts[] = sObjView.getSoundObject().getName().split(
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