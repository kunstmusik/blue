/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.orchestra.editor.blueSynthBuilder.jfx;

import blue.orchestra.blueSynthBuilder.BSBCheckBox;
import blue.orchestra.blueSynthBuilder.BSBDropdown;
import blue.orchestra.blueSynthBuilder.BSBEnvelopeGenerator;
import blue.orchestra.blueSynthBuilder.BSBFileSelector;
import blue.orchestra.blueSynthBuilder.BSBHSlider;
import blue.orchestra.blueSynthBuilder.BSBHSliderBank;
import blue.orchestra.blueSynthBuilder.BSBKnob;
import blue.orchestra.blueSynthBuilder.BSBLabel;
import blue.orchestra.blueSynthBuilder.BSBLineObject;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.BSBSubChannelDropdown;
import blue.orchestra.blueSynthBuilder.BSBTabbedPane;
import blue.orchestra.blueSynthBuilder.BSBTextField;
import blue.orchestra.blueSynthBuilder.BSBVSlider;
import blue.orchestra.blueSynthBuilder.BSBVSliderBank;
import blue.orchestra.blueSynthBuilder.BSBValue;
import blue.orchestra.blueSynthBuilder.BSBXYController;
import javafx.scene.layout.Region;

/**
 *
 * @author syi
 */
public class BSBObjectEditorFactory {

    public static Region getView(BSBObject bsbObject) {
        if (bsbObject instanceof BSBCheckBox) {
            return new BSBCheckBoxView((BSBCheckBox) bsbObject);
        } else if (bsbObject instanceof BSBDropdown) {
            return new BSBDropdownView((BSBDropdown) bsbObject);
        } else if (bsbObject instanceof BSBEnvelopeGenerator) {
//            return new BSBEnvelopeGenerator((BSBEnvelopeGenerator)bsbObject);
        } else if (bsbObject instanceof BSBFileSelector) {
            return new BSBFileSelectorView((BSBFileSelector)bsbObject);
        } else if (bsbObject instanceof BSBHSlider) {
            return new BSBHSliderView((BSBHSlider)bsbObject);
        } else if (bsbObject instanceof BSBHSliderBank) {
            return new BSBJfxDummy((BSBHSliderBank)bsbObject);
        } else if (bsbObject instanceof BSBKnob) {
            return new BSBKnobView((BSBKnob)bsbObject);
        } else if (bsbObject instanceof BSBLabel) {
            return new BSBLabelView((BSBLabel)bsbObject);
        } else if (bsbObject instanceof BSBLineObject) {
            return new BSBJfxDummy((BSBLineObject)bsbObject);
        } else if (bsbObject instanceof BSBSubChannelDropdown) {
            return new BSBSubChannelDropdownView((BSBSubChannelDropdown)bsbObject);
        } else if (bsbObject instanceof BSBTabbedPane) {
//            return new BSBTabbedPaneView((BSBTabbedPane)bsbObject);
        } else if (bsbObject instanceof BSBTextField) {
            return new BSBTextFieldView((BSBTextField)bsbObject);
        } else if (bsbObject instanceof BSBVSlider) {
            return new BSBVSliderView((BSBVSlider)bsbObject);
        } else if (bsbObject instanceof BSBVSliderBank) {
            return new BSBVSliderBankView((BSBVSliderBank)bsbObject);
        } else if (bsbObject instanceof BSBXYController) {
            return new BSBXYControllerView((BSBXYController)bsbObject);
        } else if (bsbObject instanceof BSBValue) {
            return new BSBValueView((BSBValue)bsbObject);
        }
        
        return null;
    }
}
