package blue.noteProcessor;

import blue.utility.ObjectUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.ArrayList;
import java.util.Iterator;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class NoteProcessorChain extends ArrayList implements Cloneable {

    public NoteProcessorChain() {
        super();
    }

    public void addNoteProcessor(NoteProcessor np) {
        super.add(np);
    }

    public NoteProcessor getNoteProcessor(int i) {
        return (NoteProcessor) super.get(i);
    }

    public Object clone() {
        return ObjectUtilities.clone(this);
    }

    public static NoteProcessorChain loadFromXML(Element data) throws Exception {
        NoteProcessorChain npc = new NoteProcessorChain();

        Elements nProcNodes = data.getElements("noteProcessor");

        while (nProcNodes.hasMoreElements()) {
            Element elem = nProcNodes.next();

            Object obj = ObjectUtilities.loadFromXML(elem);
            npc.add(obj);

        }

        return npc;
    }

    public Element saveAsXML() {
        Element retVal = new Element("noteProcessorChain");

        for (Iterator iter = this.iterator(); iter.hasNext();) {
            NoteProcessor np = (NoteProcessor) iter.next();
            retVal.addElement(np.saveAsXML());
        }

        return retVal;
    }
}