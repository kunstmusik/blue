/*
 * blue - object composition environment for csound Copyright (c) 2000-2014
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

package blue.soundObject;

import blue.*;
import java.io.Serializable;
import java.util.HashMap;
import java.util.Iterator;

import blue.noteProcessor.NoteProcessorChain;
import blue.soundObject.ceciliaModule.CeciliaModuleCompilationUnit;
import blue.soundObject.ceciliaModule.CeciliaObject;
import blue.soundObject.ceciliaModule.ModuleDefinition;
//import blue.soundObject.renderer.BarRenderer;
//import blue.soundObject.renderer.LetterRenderer;
import blue.utility.ObjectUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.Map;

/**
 * @author steven
 * 
 */
public class CeciliaModule extends AbstractSoundObject implements Serializable {

    public static final int ORCHESTRA_MONO = 0;

    public static final int ORCHESTRA_STEREO = 1;

    public static final int ORCHESTRA_QUAD = 2;

//    private static BarRenderer renderer = new LetterRenderer("C");

    private int orchestraVersion;

    private String genSize;

    private ModuleDefinition moduleDefinition;

    private HashMap stateData;

    public CeciliaModule() {
        setName("CeciliaModule");

        stateData = new HashMap();
        moduleDefinition = new ModuleDefinition();
        orchestraVersion = ORCHESTRA_STEREO;
        genSize = "8192";
    }

    public float getObjectiveDuration() {
        return getSubjectiveDuration();
    }

    public NoteProcessorChain getNoteProcessorChain() {
        return null;
    }

    public void setNoteProcessorChain(NoteProcessorChain chain) {
    }

    public int getTimeBehavior() {
        return SoundObject.TIME_BEHAVIOR_NOT_SUPPORTED;
    }

    public float getRepeatPoint() {
        return -1.0f;
    }

    public void setRepeatPoint(float repeatPoint) {
    }

    public void setTimeBehavior(int timeBehavior) {
    }

    public static void main(String[] args) {
    }

    /**
     * @return
     */
    public ModuleDefinition getModuleDefinition() {
        return moduleDefinition;
    }

    /**
     * @param definition
     */
    public void setModuleDefinition(ModuleDefinition definition) {
        moduleDefinition = definition;
    }

    /**
     * @return
     */
    public HashMap getStateData() {
        return stateData;
    }

    /**
     * @param map
     */
    public void setStateData(HashMap map) {
        stateData = map;
    }

    /**
     * @return
     */
    public int getOrchestraVersion() {
        return orchestraVersion;
    }

    /**
     * @param i
     */
    public void setOrchestraVersion(int i) {
        orchestraVersion = i;
    }

    /**
     * @return
     */
    public String getGenSize() {
        return genSize;
    }

    /**
     * @param string
     */
    public void setGenSize(String string) {
        genSize = string;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public static SoundObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {

        CeciliaModule ceciliaModule = new CeciliaModule();

        SoundObjectUtilities.initBasicFromXML(data, ceciliaModule);

        ceciliaModule.setOrchestraVersion(Integer.parseInt(data
                .getTextString("orchestraVersion")));
        ceciliaModule.setGenSize(data.getTextString("genSize"));
        ceciliaModule.setModuleDefinition(ModuleDefinition.loadFromXML(data
                .getElement("moduleDefinition")));

        Elements stateNodes = data.getElements("ceciliaObject");

        while (stateNodes.hasMoreElements()) {
            Element elem = stateNodes.next();
            String key = elem.getAttributeValue("nameKey");

            CeciliaObject cObj = (CeciliaObject) ObjectUtilities
                    .loadFromXML(elem);

            ceciliaModule.stateData.put(key, cObj);
        }

        return ceciliaModule;

    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("orchestraVersion").setText(
                Integer.toString(this.getOrchestraVersion()));
        retVal.addElement("genSize").setText(this.getGenSize());

        retVal.addElement(moduleDefinition.saveAsXML());

        for (Iterator iter = stateData.keySet().iterator(); iter.hasNext();) {
            String key = (String) iter.next();

            CeciliaObject cObj = (CeciliaObject) stateData.get(key);
            Element elem = cObj.saveAsXML();
            elem.setAttribute("nameKey", key);

            retVal.addElement(elem);

        }

        return retVal;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime) {
        CeciliaModuleCompilationUnit compileUnit = new CeciliaModuleCompilationUnit(this);
        //FIXME - reimplement this when working on CecilaModule again
//        compileUnit.generateGlobals(globalOrcSco);
//        compileUnit.generateFTables(this, tables);
//        compileUnit.generateInstruments(arrangement);
        
//        NoteList nl;
//        try {
//            nl = compileUnit.generateNotes(this);
//        } catch (NoteParseException e) {
//            throw new SoundObjectException(this, e);
//        }

//        return nl;
        return null;
    }
    
}
