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

/**
 * @author steven
 * 
 */
public class BSBFileSelector extends BSBObject implements StringChannelProvider {
    String fileName = "";

    int textFieldWidth = 100;
    
    boolean stringChannelEnabled = true;
    
    private StringChannel stringChannel;
    
    public BSBFileSelector() {
        stringChannel = new StringChannel();
        addPropertyChangeListener(stringChannel);
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

    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement("fileName").setText(fileName);

        retVal.addElement("textFieldWidth").setText(
                Integer.toString(textFieldWidth));
        
        retVal.addElement(XMLUtilities.writeBoolean("stringChannelEnabled", stringChannelEnabled));

        return retVal;
    }

//    public BSBObjectView getBSBObjectView() {
//        return new BSBFileSelectorView(this);
//    }

    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        String fileNameValue = fileName.replace('\\', '/');
        
        // FIXME - need to figure out removing of prop change listeners when 
        // render is complete, yet all multiple string channels
        if(stringChannelEnabled) {
           
            stringChannel.setValue(fileNameValue);
            stringChannel.setChannelName(stringChannel.getChannelName());
            
            compilationUnit.addReplacementValue(objectName, stringChannel.getChannelName());
        } else {
            compilationUnit.addReplacementValue(objectName, fileNameValue);
        }
        
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        String oldFileName = this.fileName;
        this.fileName = (fileName == null) ? "" : fileName;

        if(this.propListeners != null) {
            this.propListeners.firePropertyChange("stringChannelValue", oldFileName, fileName);
        }
    }

    /**
     * @return Returns the textFieldWidth.
     */
    public int getTextFieldWidth() {
        return textFieldWidth;
    }

    /**
     * @param textFieldWidth
     *            The textFieldWidth to set.
     */
    public void setTextFieldWidth(int textFieldWidth) {
        this.textFieldWidth = textFieldWidth;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    public String getPresetValue() {
        return fileName;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    public void setPresetValue(String val) {
        setFileName(val);
    }

    public boolean isStringChannelEnabled() {
        return stringChannelEnabled;
    }

    public void setStringChannelEnabled(boolean stringChannelEnabled) {
        this.stringChannelEnabled = stringChannelEnabled;
    }

    @Override
    public StringChannel getStringChannel() {
        return stringChannel;
    }
    
    
}