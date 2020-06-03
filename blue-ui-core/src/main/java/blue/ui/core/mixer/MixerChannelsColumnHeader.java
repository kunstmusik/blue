/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.core.mixer;

import blue.mixer.Channel;
import blue.mixer.ChannelList;
import blue.mixer.Mixer;
import blue.util.ObservableListEvent;
import blue.util.ObservableListListener;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Insets;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.border.Border;
import org.openide.windows.WindowManager;

/**
 *
 * @author stevenyi
 */
public class MixerChannelsColumnHeader extends JPanel implements ObservableListListener {

    private static final int CHANNEL_STRIP_WIDTH = 90;

    Mixer mixer = null;

    static final class NamePanelBorder implements Border {

        private static final Insets insets = new Insets(0, 5, 0, 0);

        @Override
        public void paintBorder(Component c, Graphics g, int x, int y, int width, int height) {
            g.setColor(new Color(255, 255, 255, 32));
            g.drawLine(0, 0, 0, height);
        }

        @Override
        public Insets getBorderInsets(Component c) {
            return insets;
        }

        @Override
        public boolean isBorderOpaque() {
            return true;
        }

    }

    static final class NamePanel extends JLabel implements
            PropertyChangeListener, ObservableListListener<Channel> {

        private final ChannelList list;
        private final int widthAdjust;

        public NamePanel(ChannelList list, int widthAdjust) {
            this.list = list;
            this.widthAdjust = widthAdjust;

            setBackground(getBackground().darker().darker());
            setOpaque(true);
            setBorder(new NamePanelBorder());

            this.addMouseListener(new MouseAdapter() {
                @Override
                public void mouseClicked(MouseEvent e) {
                    if (e.getClickCount() >= 2
                            && list.isListNameEditSupported() &&
                            list.getAssociation() != null) {
                        String originalName = list.getListName();
                        String retVal = JOptionPane.showInputDialog(
                                WindowManager.getDefault().getMainWindow(),
                                "Please Enter Channel List Name", originalName);

                        if (retVal != null && retVal.trim().length() > 0
                                && !retVal.equals(originalName)) {
                            retVal = retVal.trim();
                            list.setListName(retVal);
                        }
                    }
                }
            });
        }

        @Override
        public Dimension getPreferredSize() {
            return new Dimension(list.size() * CHANNEL_STRIP_WIDTH + widthAdjust,
                    22);
        }

        @Override
        public void removeNotify() {
            list.removePropertyChangeListener(this);
            list.removeListener(this);
            super.removeNotify();
        }

        @Override
        public void addNotify() {
            super.addNotify();
            setText(list.getListName());
            setToolTipText(list.getListName());
            setSize(getPreferredSize());
            list.addPropertyChangeListener(this);
            list.addListener(this);
        }

        @Override
        public void propertyChange(PropertyChangeEvent evt) {
            if ("listName".equals(evt.getPropertyName())) {
                setText(list.getListName());
                setToolTipText(list.getListName());
                invalidate();
                repaint();
            }
        }

        @Override
        public void listChanged(ObservableListEvent<Channel> listEvent) {
            setSize(getPreferredSize());
        }

    }

    public MixerChannelsColumnHeader(JComponent channelGroupsPanel) {
        setPreferredSize(new Dimension(channelGroupsPanel.getWidth(), 22));
        setSize(new Dimension(400, 22));
        setLayout(new ChannelListLayout());
        setBackground(Color.BLACK);

        channelGroupsPanel.addComponentListener(new ComponentAdapter() {

            @Override
            public void componentResized(ComponentEvent e) {
                Dimension d = new Dimension(channelGroupsPanel.getWidth(), 22);
                setPreferredSize(d);
                setSize(d);
                invalidate();
            }

        });
    }

    @Override
    public void listChanged(ObservableListEvent listEvent) {
        rebuildUI();
    }

    protected void rebuildUI() {
        this.removeAll();
        for (ChannelList list : mixer.getChannelListGroups()) {
            this.add(new NamePanel(list, 0));
        }
        this.add(new NamePanel(mixer.getChannels(), 0));
        this.add(new NamePanel(mixer.getSubChannels(), CHANNEL_STRIP_WIDTH));
        repaint();
    }

    public void setMixer(Mixer mixer) {
        if (this.mixer != null) {
            this.mixer.getChannelListGroups().removeListener(this);
        }

        this.mixer = mixer;

        this.mixer.getChannelListGroups().addListener(this);

        rebuildUI();

    }
}
