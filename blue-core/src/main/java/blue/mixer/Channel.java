/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

package blue.mixer;

import blue.automation.Parameter;
import blue.automation.ParameterListener;
import blue.automation.ParameterTimeManagerFactory;
import blue.components.lines.Line;
import blue.components.lines.LinePoint;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Vector;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

/**
 * Design Notes:
 * 
 * @author Steven Yi
 */

public class Channel implements Comparable<Channel>, ParameterListener {

    public static final String MASTER = "Master";

    public static final String NAME = "name";

    public static final String LEVEL = "level";

    public static final String SOLO = "solo";

    public static final String MUTED = "muted";

    public static final String OUT_CHANNEL = "outChannel";

    private transient List<PropertyChangeListener> listeners;

    private EffectsChain preEffects;

    private EffectsChain postEffects;

    private String outChannel = MASTER;

    private String name = "Channel";

    private boolean muted = false;

    private boolean solo = false;

    private double level = 0.0f;

    Parameter levelParameter; 

    private String association = null;

    private transient boolean updatingLine = false;


    public Channel() {
        preEffects = new EffectsChain();
        postEffects = new EffectsChain();

        levelParameter = new Parameter();
        levelParameter.setName("Volume");
        levelParameter.setLabel("dB");
        levelParameter.setMin(-96.0f, false);
        levelParameter.setMax(12.0f, false);
        levelParameter.setValue(0.0f);
        levelParameter.setResolution(new BigDecimal(-1.0f));

        levelParameter.addParameterListener(this);
    }

    public Channel(Channel channel){

        preEffects = new EffectsChain(channel.preEffects);
        postEffects = new EffectsChain(channel.postEffects);

        outChannel = channel.outChannel;
        setName(channel.name);
        muted = channel.muted;
        solo = channel.solo;
        level = channel.level;

        levelParameter = new Parameter(channel.levelParameter);
        levelParameter.addParameterListener(this);

        association = channel.association;
    }

    public static Channel loadFromXML(Element data) throws Exception {
        Channel channel = new Channel();

        String associationVal = data.getAttributeValue("association");
        if(associationVal != null && !"null".equals(associationVal)) {
            channel.setAssociation(data.getAttributeValue("association"));
        }
        
        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "name":
                    channel.setName(node.getTextString());
                    break;
                case "outChannel":
                    channel.setOutChannel(node.getTextString());
                    break;
                case "level":
                    channel.setLevel(XMLUtilities.readDouble(node));
                    break;
                case "muted":
                    channel.setMuted(XMLUtilities.readBoolean(node));
                    break;
                case "solo":
                    channel.setSolo(XMLUtilities.readBoolean(node));
                    break;
                case "effectsChain":
                    if (node.getAttributeValue("bin").equals("pre")) {
                        channel.setPreEffects(EffectsChain.loadFromXML(node));
                    } else {
                        channel.setPostEffects(EffectsChain.loadFromXML(node));
                    }
                    break;
                case "parameter":
                    channel.levelParameter.removeParameterListener(channel);
                    channel.levelParameter = Parameter.loadFromXML(node);
                    channel.levelParameter.addParameterListener(channel);
                    break;
            }

        }
        
        if(!channel.levelParameter.isAutomationEnabled()) {
            channel.levelParameter.setValue(channel.getLevel());
        }

        return channel;
    }

    public Element saveAsXML() {
        Element retVal = new Element("channel");

        if(association != null) {
            retVal.setAttribute("association", association);
        }
        
        retVal.addElement(new Element("name").setText(name));
        retVal.addElement(new Element("outChannel").setText(outChannel));
        retVal.addElement(XMLUtilities.writeDouble("level", level));
        retVal.addElement(XMLUtilities.writeBoolean("muted", muted));
        retVal.addElement(XMLUtilities.writeBoolean("solo", solo));

        Element preEffectsNode = preEffects.saveAsXML();
        preEffectsNode.setAttribute("bin", "pre");
        retVal.addElement(preEffectsNode);

        Element postEffectsNode = postEffects.saveAsXML();
        postEffectsNode.setAttribute("bin", "post");
        retVal.addElement(postEffectsNode);

        retVal.addElement(levelParameter.saveAsXML());

        return retVal;
    }

    public String getAssociation() {
        return association;
    }

    public void setAssociation(String association) {
        this.association = association;
    }

    public EffectsChain getPreEffects() {
        return preEffects;
    }

    public void setPreEffects(EffectsChain chain) {
        preEffects = chain;
    }

    public EffectsChain getPostEffects() {
        return postEffects;
    }

    public void setPostEffects(EffectsChain chain) {
        postEffects = chain;
    }

    public String getOutChannel() {
        return outChannel;
    }

    public void setOutChannel(String outChannel) {
        Object oldVal = this.outChannel;

        this.outChannel = outChannel;

        firePropertyChange(OUT_CHANNEL, oldVal, outChannel);
    }

    public boolean isMuted() {
        return muted;
    }

    public void setMuted(boolean muted) {
        boolean oldVal = this.muted;

        this.muted = muted;

        firePropertyChange(MUTED, oldVal, muted);
    }

    public boolean isSolo() {
        return solo;
    }

    public void setSolo(boolean solo) {
        boolean oldVal = this.solo;

        this.solo = solo;

        firePropertyChange(SOLO, oldVal, solo);
    }

    public double getLevel() {
        // if(levelParameter.isAutomationEnabled()) {
        // return levelParameter.getLine().getValue(0.0f);
        // }
        return level;
    }

    public void setLevel(double level) {
        if (levelParameter.isAutomationEnabled()) {
            double time = ParameterTimeManagerFactory.getInstance().getTime();

            if (time < 0) {
                return;
            }

            updatingLine = true;
            LinePoint found = null;

            Line line = levelParameter.getLine();

            for (int i = 0; i < line.size(); i++) {
                LinePoint point = line.getLinePoint(i);
                if (point.getX() == time) {
                    found = point;
                    break;
                }

            }

            if (found != null) {
                found.setLocation(found.getX(), level);
            } else {
                LinePoint lp = new LinePoint();
                lp.setLocation(time, level);
                line.insertLinePoint(lp);
            }

            updatingLine = false;
        } else {
            levelParameter.setValue(level);
        }

        double oldVal = this.level;

        this.level = level;

        firePropertyChange(LEVEL, new Double(oldVal), new Double(level));
    }

    public Parameter getLevelParameter() {
        return levelParameter;
    }

    public void setLevelParameter(Parameter param) {
        this.levelParameter = param;
    }

    public String getName() {
        return (name == null) ? "" : name;
    }

    public void setName(String name) {
        String oldVal = getName();

        this.name = (name == null) ? "" : name;

        firePropertyChange(NAME, oldVal, this.name);
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            listeners = new Vector<>();
        }
        listeners.add(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            return;
        }
        listeners.remove(pcl);
    }

    public void firePropertyChange(String propertyName, double oldVal,
            double newVal) {
        firePropertyChange(propertyName, new Double(oldVal), new Double(newVal));
    }

    public void firePropertyChange(String propertyName, boolean oldVal,
            boolean newVal) {
        firePropertyChange(propertyName, Boolean.valueOf(oldVal), Boolean
                .valueOf(newVal));
    }

    public void firePropertyChange(String propertyName, Object oldVal,
            Object newVal) {
        if (listeners == null || listeners.size() == 0) {
            return;
        }

        PropertyChangeEvent pce = new PropertyChangeEvent(this, propertyName,
                oldVal, newVal);

        for (Iterator<PropertyChangeListener> it = listeners.iterator(); it.hasNext();) {
            PropertyChangeListener pcl = it.next();

            pcl.propertyChange(pce);

        }
    }

    @Override
    public int compareTo(Channel chanB) {
        try {
            int a = Integer.parseInt(this.getName());
            int b = Integer.parseInt(chanB.getName());

            return a - b;

        } catch (NumberFormatException nfe) {
            return (this.getName()).compareToIgnoreCase(chanB.getName());
        }
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    @Override
    public void lineDataChanged(Parameter param) {
        if (!updatingLine && param.isAutomationEnabled()) {
            double time = ParameterTimeManagerFactory.getInstance().getTime();
            double level = levelParameter.getLine().getValue(time);

            double oldVal = this.level;
            this.level = level;

            firePropertyChange(LEVEL, new Double(oldVal), new Double(level));
        }
    }

    @Override
    public void parameterChanged(Parameter param) {
        // TODO Auto-generated method stub

    }

    public Send[] getPreFaderSends() {
        return preEffects.getSends();
    }

    public Send[] getPostFaderSends() {
        return postEffects.getSends();
    }

    public Send[] getSends() {
        ArrayList<Send> temp = new ArrayList<>();

        for (int i = 0; i < preEffects.size(); i++) {
            Object obj = preEffects.getElementAt(i);

            if (obj instanceof Send) {
                temp.add((Send)obj);
            }
        }

        for (int i = 0; i < postEffects.size(); i++) {
            Object obj = postEffects.getElementAt(i);

            if (obj instanceof Send) {
                temp.add((Send)obj);
            }
        }

        Send[] sends = temp.toArray(new Send[temp.size()]);

        return sends;
    }
}
