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

import electric.xml.Element;
import electric.xml.Elements;
import java.util.ArrayList;
import java.util.Iterator;
import org.apache.commons.lang3.builder.EqualsBuilder;

/**
 * @author steven
 */
public class PresetGroup implements Comparable<PresetGroup> {

    private String presetGroupName = "Presets";

    private ArrayList<PresetGroup> subGroups = new ArrayList<>();

    private ArrayList<Preset> presets = new ArrayList<>();

    private String currentPresetUniqueId = null;

    private boolean currentPresetModified = false;

    public PresetGroup() {
    }

    public PresetGroup(PresetGroup presetGroup) {
        presetGroupName = presetGroup.presetGroupName;
        currentPresetUniqueId = presetGroup.currentPresetUniqueId;
        currentPresetModified = presetGroup.currentPresetModified;

        for (PresetGroup group : presetGroup.subGroups) {
            subGroups.add(new PresetGroup(group));
        }

        for (Preset preset : presetGroup.presets) {
            presets.add(new Preset(preset));
        }
    }

    public String getPresetGroupName() {
        return presetGroupName;
    }

    public void setPresetGroupName(String presetGroupName) {
        this.presetGroupName = presetGroupName;
    }

    public ArrayList<Preset> getPresets() {
        return presets;
    }

    public void setPresets(ArrayList<Preset> presets) {
        this.presets = presets;
    }

    public ArrayList<PresetGroup> getSubGroups() {
        return subGroups;
    }

    public void setSubGroups(ArrayList<PresetGroup> subGroups) {
        this.subGroups = subGroups;
    }

    /**
     * @return the currentPresetUniqueId
     */
    public String getCurrentPresetUniqueId() {
        return currentPresetUniqueId;
    }

    /**
     * @param currentPresetUniqueId the currentPresetUniqueId to set
     */
    public void setCurrentPresetUniqueId(String currentPresetUniqueId) {
        this.currentPresetUniqueId = currentPresetUniqueId;
    }

    /**
     * @return the currentPresetModified
     */
    public boolean isCurrentPresetModified() {
        return currentPresetModified;
    }

    /**
     * @param currentPresetModified the currentPresetModified to set
     */
    public void setCurrentPresetModified(boolean currentPresetModified) {
        this.currentPresetModified = currentPresetModified;
    }

    public static PresetGroup loadFromXML(Element data) {
        PresetGroup group = new PresetGroup();

        group.setPresetGroupName(data.getAttributeValue("name"));

        String val = data.getAttributeValue("currentPresetUniqueId");
        if (val != null && val.length() > 0) {
            group.setCurrentPresetUniqueId(val);
        }

        val = data.getAttributeValue("currentPresetModified");
        if (val != null && val.length() > 0) {
            group.setCurrentPresetModified(Boolean.valueOf(val).booleanValue());
        }

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            switch (node.getName()) {
                case "presetGroup":
                    PresetGroup pGroup = PresetGroup.loadFromXML(node);
                    group.getSubGroups().add(pGroup);
                    break;
                case "preset":
                    Preset preset = Preset.loadFromXML(node);
                    group.getPresets().add(preset);
                    break;
            }
        }

        return group;
    }

    public Element saveAsXML() {
        Element retVal = new Element("presetGroup");
        retVal.setAttribute("name", getPresetGroupName());

        if (currentPresetUniqueId != null) {
            retVal.setAttribute("currentPresetUniqueId", currentPresetUniqueId);
            retVal.setAttribute("currentPresetModified", Boolean.toString(currentPresetModified));
        }

        for (Iterator<PresetGroup> iter = subGroups.iterator(); iter.hasNext();) {
            PresetGroup subGroup = iter.next();

            retVal.addElement(subGroup.saveAsXML());
        }

        for (Iterator<Preset> iter = presets.iterator(); iter.hasNext();) {
            Preset preset = iter.next();

            retVal.addElement(preset.saveAsXML());
        }

        return retVal;
    }

    /*
     * (non-Javadoc)
     * 
     * @see java.lang.Comparable#compareTo(java.lang.Object)
     */
    @Override
    public int compareTo(PresetGroup b) {
        return this.getPresetGroupName().compareTo(b.getPresetGroupName());
    }

    /**
     * @param preset
     */
    public void addPreset(Preset preset) {
        presets.add(preset);
        // Collections.sort(presets);
    }

    /**
     * @param presetGroup
     */
    public void addPresetGroup(PresetGroup presetGroup) {
        subGroups.add(presetGroup);
        // Collections.sort(subGroups);
    }

    /**
     * @param preset
     */
    public boolean removePreset(Preset preset) {
        if (presets.contains(preset)) {
            presets.remove(preset);
            return true;
        }

        for (Iterator iter = subGroups.iterator(); iter.hasNext();) {
            PresetGroup tempGroup = (PresetGroup) iter.next();
            if (tempGroup.removePreset(preset)) {
                return true;
            }

        }

        return false;
    }

    /**
     * @param presetGroup
     */
    public boolean removePresetGroup(PresetGroup presetGroup) {
        if (subGroups.contains(presetGroup)) {
            subGroups.remove(presetGroup);
            return true;
        }

        for (Iterator<PresetGroup> iter = subGroups.iterator(); iter.hasNext();) {
            PresetGroup tempGroup = iter.next();

            if (tempGroup.removePresetGroup(presetGroup)) {
                return true;
            }
        }

        return false;
    }

    public Preset findPresetByUniqueId(String uniqueId) {

        if (uniqueId == null) {
            return null;
        }

        for (PresetGroup presetGroup : subGroups) {
            Preset preset = presetGroup.findPresetByUniqueId(uniqueId);
            if (preset != null) {
                return preset;
            }
        }

        for (Preset preset : presets) {
            if (uniqueId.equals(preset.getUniqueId())) {
                return preset;
            }
        }
        return null;
    }

    public String getPresetFullPathName(String uniqueId) {
        if (uniqueId == null) {
            return null;
        }

        for (PresetGroup presetGroup : subGroups) {
            Preset preset = presetGroup.findPresetByUniqueId(uniqueId);
            if (preset != null) {
                return presetGroup.getPresetGroupName() + " :: " + preset.getPresetName();
            }
        }

        for (Preset preset : presets) {
            if (uniqueId.equals(preset.getUniqueId())) {
                return preset.getPresetName();
            }
        }
        return null;
    }

    @Override
    public String toString() {
        return getPresetGroupName();
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

}
