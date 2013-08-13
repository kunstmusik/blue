/*
 * blue - object composition environment for csound Copyright (c) 2000-2003
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

package blue.orchestra;

import blue.utility.ListUtil;
import blue.utility.ObjectUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Vector;

/**
 * @author Steven Yi
 * 
 * InstrumentCategory holds instruments and other InstrumentCategories
 */
public class InstrumentCategory implements Serializable {

    private String categoryName = "New Instrument Category";

    private List<InstrumentCategory> subCategories = new Vector<InstrumentCategory>();

    private List<Instrument> instruments = new Vector<Instrument>();

    private boolean isRoot = false;

    @Override
    public String toString() {
        return this.getCategoryName();
    }

    public boolean removeInstrument(Instrument instr) {
        int index = ListUtil.indexOfByRef(instruments, instr);

        if (index >= 0) {
            instruments.remove(index);
            return true;
        }

        for (Iterator iter = subCategories.iterator(); iter.hasNext();) {
            InstrumentCategory category = (InstrumentCategory) iter.next();
            if (category.removeInstrument(instr)) {
                return true;
            }

        }

        return false;
    }

    public boolean removeInstrumentCategory(InstrumentCategory category) {
        int index = ListUtil.indexOfByRef(subCategories, category);

        if (index >= 0) {
            subCategories.remove(index);
            return true;
        }

        for (Iterator iter = subCategories.iterator(); iter.hasNext();) {
            InstrumentCategory tempCategory = (InstrumentCategory) iter.next();

            if (tempCategory.removeInstrumentCategory(category)) {
                return true;
            }
        }

        return false;
    }

    public void addInstrumentCategory(InstrumentCategory category) {
        subCategories.add(category);
    }

    public void addInstrument(int insertIndex, Instrument instrument) {
        instruments.add(insertIndex, instrument);
    }

    public void addInstrument(Instrument instrument) {
        instruments.add(instrument);
    }

    // ACCESSOR METHODS

    /**
     * @return Returns the categoryName.
     */
    public String getCategoryName() {
        return categoryName;
    }

    /**
     * @param categoryName
     *            The categoryName to set.
     */
    public void setCategoryName(String categoryName) {
        this.categoryName = categoryName;
    }

    /**
     * @return Returns the instruments.
     */
    public List getInstruments() {
        return instruments;
    }

    /**
     * @param instruments
     *            The instruments to set.
     */
    public void setInstruments(ArrayList<Instrument> instruments) {
        this.instruments = instruments;
    }

    /**
     * @return Returns the subCategories.
     */
    public List getSubCategories() {
        return subCategories;
    }

    /**
     * @param subCategories
     *            The subCategories to set.
     */
    public void setSubCategories(ArrayList<InstrumentCategory> subCategories) {
        this.subCategories = subCategories;
    }

    /**
     * @return Returns the isRoot.
     */
    public boolean isRoot() {
        return isRoot;
    }

    /**
     * @param isRoot
     *            The isRoot to set.
     */
    public void setRoot(boolean isRoot) {
        this.isRoot = isRoot;
    }

    public static InstrumentCategory loadFromXML(Element data) throws Exception {
        InstrumentCategory instrCat = new InstrumentCategory();

        instrCat.setCategoryName(data.getAttributeValue("categoryName"));
        instrCat.setRoot(Boolean.valueOf(data.getAttributeValue("isRoot"))
                .booleanValue());

        Elements subCatNodes = data.getElements("instrumentCategory");

        while (subCatNodes.hasMoreElements()) {
            instrCat.addInstrumentCategory(InstrumentCategory
                    .loadFromXML(subCatNodes.next()));
        }

        Elements instruments = data.getElements("instrument");

        while (instruments.hasMoreElements()) {
            instrCat.addInstrument((Instrument) ObjectUtilities
                    .loadFromXML(instruments.next()));
        }

        return instrCat;
    }

    public Element saveAsXML() {
        Element retVal = new Element("instrumentCategory");

        retVal.setAttribute("categoryName", this.getCategoryName());
        retVal.setAttribute("isRoot", Boolean.toString(this.isRoot()));

        for (Iterator iter = subCategories.iterator(); iter.hasNext();) {
            InstrumentCategory tempCat = (InstrumentCategory) iter.next();
            retVal.addElement(tempCat.saveAsXML());
        }

        for (Iterator iter = instruments.iterator(); iter.hasNext();) {
            Instrument instr = (Instrument) iter.next();
            retVal.addElement(instr.saveAsXML());
        }

        return retVal;
    }

    /**
     * Creates a colon delimited string to locate an instrument
     * 
     * @param instr
     * @return
     */
    public String getInstrumentId(Instrument instr) {

        if (ListUtil.containsByRef(instruments, instr)) {
            return Integer.toString(ListUtil.indexOfByRef(instruments, instr));
        }

        // if (instruments.contains(instr)) {
        // return Integer.toString(instruments.indexOf(instr));
        // }

        int counter = 0;

        for (Iterator iter = subCategories.iterator(); iter.hasNext();) {
            InstrumentCategory cat = (InstrumentCategory) iter.next();
            String instrId = cat.getInstrumentId(instr);

            if (instrId != null) {
                return counter + ":" + instrId;
            }
            counter++;
        }

        return null;
    }

    public Instrument getInstrumentById(int[] idArray, int index) {
        if (index == idArray.length - 1) {
            return instruments.get(idArray[index]);
        }

        InstrumentCategory cat = subCategories.get(idArray[index]);
        return cat.getInstrumentById(idArray, index + 1);
    }
}