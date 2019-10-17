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
public class BSBHSliderBankTest {
    
    public BSBHSliderBankTest() {
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
            int width = 40 + (int)(Math.random() * 100);

            BSBHSliderBank bsbHSB = new BSBHSliderBank();
            BSBGroup root = new BSBGroup();
            UniqueNameManager unm = new UniqueNameManager();
            unm.setUniqueNameCollection(root);

            bsbHSB.setUniqueNameManager(unm);
            bsbHSB.setSliderWidth(width);
            bsbHSB.setNumberOfSliders(4);
            bsbHSB.setMinimum(min);
            bsbHSB.setMaximum(max);
            bsbHSB.setResolution(BigDecimal.valueOf(resolution));

            assertEquals(4, bsbHSB.getSliders().size());
            for(BSBHSlider slider : bsbHSB.getSliders()) {
                assertEquals(slider.getMaximum(), bsbHSB.getMaximum(), 0.001); 
                assertEquals(slider.getMaximum(), max, 0.001); 
                assertEquals(slider.getMinimum(), bsbHSB.getMinimum(), 0.001); 
                assertEquals(slider.getMinimum(), min, 0.001); 
                assertEquals(slider.getResolution(), bsbHSB.getResolution()); 
                assertEquals(slider.getSliderWidth(),  bsbHSB.getSliderWidth()); 
                assertEquals(slider.getSliderWidth(),  width); 
            }
        }

        // fuzzy test
        for(int i = 0; i < 10; i++) {

            double min = -5.0 * Math.random();
            double max = 5.0 * Math.random() + 1.0;
            double resolution = Math.random();
            int width = 40 + (int)(Math.random() * 100);

            BSBHSliderBank bsbHSB = new BSBHSliderBank();
            BSBGroup root = new BSBGroup();
            UniqueNameManager unm = new UniqueNameManager();
            unm.setUniqueNameCollection(root);

            bsbHSB.setUniqueNameManager(unm);
            bsbHSB.setNumberOfSliders(4);

            Element elem = bsbHSB.saveAsXML();
            bsbHSB = (BSBHSliderBank)BSBHSliderBank.loadFromXML(elem);
            bsbHSB.setUniqueNameManager(unm);

            bsbHSB.setSliderWidth(width);
            bsbHSB.setMinimum(min);
            bsbHSB.setMaximum(max);
            bsbHSB.setResolution(BigDecimal.valueOf(resolution));

            assertEquals(4, bsbHSB.getSliders().size());
            for(BSBHSlider slider : bsbHSB.getSliders()) {
                assertEquals(slider.getMaximum(), bsbHSB.getMaximum(), 0.001); 
                assertEquals(slider.getMaximum(), max, 0.001); 
                assertEquals(slider.getMinimum(), bsbHSB.getMinimum(), 0.001); 
                assertEquals(slider.getMinimum(), min, 0.001); 
                assertEquals(slider.getResolution(), bsbHSB.getResolution()); 
                assertEquals(slider.getSliderWidth(),  bsbHSB.getSliderWidth()); 
                assertEquals(slider.getSliderWidth(),  width); 
            }
        }

    } 
}
