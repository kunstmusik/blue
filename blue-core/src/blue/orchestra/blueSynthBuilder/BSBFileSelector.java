/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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

//import blue.orchestra.editor.blueSynthBuilder.BSBFileSelectorView;
//import blue.orchestra.editor.blueSynthBuilder.BSBObjectView;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

/**
 * @author steven
 * 
 */
public class BSBFileSelector extends BSBObject implements StringChannelProvider {

    StringProperty fileName;
    IntegerProperty textFieldWidth; 
    BooleanProperty stringChannelEnabled;
    
    private StringChannel stringChannel;
    
    public BSBFileSelector() {
        fileName = new SimpleStringProperty("");
        textFieldWidth = new SimpleIntegerProperty(100);
        stringChannelEnabled = new SimpleBooleanProperty(true);

        fileName.addListener((obs, oldVal, newVal) -> {
            fireStringChannelChange(oldVal, newVal);
        });

        stringChannel = new StringChannel();
        addPropertyChangeListener(stringChannel);
    }

    public void fireStringChannelChange(String oldFileName, String newFileName) {
        if(this.propListeners != null) {
            this.propListeners.firePropertyChange("stringChannelValue", oldFileName, newFileName);
        }
    }

    public final void setFileName(String value) {
        fileName.set(value);
    }

    public final String getFileName() {
        return fileName.get();
    }

    public final StringProperty fileNameProperty() {
        return fileName;
    }

    public final void setTextFieldWidth(int value) {
        textFieldWidth.set(value);
    }

    public final int getTextFieldWidth() {
        return textFieldWidth.get();
    }

    public final IntegerProperty textFieldWidthProperty() {
        return textFieldWidth;
    }

    public final void setStringChannelEnabled(boolean value) {
        stringChannelEnabled.set(value);
    }

    public final boolean isStringChannelEnabled() {
        return stringChannelEnabled.get();
    }

    public final BooleanProperty stringChannelEnabledProperty() {
        return stringChannelEnabled;
    }

    

    public static BSBObject loadFromXML(Element data) {
        BSBFileSelector selector = new BSBFileSelector();
        initBasicFromXML(data, selector);

        Elements nodes = data.getElements();
        
        // false by default for legacy projects
        boolean stringChannelEnabled = false; 

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            switch (node.getName()) {
                case "fileName":
                    selector.setFileName(node.getTextString());
                    break;
                case "textFieldWidth":
                    selector.setTextFieldWidth(Integer.parseInt(node
                            .getTextString()));
                    break;
                case "stringChannelEnabled": 
                    stringChannelEnabled = XMLUtilities.readBoolean(node);
                    break;
            }

        }
        
        selector.setStringChannelEnabled(stringChannelEnabled);

        return selector;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement("fileName").setText(getFileName());

        retVal.addElement("textFieldWidth").setText(
                Integer.toString(getTextFieldWidth()));
        
        retVal.addElement(XMLUtilities.writeBoolean("stringChannelEnabled", isStringChannelEnabled()));

        return retVal;
    }

    @Override
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        String fileNameValue = getFileName().replace('\\', '/');
        
        // FIXME - need to figure out removing of prop change listeners when 
        // render is complete, yet all multiple string channels
        if(isStringChannelEnabled()) {
           
            stringChannel.setValue(fileNameValue);
            stringChannel.setChannelName(stringChannel.getChannelName());
            
            compilationUnit.addReplacementValue(objectName, stringChannel.getChannelName());
        } else {
            compilationUnit.addReplacementValue(objectName, fileNameValue);
        }
        
    }
    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    @Override
    public String getPresetValue() {
        return getFileName();
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    @Override
    public void setPresetValue(String val) {
        setFileName(val);
    }

    @Override
    public StringChannel getStringChannel() {
        return stringChannel;
    }
    
    @Override
    public Object clone() {
        BSBFileSelector clone = (BSBFileSelector) super.clone();
        clone.stringChannel = new StringChannel();
        clone.addPropertyChangeListener(clone.stringChannel);
        return clone;
    }
}