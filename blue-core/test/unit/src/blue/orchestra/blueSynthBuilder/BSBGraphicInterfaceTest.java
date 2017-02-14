/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.orchestra.blueSynthBuilder;

import junit.framework.TestCase;

public class BSBGraphicInterfaceTest extends TestCase {

    // TODO - should probably split this into multiple tests...
    public void testUniqueNames() {
        BSBGraphicInterface bsbInterface = new BSBGraphicInterface();
        BSBGroup bsbGroup = bsbInterface.getRootGroup();

        BSBObjectEntry[] bsbObjects = BSBObjectRegistry.getBSBObjects();

        for (int i = 0; i < bsbObjects.length; i++) {
            BSBObjectEntry entry = bsbObjects[i];

            Class class1 = entry.bsbObjectClass;

            BSBObject bsbObj = null;

            try {
                bsbObj = (BSBObject) class1.newInstance();
            } catch (    InstantiationException | IllegalAccessException e) {
                e.printStackTrace();
            }

            assertNotNull(bsbObj);

            if (bsbObj == null) {
                continue;
            }

            bsbGroup.addBSBObject(bsbObj);
            bsbObj.setObjectName("test");

            if (i == 0 || bsbObj instanceof BSBHSliderBank
                    || bsbObj instanceof BSBXYController) {
                if (!bsbObj.getObjectName().equals("test")) {
                    System.err.println(bsbObj);
                }
                assertEquals("test", bsbObj.getObjectName());
            } else {
                assertEquals("", bsbObj.getObjectName());
            }
        }

        BSBKnob knob = new BSBKnob();
        knob.setObjectName("testNameX");

        bsbGroup.addBSBObject(knob);

        BSBXYController xyController = new BSBXYController();
        bsbGroup.addBSBObject(xyController);
        xyController.setObjectName("testName");

        assertEquals("", xyController.getObjectName());

        assertEquals(5, bsbGroup.getNames().size());

        // testing clash of name when setting new number of sliders in
        // slider bank
        BSBHSlider hslider = new BSBHSlider();
        hslider.setObjectName("hslider_3");

        bsbGroup.addBSBObject(hslider);

        BSBHSliderBank hsliderBank = new BSBHSliderBank();
        bsbGroup.addBSBObject(hsliderBank);
        hsliderBank.setObjectName("hslider");

        assertEquals("hslider", hsliderBank.getObjectName());

        hsliderBank.setNumberOfSliders(3);

        assertEquals(3, hsliderBank.getNumberOfSliders());

        hsliderBank.setNumberOfSliders(4);

        // should be prevented from new number due to name clash
        assertEquals(3, hsliderBank.getNumberOfSliders());

        hslider.setObjectName("hslider");

        // should allow, as replacement keys won't clash with slider banks
        assertEquals("hslider", hslider.getObjectName());

        hsliderBank.setObjectName("hslider_temp");
        hsliderBank.setObjectName("hslider");

        // should allow, as replacement keys won't clash with slider banks
        assertEquals("hslider", hsliderBank.getObjectName());

        // testing clash of name when setting new number of sliders in
        // slider bank
        BSBVSlider vslider = new BSBVSlider();
        vslider.setObjectName("vslider_3");

        bsbGroup.addBSBObject(vslider);

        BSBVSliderBank vsliderBank = new BSBVSliderBank();
        bsbGroup.addBSBObject(vsliderBank);
        vsliderBank.setObjectName("vslider");

        assertEquals("vslider", vsliderBank.getObjectName());

        vsliderBank.setNumberOfSliders(3);

        assertEquals(3, vsliderBank.getNumberOfSliders());

        vsliderBank.setNumberOfSliders(4);

        // should be prevented from new number due to name clash
        assertEquals(3, vsliderBank.getNumberOfSliders());

        vslider.setObjectName("vslider");

        // should allow, as replacement keys won't clash with slider banks
        assertEquals("vslider", vslider.getObjectName());

        vsliderBank.setObjectName("vslider_temp");
        vsliderBank.setObjectName("vslider");

        // should allow, as replacement keys won't clash with slider banks
        assertEquals("vslider", vsliderBank.getObjectName());
    }
}
