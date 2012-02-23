/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.plaf;

import java.awt.Color;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import javax.swing.JComponent;
import javax.swing.JSlider;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.metal.MetalSliderUI;

/**
 *
 * @author stevenyi
 */
public class BlueSliderUI extends MetalSliderUI {

    public static ComponentUI createUI(JComponent c) {
        return new BlueSliderUI();
    }

    @Override
    public void paintTrack(Graphics g) {
        Color trackColor = !slider.isEnabled() ? BlueLookAndFeel.getControlShadow()
                : slider.getForeground();

        boolean leftToRight = slider.getComponentOrientation().isLeftToRight();

        g.translate(trackRect.x, trackRect.y);

        int trackLeft = 0;
        int trackTop = 0;
        int trackRight = 0;
        int trackBottom = 0;

        // Draw the track
        if (slider.getOrientation() == JSlider.HORIZONTAL) {
            trackBottom = (trackRect.height - 1) - getThumbOverhang();
            trackTop = trackBottom - (getTrackWidth() - 1);
            trackRight = trackRect.width - 1;
        } else {
            if (leftToRight) {
                trackLeft = (trackRect.width - getThumbOverhang())
                        - getTrackWidth();
                trackRight = (trackRect.width - getThumbOverhang()) - 1;
            } else {
                trackLeft = getThumbOverhang();
                trackRight = getThumbOverhang() + getTrackWidth() - 1;
            }
            trackBottom = trackRect.height - 1;
        }
        Graphics2D g2d = (Graphics2D) g;
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);


//        if (slider.isEnabled()) {
            g2d.setColor(BlueLookAndFeel.getBlack());
            
//        } else {
//            g2d.setColor(BlueLookAndFeel.getBlack());
//        }
        
        g2d.fillRoundRect(trackLeft, trackTop, (trackRight - trackLeft) - 1,
                    (trackBottom - trackTop) - 1, 6, 6);
            

        //System.err.println("FilledSlider:  " + filledSlider);

//        // Draw the fill
//	if ( filledSlider ) {
//	    int middleOfThumb = 0;
//	    int fillTop = 0;
//	    int fillLeft = 0;
//	    int fillBottom = 0;
//	    int fillRight = 0;
//
//	    if ( slider.getOrientation() == JSlider.HORIZONTAL ) {
//	        middleOfThumb = thumbRect.x + (thumbRect.width / 2);
//		middleOfThumb -= trackRect.x; // To compensate for the g.translate()
//		fillTop = !slider.isEnabled() ? trackTop : trackTop + 1;
//		fillBottom = !slider.isEnabled() ? trackBottom - 1 : trackBottom - 2;
//		
//		if ( !drawInverted() ) {
//		    fillLeft = !slider.isEnabled() ? trackLeft : trackLeft + 1;
//		    fillRight = middleOfThumb;
//		}
//		else {
//		    fillLeft = middleOfThumb;
//		    fillRight = !slider.isEnabled() ? trackRight - 1 : trackRight - 2;
//		}
//	    }
//	    else {
//	        middleOfThumb = thumbRect.y + (thumbRect.height / 2);
//		middleOfThumb -= trackRect.y; // To compensate for the g.translate()
//		fillLeft = !slider.isEnabled() ? trackLeft : trackLeft + 1;
//		fillRight = !slider.isEnabled() ? trackRight - 1 : trackRight - 2;
//		
//		if ( !drawInverted() ) {
//		    fillTop = middleOfThumb;
//		    fillBottom = !slider.isEnabled() ? trackBottom - 1 : trackBottom - 2;
//		}
//		else {
//		    fillTop = !slider.isEnabled() ? trackTop : trackTop + 1;
//		    fillBottom = middleOfThumb;
//		}
//	    }
//	    
//	    if ( slider.isEnabled() ) {
//	        g.setColor( slider.getBackground() );
//		g.drawLine( fillLeft, fillTop, fillRight, fillTop );
//		g.drawLine( fillLeft, fillTop, fillLeft, fillBottom );
//
//		g.setColor( BlueLookAndFeel.getControlShadow() );
//		g.fillRect( fillLeft + 1, fillTop + 1,
//			    fillRight - fillLeft, fillBottom - fillTop );
//	    }
//	    else {
//	        g.setColor( BlueLookAndFeel.getControlShadow() );
//		g.fillRect( fillLeft, fillTop,
//			    fillRight - fillLeft, trackBottom - trackTop );
//	    }
//	}
//
        g.translate(-trackRect.x, -trackRect.y);
//    
    }
}
