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
package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.orchestra.blueSynthBuilder.BSBCheckBox;
import blue.orchestra.blueSynthBuilder.BSBDropdown;
import blue.orchestra.blueSynthBuilder.BSBFileSelector;
import blue.orchestra.blueSynthBuilder.BSBGroup;
import blue.orchestra.blueSynthBuilder.BSBHSlider;
import blue.orchestra.blueSynthBuilder.BSBHSliderBank;
import blue.orchestra.blueSynthBuilder.BSBKnob;
import blue.orchestra.blueSynthBuilder.BSBLabel;
import blue.orchestra.blueSynthBuilder.BSBLineObject;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.BSBSubChannelDropdown;
//import blue.orchestra.blueSynthBuilder.BSBTabbedPane;
import blue.orchestra.blueSynthBuilder.BSBTextField;
import blue.orchestra.blueSynthBuilder.BSBVSlider;
import blue.orchestra.blueSynthBuilder.BSBVSliderBank;
import blue.orchestra.blueSynthBuilder.BSBValue;
import blue.orchestra.blueSynthBuilder.BSBXYController;
import org.openide.util.Exceptions;

/**
 *
 * @author syi
 */
public class BSBObjectEditorFactory {

//    private static final HashMap<Class<? extends BSBObject>, Class<? extends BSBObjectView>> map;
//
//
//
//    static {
//
//        map = new HashMap<Class<? extends BSBObject>, Class<? extends BSBObjectView>>();
//
//        map.put(BSBCheckBox.class, BSBCheckBoxView.class);
//        map.put(BSBDropdown.class, BSBDropdownView.class);
//        map.put(BSBEnvelopeGenerator.class, BSBEnvelopeGeneratorView.class);
//        map.put(BSBFileSelector.class, BSBFileSelectorView.class);
//        map.put(BSBHSlider.class, BSBHSliderView.class);
//        map.put(BSBHSliderBank.class, BSBHSliderBankView.class);
//        map.put(BSBKnob.class, BSBKnobView.class);
//        map.put(BSBLabel.class, BSBLabelView.class);
//        map.put(BSBLineObject.class, BSBLineObjectView.class);
//        map.put(BSBSubChannelDropdown.class, BSBSubChannelDropdownView.class);
//        map.put(BSBTabbedPane.class, BSBTabbedPaneView.class);
//        map.put(BSBTextField.class, BSBTextFieldView.class);
//        map.put(BSBVSlider.class, BSBVSliderView.class);
//        map.put(BSBVSliderBank.class, BSBVSliderBankView.class);
//        map.put(BSBXYController.class, BSBXYControllerView.class);
//    }

    public static BSBObjectView getView(BSBObject bsbObject) {
        if (bsbObject instanceof BSBGroup bSBGroup) {
            return new BSBGroupPanel(bSBGroup);
        } else if (bsbObject instanceof BSBCheckBox bSBCheckBox) {
            return new BSBCheckBoxView(bSBCheckBox);
        } else if (bsbObject instanceof BSBDropdown bSBDropdown) {
            return new BSBDropdownView(bSBDropdown);
//        } else if (bsbObject instanceof BSBEnvelopeGenerator) {
//            return new BSBEnvelopeGenerator((BSBEnvelopeGenerator)bsbObject);
        } else if (bsbObject instanceof BSBFileSelector bSBFileSelector) {
            return new BSBFileSelectorView(bSBFileSelector);
        } else if (bsbObject instanceof BSBHSlider bSBHSlider) {
            return new BSBHSliderView(bSBHSlider);
        } else if (bsbObject instanceof BSBHSliderBank bSBHSliderBank) {
            return new BSBHSliderBankView(bSBHSliderBank);
        } else if (bsbObject instanceof BSBKnob bSBKnob) {
            return new BSBKnobView(bSBKnob);
        } else if (bsbObject instanceof BSBLabel bSBLabel) {
            return new BSBLabelView(bSBLabel);
        } else if (bsbObject instanceof BSBLineObject bSBLineObject) {
            return new BSBLineObjectView(bSBLineObject);
        } else if (bsbObject instanceof BSBSubChannelDropdown bSBSubChannelDropdown) {
            return new BSBSubChannelDropdownView(bSBSubChannelDropdown);
//        } else if (bsbObject instanceof BSBTabbedPane) {
//            return new BSBTabbedPaneView((BSBTabbedPane)bsbObject);
        } else if (bsbObject instanceof BSBTextField bSBTextField) {
            return new BSBTextFieldView(bSBTextField);
        } else if (bsbObject instanceof BSBVSlider bSBVSlider) {
            return new BSBVSliderView(bSBVSlider);
        } else if (bsbObject instanceof BSBVSliderBank bSBVSliderBank) {
            return new BSBVSliderBankView(bSBVSliderBank);
        } else if (bsbObject instanceof BSBXYController bSBXYController) {
            return new BSBXYControllerView(bSBXYController);
        } else if (bsbObject instanceof BSBValue bSBValue) {
            return new BSBValueView(bSBValue);
        } else {
            Exceptions.printStackTrace(new Exception("Unknown BSBObject: " + bsbObject.getClass()));
        }
        
        return null;
    }
}
