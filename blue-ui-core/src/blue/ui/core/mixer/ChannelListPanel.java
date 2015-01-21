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

import blue.mixer.*;
import blue.util.ObservableListEvent;
import blue.util.ObservableListListener;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.ContainerEvent;
import java.awt.event.ContainerListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import javax.swing.JComponent;
import javax.swing.SwingUtilities;

/**
 * @author steven
 */
public class ChannelListPanel extends JComponent implements ObservableListListener<Channel>,
        PropertyChangeListener {

    private ChannelList channels = null;

    private ChannelList subChannels = null;

    /**
     * Creates a new instance of ChanelListPanel
     */
    public ChannelListPanel() {
        this.setLayout(new ChannelListLayout());

        this.addContainerListener(new ContainerListener() {

            @Override
            public void componentAdded(ContainerEvent e) {
                Dimension preferredLayoutSize = getLayout()
                        .preferredLayoutSize(ChannelListPanel.this);

                setPreferredSize(preferredLayoutSize);
                setSize(preferredLayoutSize);
            }

            @Override
            public void componentRemoved(ContainerEvent e) {
                Dimension preferredLayoutSize = getLayout()
                        .preferredLayoutSize(ChannelListPanel.this);

                setPreferredSize(preferredLayoutSize);
                setSize(preferredLayoutSize);
            }

        });

        this.setMinimumSize(new Dimension(0, 0));
    }

    public void setChannelList(ChannelList channels, ChannelList subChannels) {
        if (this.channels != null) {
            this.channels.removeListener(this);
        }

        this.channels = channels;
        this.subChannels = subChannels;

        rebuildChannelsUI(channels);

        this.channels.addListener(this);
    }

    public ChannelList getChannels() {
        return channels;
    }

    private void clearChannels() {
        for (int i = 0; i < getComponentCount(); i++) {
            ChannelPanel cPanel = (ChannelPanel) getComponent(i);
            cPanel.clear();
        }

        this.removeAll();
    }

    private void rebuildChannelsUI(final ChannelList channels) {
        clearChannels();
        for (int i = 0; i < channels.size(); i++) {
            Channel channel = channels.get(i);
            ChannelPanel cPanel = createChannelPanel(channel);

            this.add(cPanel);
        }
        revalidate();
    }

    /**
     * @param channel
     * @return
     */
    private ChannelPanel createChannelPanel(Channel channel) {
        ChannelPanel cPanel = new ChannelPanel();

        ChannelOutComboBoxModel model = new ChannelOutComboBoxModel();
        model.setChannels(subChannels);
        model.setSelectedItem(channel.getOutChannel());
        cPanel.setChannelOutModel(model);

        cPanel.setChannel(channel);
        return cPanel;
    }

    void sort() {
        ArrayList list = new ArrayList();

        for (int i = 0; i < this.getComponentCount(); i++) {
            list.add(getComponent(i));
        }

        this.removeAll();

        Collections.sort(list);

        for (Iterator it = list.iterator(); it.hasNext();) {
            this.add((Component) it.next());
        }
    }

    @Override
    public void propertyChange(PropertyChangeEvent pce) {
        if (pce.getPropertyName().equals(Channel.NAME)) {

            String oldName = (String) pce.getOldValue();
            String newName = (String) pce.getNewValue();

            for (int i = 0; i < getComponentCount(); i++) {
                ChannelPanel chanPanel = (ChannelPanel) getComponent(i);
                ChannelOutComboBoxModel model = (ChannelOutComboBoxModel) chanPanel
                        .getChannelOutModel();

                model.reconcile(oldName, newName);
            }

            // for (Iterator iter = models.iterator(); iter.hasNext();) {
            // SubChannelOutComboBoxModel model = (SubChannelOutComboBoxModel)
            // iter
            // .next();
            // model.reconcile(oldName, newName);
            //
            //
            // }
        }

    }

    @Override
    public void removeNotify() {
        if (this.channels != null) {
            this.channels.removeListener(this);
        }
        super.removeNotify();
    }

    @Override
    public void addNotify() {
        super.addNotify();
        if (this.channels != null) {
            this.channels.addListener(this);
        }
    }

    @Override
    public void listChanged(ObservableListEvent<Channel> listEvent) {
        switch (listEvent.getType()) {
            case ObservableListEvent.DATA_ADDED:
                intervalAdded(listEvent);
                break;
            case ObservableListEvent.DATA_REMOVED:
                intervalRemoved(listEvent);
                break;
            case ObservableListEvent.DATA_CHANGED:
                contentsChanged();
                break;
        }
    }

    public void intervalAdded(ObservableListEvent<Channel> e) {
        final int index0 = e.getStartIndex();
        final int index1 = e.getEndIndex();

        SwingUtilities.invokeLater(new Runnable() {

            @Override
            public void run() {
                for (int i = index0; i <= index1; i++) {
                    Channel channel = channels.get(i);
                    ChannelPanel cPanel = createChannelPanel(channel);

                    add(cPanel, i);
                }
                revalidate();
            }
        });

    }

    public void intervalRemoved(ObservableListEvent<Channel> e) {
        final int index0 = e.getStartIndex();
        final int index1 = e.getEndIndex();

        SwingUtilities.invokeLater(new Runnable() {

            @Override
            public void run() {
                for (int i = index1; i >= index0; i--) {
                    ChannelPanel cPanel = (ChannelPanel) getComponent(i);
                    cPanel.clear();

                    remove(index0);
                }

                revalidate();
            }
        });
    }

    public void contentsChanged() {
        SwingUtilities.invokeLater(new Runnable() {

            @Override
            public void run() {
                rebuildChannelsUI(channels);
            }
        });
    }
}
