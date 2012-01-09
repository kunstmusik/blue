/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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

package blue;

import blue.orchestra.Instrument;
import blue.utility.ObjectUtilities;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Set;
import java.util.TreeMap;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public final class Orchestra implements Cloneable, Serializable {
    TreeMap orch = new TreeMap();

    // private transient final EventListenerList = changeListeners;

    // used when compiling instruments only once for soundObjects
    private transient ArrayList classList = null;

    // refactored out to GlobalOrcSco, left in for compatibilty (ver 0.89.5)
    String globals;

    public Orchestra() {
    }

    /** ****************************************** */
    // should be left in temporarily and deprecated over time
    // should be moved to BlueData or to a Global class
    /** ****************************************** */

    /*
     * public String getGlobals() { return globals; }
     * 
     * public void setGlobals(String globals) { this.globals = globals; }
     */

    /** ****************************************** */

    public TreeMap getOrchestra() {
        return orch;
    }

    /**
     * Used for Instrument Conditionals Probably will be removed in change to
     * using InstrumentLibrary/Arangement
     */
    public ArrayList getEnabledInstrumentNumbers() {
        ArrayList instrumentNumbers = new ArrayList();

        for (Iterator iter = orch.keySet().iterator(); iter.hasNext();) {
            Integer iNum = (Integer) iter.next();
            Instrument instrument = (Instrument) orch.get(iNum);

            if (instrument.isEnabled()) {
                instrumentNumbers.add(iNum);
            }

        }

        return instrumentNumbers;

    }

    /*
     * public void setOrchestra(TreeMap orch) { orch = orch; }
     */

    /** ****************************************** */

    public int addInstrument(Instrument inst) {
        return addInstrument(inst, 0);
    }

    public int addInstrument(Instrument inst, int currentInstrumentNum) {
        int counter = currentInstrumentNum + 1;

        while (orch.containsKey(new Integer(counter))) {
            counter++;
        }

        Integer newIndex = new Integer(counter);
        orch.put(newIndex, inst);
        return counter;
    }

    public void removeInstrument(Integer iNum) {
        orch.remove(iNum);
    }

    public String generateOrchestra() {
        StringBuffer orchText = new StringBuffer();
        Set temp = orch.keySet();
        Iterator iter = temp.iterator();

        while (iter.hasNext()) {
            Integer iNum = (Integer) (iter.next());
            Instrument instr = (Instrument) (orch.get(iNum));
            if (instr.isEnabled()) {
                orchText.append("\tinstr ").append(iNum.intValue()).append(
                        "\t;").append(instr.getName()).append("\n");
                orchText.append(instr.generateInstrument()).append("\n");
                orchText.append("\tendin\n\n");
            }
        }
        return orchText.toString();
    }

    public void generateFTables(Tables tables) {
        Iterator iter = orch.values().iterator();

        while (iter.hasNext()) {
            Instrument instr = (Instrument) iter.next();
            if (instr.isEnabled()) {
                instr.generateFTables(tables);
            }
        }
    }

    public Object clone() {
        return ObjectUtilities.clone(this);
    }

    /** ************************************************************************** */
    /**
     * Prepares data for compilation (classList, ftableNumberSet). Must be
     * called before CSD generation.
     */
    private void prepareForCompilation() {
        if (classList == null) {
            classList = new ArrayList();
        }
    }

    /**
     * Called when instruments or soundObjects are generating FTables. Pass in
     * the Class of the object, returns true or false. If false, adds the Class
     * to the list
     */
    public boolean haveStaticInstrumentsBeenGenerated(
            Class instrumentGeneratingClass) {
        prepareForCompilation();
        Class temp;
        for (int i = 0; i < classList.size(); i++) {
            temp = (Class) classList.get(i);
            if (temp.equals(instrumentGeneratingClass)) {
                return true;
            }
        }
        classList.add(instrumentGeneratingClass);
        return false;
    }

}