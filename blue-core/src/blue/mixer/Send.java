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

import blue.automation.*;
import blue.components.lines.Line;
import blue.components.lines.LinePoint;
import blue.orchestra.blueSynthBuilder.StringChannel;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;

/**
 * @author Steven Yi
 */

public class Send implements Automatable, ParameterListener {
    private String sendChannel = Channel.MASTER;

    private double level = 1.0f;

    private boolean enabled = true;

    private ParameterList params = new ParameterList();

    private Parameter levelParameter;

    private transient Vector<PropertyChangeListener> listeners = null;

    private transient boolean updatingLine = false;

    public Send() {
        this(true);
    }

    private Send(boolean init) {
        if (init) {
            levelParameter = new Parameter();
            levelParameter.setName("Send Amount");
            levelParameter.setMin(0.0f, false);
            levelParameter.setMax(1.0f, false);
            levelParameter.setValue(1.0f);
            levelParameter.setResolution(new BigDecimal(-1.0f));

            levelParameter.addParameterListener(this);

            params.add(levelParameter);
        }
    }

    public Send(Send send) {
        sendChannel = send.sendChannel;
        level = send.level;
        enabled = send.enabled;

        levelParameter = new Parameter(send.levelParameter);
        levelParameter.addParameterListener(this);
        params.add(levelParameter);
    }

    public String getSendChannel() {
        return sendChannel;
    }

    public void setSendChannel(String sendChannel) {
        if (this.sendChannel.equals(sendChannel)) {
            return;
        }

        String oldName = this.sendChannel;
        this.sendChannel = sendChannel;

        PropertyChangeEvent pce = new PropertyChangeEvent(this, "sendChannel",
                oldName, this.sendChannel);

        firePropertyChangeEvent(pce);
    }

    public double getLevel() {
        return level;
    }

    public Parameter getLevelParameter() {
        return levelParameter;
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
        }

        double oldVal = this.level;
        this.level = level;

        PropertyChangeEvent pce = new PropertyChangeEvent(this, "level",
                new Double(oldVal), new Double(level));

        firePropertyChangeEvent(pce);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Element saveAsXML() {
        Element retVal = new Element("send");

        retVal.addElement("sendChannel").setText(sendChannel);
        retVal.addElement("level").setText(Double.toString(level));
        retVal.addElement("enabled").setText(Boolean.toString(enabled));
        retVal.addElement(levelParameter.saveAsXML());

        return retVal;
    }

    public static Send loadFromXML(Element data) {
        Send send = new Send(false);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "sendChannel":
                    send.sendChannel = node.getTextString();
                    break;
                case "level":
                    send.level = Double.parseDouble(node.getTextString());
                    break;
                case "enabled":
                    send.enabled = Boolean.valueOf(node.getTextString())
                            .booleanValue();
                    break;
                case "parameter":
                    send.levelParameter = Parameter.loadFromXML(node);
                    send.levelParameter.addParameterListener(send);
                    send.params.add(send.levelParameter);
                    break;
            }
        }

        if (send.params.size() == 0) {
            send.levelParameter = new Parameter();
            send.levelParameter.setName("Send Amount");
            send.levelParameter.setMin(0.0f, false);
            send.levelParameter.setMax(1.0f, false);
            send.levelParameter.setValue(1.0f);
            send.levelParameter.setResolution(new BigDecimal(-1.0f));

            send.levelParameter.addParameterListener(send);

            send.params.add(send.levelParameter);
        }

        return send;
    }

    @Override
    public String toString() {
        return "> Send: " + sendChannel;
    }

    @Override
    public ParameterList getParameterList() {
        return params;
    }

    // SUPPORT FOR PROPERTY CHANGE EVENTS
    private void firePropertyChangeEvent(PropertyChangeEvent pce) {
        if (listeners == null) {
            return;
        }

        for (Iterator<PropertyChangeListener> iter =
                new Vector<>(listeners).iterator(); iter.hasNext();) {
            PropertyChangeListener listener = iter.next();

            listener.propertyChange(pce);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            listeners = new Vector<>();
        }

        if(!listeners.contains(pcl)) {
            listeners.add(pcl);
        }
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            return;
        }
        listeners.remove(pcl);
    }

    // PARAMETER LISTENING
    @Override
    public void lineDataChanged(Parameter param) {
        if (!updatingLine) {
            double time = ParameterTimeManagerFactory.getInstance().getTime();
            double level = levelParameter.getLine().getValue(time);

            double oldVal = this.level;
            this.level = level;

            PropertyChangeEvent pce = new PropertyChangeEvent(this, "level",
                    new Double(oldVal), new Double(level));

            firePropertyChangeEvent(pce);
        }
    }

    @Override
    public void parameterChanged(Parameter param) {
        // TODO Auto-generated method stub

    }

    @Override
    public ArrayList<StringChannel> getStringChannels() {
        return null;
    }
}
