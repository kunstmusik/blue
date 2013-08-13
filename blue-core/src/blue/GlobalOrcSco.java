package blue;

import blue.utility.ObjectUtilities;
import electric.xml.Element;
import java.util.HashMap;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class GlobalOrcSco implements java.io.Serializable {
    String globalOrc = "";

    String globalSco = "";

    private transient HashMap compilationVariables;

    public GlobalOrcSco() {
    }

    public String getGlobalOrc() {
        return globalOrc;
    }

    public void setGlobalOrc(String globalOrc) {
        this.globalOrc = globalOrc == null ? "" : globalOrc;
    }

    public void setGlobalSco(String globalSco) {
        this.globalSco = globalSco == null ? "" : globalSco;
    }

    public String getGlobalSco() {
        return globalSco;
    }

    @Override
    public Object clone() {
        return ObjectUtilities.clone(this);
    }

    public void appendGlobalOrc(String string) {
        this.globalOrc = this.globalOrc + "\n" + string;
    }

    public void appendGlobalSco(String string) {
        this.globalSco = this.globalSco + "\n" + string;
    }

    public static GlobalOrcSco loadFromXML(Element data) {
        GlobalOrcSco globalOrcSco = new GlobalOrcSco();

        globalOrcSco.setGlobalOrc(data.getTextString("globalOrc"));
        globalOrcSco.setGlobalSco(data.getTextString("globalSco"));

        return globalOrcSco;
    }

    /**
     * @return
     */
    public Element saveAsXML() {
        Element retVal = new Element("globalOrcSco");

        retVal.addElement("globalOrc").setText(globalOrc);
        retVal.addElement("globalSco").setText(globalSco);

        return retVal;
    }

    /**
     * Gets compilation variable; should only be called by plugins when
     * compiling a CSD is happening. Plugins can check variables that are set,
     * useful for caching ID's, instruments, etc.
     */

    public Object getCompilationVariable(Object key) {
        if (compilationVariables == null) {
            compilationVariables = new HashMap();
            return null;
        }

        return compilationVariables.get(key);
    }

    /**
     * Sets compilation variable; should only be called by plugins when
     * compiling a CSD is happening. Plugins can set variables, useful for
     * caching ID's, instruments, etc.
     */

    public void setCompilationVariable(Object key, Object value) {
        if (compilationVariables == null) {
            compilationVariables = new HashMap();
        }

        compilationVariables.put(key, value);
    }

}