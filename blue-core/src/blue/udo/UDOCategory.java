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

package blue.udo;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;

import blue.utility.ListUtil;
import electric.xml.Element;
import electric.xml.Elements;

/**
 * @author Steven Yi
 * 
 * UDOCategory holds UserDefinedOpcodes and other UDOCategories
 */
public class UDOCategory implements Serializable {

    private String categoryName = "New UDO Category";

    private ArrayList subCategories = new ArrayList();

    private ArrayList udos = new ArrayList();

    private boolean isRoot = false;

    public String toString() {
        return this.getCategoryName();
    }

    public boolean removeUDO(UserDefinedOpcode udo) {

        int index = ListUtil.indexOfByRef(udos, udo);

        if (index >= 0) {
            udos.remove(index);
            return true;
        }

        for (Iterator iter = subCategories.iterator(); iter.hasNext();) {
            UDOCategory category = (UDOCategory) iter.next();
            if (category.removeUDO(udo)) {
                return true;
            }

        }

        return false;
    }

    public boolean removeUDOCategory(UDOCategory category) {
        int index = ListUtil.indexOfByRef(subCategories, category);

        if (index >= 0) {
            subCategories.remove(index);
            return true;
        }

        for (Iterator iter = subCategories.iterator(); iter.hasNext();) {
            UDOCategory tempCategory = (UDOCategory) iter.next();

            if (tempCategory.removeUDOCategory(category)) {
                return true;
            }
        }

        return false;
    }

    public void addUDOCategory(UDOCategory category) {
        subCategories.add(category);
    }

    public void addUDO(int insertIndex, UserDefinedOpcode udo) {
        udos.add(insertIndex, udo);
    }

    public void addUDO(UserDefinedOpcode udo) {
        udos.add(udo);
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
    public ArrayList getUserDefinedOpcodes() {
        return udos;
    }

    /**
     * @param instruments
     *            The instruments to set.
     */
    public void setUserDefinedOpcodes(ArrayList instruments) {
        this.udos = instruments;
    }

    /**
     * @return Returns the subCategories.
     */
    public ArrayList getSubCategories() {
        return subCategories;
    }

    /**
     * @param subCategories
     *            The subCategories to set.
     */
    public void setSubCategories(ArrayList subCategories) {
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

    public static UDOCategory loadFromXML(Element data) throws Exception {
        UDOCategory udoCat = new UDOCategory();

        udoCat.setCategoryName(data.getAttributeValue("categoryName"));
        udoCat.setRoot(Boolean.valueOf(data.getAttributeValue("isRoot"))
                .booleanValue());

        Elements subCatNodes = data.getElements("udoCategory");

        while (subCatNodes.hasMoreElements()) {
            udoCat.addUDOCategory(UDOCategory.loadFromXML(subCatNodes.next()));
        }

        Elements udoNodes = data.getElements("udo");

        while (udoNodes.hasMoreElements()) {
            udoCat.addUDO(UserDefinedOpcode.loadFromXML(udoNodes.next()));
        }

        return udoCat;
    }

    public Element saveAsXML() {
        Element retVal = new Element("udoCategory");

        retVal.setAttribute("categoryName", this.getCategoryName());
        retVal.setAttribute("isRoot", Boolean.toString(this.isRoot()));

        for (Iterator iter = subCategories.iterator(); iter.hasNext();) {
            UDOCategory tempCat = (UDOCategory) iter.next();
            retVal.addElement(tempCat.saveAsXML());
        }

        for (Iterator iter = udos.iterator(); iter.hasNext();) {
            UserDefinedOpcode udo = (UserDefinedOpcode) iter.next();
            retVal.addElement(udo.saveAsXML());
        }

        return retVal;
    }

}