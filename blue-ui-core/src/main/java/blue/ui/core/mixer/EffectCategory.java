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

package blue.ui.core.mixer;

import blue.mixer.*;

import blue.utility.ListUtil;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.ArrayList;
import java.util.Iterator;

/**
 * @author Steven Yi
 * 
 * InstrumentCategory holds instruments and other InstrumentCategories
 */
public class EffectCategory {

    private String categoryName = "New Effect Category";

    private ArrayList<EffectCategory> subCategories = new ArrayList<>();

    private ArrayList<Effect> effects = new ArrayList<>();

    private boolean isRoot = false;

    public EffectCategory(){
    }        

    public EffectCategory(EffectCategory ec){
        categoryName = ec.categoryName;
        isRoot = ec.isRoot;
        for(EffectCategory ecat :ec.subCategories) {
            subCategories.add(new EffectCategory(ecat));
        }
        for(Effect effect :ec.effects) {
            effects.add(new Effect(effect));
        }
    }        

    @Override
    public String toString() {
        return this.getCategoryName();
    }

    public boolean removeEffect(Effect effect) {
        int index = ListUtil.indexOfByRef(effects, effect);

        if (index >= 0) {
            effects.remove(index);
            return true;
        }

        for (Iterator iter = subCategories.iterator(); iter.hasNext();) {
            EffectCategory category = (EffectCategory) iter.next();
            if (category.removeEffect(effect)) {
                return true;
            }

        }

        return false;
    }

    public boolean removeEffectCategory(EffectCategory category) {
        int index = ListUtil.indexOfByRef(subCategories, category);

        if (index >= 0) {
            subCategories.remove(index);
            return true;
        }

        for (Iterator iter = subCategories.iterator(); iter.hasNext();) {
            EffectCategory tempCategory = (EffectCategory) iter.next();

            if (tempCategory.removeEffectCategory(category)) {
                return true;
            }
        }

        return false;
    }

    public void addEffectCategory(EffectCategory category) {
        subCategories.add(category);
    }

    public void addEffect(int index, Effect effect) {
        effects.add(index, effect);
    }

    public void addEffect(Effect effect) {
        effects.add(effect);
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
    public ArrayList getEffects() {
        return effects;
    }

    /**
     * @param instruments
     *            The instruments to set.
     */
    public void setEffects(ArrayList instruments) {
        this.effects = instruments;
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

    public static EffectCategory loadFromXML(Element data) throws Exception {
        EffectCategory instrCat = new EffectCategory();

        instrCat.setCategoryName(data.getAttributeValue("categoryName"));
        instrCat.setRoot(Boolean.valueOf(data.getAttributeValue("isRoot"))
                .booleanValue());

        Elements subCatNodes = data.getElements("effectCategory");

        while (subCatNodes.hasMoreElements()) {
            instrCat.addEffectCategory(EffectCategory.loadFromXML(subCatNodes
                    .next()));
        }

        Elements effects = data.getElements("effect");

        while (effects.hasMoreElements()) {
            instrCat.addEffect(Effect.loadFromXML(effects.next()));
        }

        return instrCat;
    }

    public Element saveAsXML() {
        Element retVal = new Element("effectCategory");

        retVal.setAttribute("categoryName", this.getCategoryName());
        retVal.setAttribute("isRoot", Boolean.toString(this.isRoot()));

        for (Iterator iter = subCategories.iterator(); iter.hasNext();) {
            EffectCategory tempCat = (EffectCategory) iter.next();
            retVal.addElement(tempCat.saveAsXML());
        }

        for (Iterator iter = effects.iterator(); iter.hasNext();) {
            Effect effect = (Effect) iter.next();
            retVal.addElement(effect.saveAsXML());
        }

        return retVal;
    }

}