/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.orchestra.blueSynthBuilder;

import electric.xml.Element;
import java.math.BigDecimal;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class BSBVSliderBankTest {
    
    public BSBVSliderBankTest() {
    }

    /**
     * Test that when setting values on bank, child slider values are updated.
     */
    @Test
    public void testChildSlidersPropertiesLinked() {
        
        // fuzzy test
        for(int i = 0; i < 10; i++) {

            double min = -5.0 * Math.random();
            double max = 5.0 * Math.random() + 1.0;
            double resolution = Math.random();
            int height = 40 + (int)(Math.random() * 100);

            BSBVSliderBank bsbVSB = new BSBVSliderBank();
            BSBGroup root = new BSBGroup();
            UniqueNameManager unm = new UniqueNameManager();
            unm.setUniqueNameCollection(root);

            bsbVSB.setUniqueNameManager(unm);
            bsbVSB.setSliderHeight(height);
            bsbVSB.setNumberOfSliders(4);
            bsbVSB.setMinimum(min);
            bsbVSB.setMaximum(max);
            bsbVSB.setResolution(BigDecimal.valueOf(resolution));

            assertEquals(4, bsbVSB.getSliders().size());
            for(BSBVSlider slider : bsbVSB.getSliders()) {
                assertEquals(slider.getMaximum(), bsbVSB.getMaximum(), 0.001); 
                assertEquals(slider.getMaximum(), max, 0.001); 
                assertEquals(slider.getMinimum(), bsbVSB.getMinimum(), 0.001); 
                assertEquals(slider.getMinimum(), min, 0.001); 
                assertEquals(slider.getResolution(), bsbVSB.getResolution()); 
                assertEquals(slider.getSliderHeight(),  bsbVSB.getSliderHeight()); 
                assertEquals(slider.getSliderHeight(),  height); 
            }
        }

        // fuzzy test
        for(int i = 0; i < 10; i++) {

            double min = -5.0 * Math.random();
            double max = 5.0 * Math.random() + 1.0;
            double resolution = Math.random();
            int height = 40 + (int)(Math.random() * 100);

            BSBVSliderBank bsbVSB = new BSBVSliderBank();
            BSBGroup root = new BSBGroup();
            UniqueNameManager unm = new UniqueNameManager();
            unm.setUniqueNameCollection(root);

            bsbVSB.setUniqueNameManager(unm);
            bsbVSB.setNumberOfSliders(4);

            Element elem = bsbVSB.saveAsXML();
            bsbVSB = (BSBVSliderBank)BSBVSliderBank.loadFromXML(elem);
            bsbVSB.setUniqueNameManager(unm);

            bsbVSB.setSliderHeight(height);
            bsbVSB.setMinimum(min);
            bsbVSB.setMaximum(max);
            bsbVSB.setResolution(BigDecimal.valueOf(resolution));

            assertEquals(4, bsbVSB.getSliders().size());
            for(BSBVSlider slider : bsbVSB.getSliders()) {
                assertEquals(slider.getMaximum(), bsbVSB.getMaximum(), 0.001); 
                assertEquals(slider.getMaximum(), max, 0.001); 
                assertEquals(slider.getMinimum(), bsbVSB.getMinimum(), 0.001); 
                assertEquals(slider.getMinimum(), min, 0.001); 
                assertEquals(slider.getResolution(), bsbVSB.getResolution()); 
                assertEquals(slider.getSliderHeight(),  bsbVSB.getSliderHeight()); 
                assertEquals(slider.getSliderHeight(),  height); 
            }
        }

    } 
}
