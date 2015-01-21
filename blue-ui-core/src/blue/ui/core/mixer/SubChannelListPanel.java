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

package blue.ui.core.mixer;

import blue.Arrangement;
import blue.BlueData;
import blue.actions.BlueAction;
import blue.mixer.*;
import blue.orchestra.BlueSynthBuilder;
import blue.orchestra.Instrument;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.BSBSubChannelDropdown;
import blue.projects.BlueProjectManager;
import blue.ui.utilities.UiUtilities;
import java.awt.Dimension;
import java.awt.Rectangle;
import java.awt.event.ActionEvent;
import java.awt.event.ContainerEvent;
import java.awt.event.ContainerListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.Action;
import javax.swing.JComponent;
import javax.swing.JPopupMenu;
import javax.swing.Scrollable;

/**
 * @author steven
 */
public class SubChannelListPanel extends JComponent implements Scrollable,
        PropertyChangeListener {

    private ChannelList subChannels = null;

    private JPopupMenu addPopup = new JPopupMenu();

    private JPopupMenu removePopup = new JPopupMenu();

    private ChannelPanel selectedChannelPanel = null;

    private MouseListener removePanelListener;

    private ArrayList models = new ArrayList();

    private Vector listeners = new Vector();

    /** Creates a new instance of ChanelListPanel */
    public SubChannelListPanel() {
        this.setLayout(new ChannelListLayout(50));

        this.addContainerListener(new ContainerListener() {

            @Override
            public void componentAdded(ContainerEvent e) {
                Dimension preferredLayoutSize = getLayout()
                        .preferredLayoutSize(SubChannelListPanel.this);

                setPreferredSize(preferredLayoutSize);
                setSize(preferredLayoutSize);
            }

            @Override
            public void componentRemoved(ContainerEvent e) {
                Dimension preferredLayoutSize = getLayout()
                        .preferredLayoutSize(SubChannelListPanel.this);

                setPreferredSize(preferredLayoutSize);
                setSize(preferredLayoutSize);
            }

        });

        Action addSubChannel = new BlueAction("mixer.addSubChannel") {

            @Override
            public void actionPerformed(ActionEvent e) {
                addSubChannnel();
            }
        };

        addPopup.add(addSubChannel);

        Action removeSubChannel = new BlueAction("mixer.removeSubChannel") {

            @Override
            public void actionPerformed(ActionEvent e) {
                removeSubChannnel();
            }
        };

        removePopup.add(removeSubChannel);

        removePanelListener = new MouseAdapter() {

            @Override
            public void mouseClicked(MouseEvent e) {
                if (UiUtilities.isRightMouseButton(e)
                        && e.getSource() instanceof ChannelPanel) {
                    selectedChannelPanel = (ChannelPanel) e.getSource();
                    removePopup.show(selectedChannelPanel, e.getX(), e.getY());
                }
            }
        };

        this.addMouseListener(new MouseAdapter() {

            @Override
            public void mouseClicked(MouseEvent e) {
                if (UiUtilities.isRightMouseButton(e)) {
                    addPopup.show(SubChannelListPanel.this, e.getX(), e.getY());
                }
            }
        });

        this.setMinimumSize(new Dimension(0, 0));
    }

    public void setChannelList(ChannelList channels) {
        if (this.subChannels != null) {
            // this.subChannels.removeListDataListener(this);
        }

        this.subChannels = channels;

        clearChannels();
        rebuildChannelsUI(channels);

        // this.subChannels.addListDataListener(this);
    }

    private void clearChannels() {
        for (int i = 0; i < getComponentCount(); i++) {
            ChannelPanel cPanel = (ChannelPanel) getComponent(i);
            cPanel.clear();

            cPanel.getChannel().removePropertyChangeListener(this);
        }

        models.clear();

        this.removeAll();
    }

    private void rebuildChannelsUI(final ChannelList channels) {

        for (int i = 0; i < channels.size(); i++) {
            Channel channel = channels.get(i);
            ChannelPanel cPanel = createChannelPanel(channel);

            this.add(cPanel);
        }
    }

    private ChannelPanel createChannelPanel(Channel channel) {
        ChannelPanel cPanel = new ChannelPanel();

        SubChannelOutComboBoxModel model = new SubChannelOutComboBoxModel();

        models.add(model);

        channel.addPropertyChangeListener(this);

        model.setData(subChannels, channel);
        model.setSelectedItem(channel.getOutChannel());
        cPanel.setChannelOutModel(model);

        cPanel.setSubChannel(true);
        cPanel.setChannel(channel);

        cPanel.addMouseListener(removePanelListener);
        return cPanel;
    }

    private void addSubChannnel() {

        Channel channel = new Channel();

        int index = subChannels.size() + 1;
        boolean valid = false;

        while (!valid) {
            String name = "SubChannel" + index;
            if (subChannels.indexByName(name) < 0) {
                channel.setName(name);
                valid = true;
            } else {
                index++;
            }
        }

        subChannels.add(channel);

        ChannelPanel cPanel = createChannelPanel(channel);

        this.add(cPanel);
    }

    private void removeSubChannnel() {
        if (selectedChannelPanel == null) {
            return;
        }

        Channel channel = selectedChannelPanel.getChannel();

        channel.removePropertyChangeListener(this);
        subChannels.remove(channel);

        models.remove(selectedChannelPanel.getChannelOutModel());

        selectedChannelPanel.clear();

        this.remove(selectedChannelPanel);
        selectedChannelPanel = null;

        String removedChannel = channel.getName();

        reconcileSubChannelRemoveInBlueArrangement(removedChannel);
    }

    // SCROLLABLE METHODS

    @Override
    public Dimension getPreferredScrollableViewportSize() {
        return getPreferredSize();
    }

    @Override
    public int getScrollableUnitIncrement(Rectangle visibleRect,
            int orientation, int direction) {
        return 1;
    }

    @Override
    public int getScrollableBlockIncrement(Rectangle visibleRect,
            int orientation, int direction) {
        return 10;
    }

    @Override
    public boolean getScrollableTracksViewportWidth() {
        return getPreferredSize().width < getParent().getWidth();
    }

    @Override
    public boolean getScrollableTracksViewportHeight() {
        return getPreferredSize().height < getParent().getHeight();
    }

    @Override
    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        listeners.add(pcl);
    }

    // fire off event so that ChannelListPanel can receive the name change
    public void firePropertyChangeEvent(PropertyChangeEvent pce) {
        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            PropertyChangeListener listener = (PropertyChangeListener) iter
                    .next();
            listener.propertyChange(pce);
        }
    }

    @Override
    public void propertyChange(PropertyChangeEvent pce) {
        if (pce.getPropertyName().equals(Channel.NAME)) {

            String oldName = (String) pce.getOldValue();
            String newName = (String) pce.getNewValue();

            for (Iterator iter = models.iterator(); iter.hasNext();) {
                SubChannelOutComboBoxModel model = (SubChannelOutComboBoxModel) iter
                        .next();
                model.reconcile(oldName, newName);

            }
            firePropertyChangeEvent(pce);

            reconcileNameChangeInBlueArrangement(oldName, newName);
        }
    }

    /**
     * A hack to explicitly walk the current blue orchestra to find any
     * BlueSynthBuilder's that contain BSBSubChannelDropdown's and to reconcile
     * the name change.
     * 
     * @param oldName
     * @param newName
     */
    private void reconcileNameChangeInBlueArrangement(String oldName,
            String newName) {
        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();

        if (data == null) {
            return;
        }

        Arrangement arr = data.getArrangement();

        for (int i = 0; i < arr.size(); i++) {
            Instrument instr = arr.getInstrument(i);

            if (instr instanceof BlueSynthBuilder) {
                BlueSynthBuilder bsb = (BlueSynthBuilder) instr;

                BSBGraphicInterface bsbInterface = bsb.getGraphicInterface();

                for (int j = 0; j < bsbInterface.size(); j++) {
                    BSBObject bsbObj = bsbInterface.getBSBObject(j);

                    if (bsbObj instanceof BSBSubChannelDropdown) {
                        BSBSubChannelDropdown bsbSubDrop = (BSBSubChannelDropdown) bsbObj;
                        if (bsbSubDrop.getChannelOutput().equals(oldName)) {
                            bsbSubDrop.setChannelOutput(newName);
                        }
                    }
                }
            }
        }
    }

    /**
     * A hack to explicitly walk the current blue orchestra to find any
     * BlueSynthBuilder's that contain BSBSubChannelDropdown's and to reconcile
     * with the removed channel
     * 
     * @param removedChannel
     * 
     * @param oldName
     * @param newName
     */
    private void reconcileSubChannelRemoveInBlueArrangement(
            String removedChannel) {
        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();

        if (data == null) {
            return;
        }

        Arrangement arr = data.getArrangement();

        for (int i = 0; i < arr.size(); i++) {
            Instrument instr = arr.getInstrument(i);

            if (instr instanceof BlueSynthBuilder) {
                BlueSynthBuilder bsb = (BlueSynthBuilder) instr;

                BSBGraphicInterface bsbInterface = bsb.getGraphicInterface();

                for (int j = 0; j < bsbInterface.size(); j++) {
                    BSBObject bsbObj = bsbInterface.getBSBObject(j);

                    if (bsbObj instanceof BSBSubChannelDropdown) {
                        BSBSubChannelDropdown bsbSubDrop = (BSBSubChannelDropdown) bsbObj;
                        if (bsbSubDrop.getChannelOutput()
                                .equals(removedChannel)) {
                            bsbSubDrop.setChannelOutput(Channel.MASTER);
                        }
                    }
                }
            }
        }
    }
}
