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
 * the Free Software Foundation Inc., 59 Temple Place - Suite 320,
 * Boston, MA  02111-1207 USA
 */
package blue.soundObject.editor.tracker;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Vector;

import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.ActionMap;
import javax.swing.BorderFactory;
import javax.swing.DefaultCellEditor;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.JToggleButton;
import javax.swing.JViewport;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.border.BevelBorder;
import javax.swing.border.Border;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;
import javax.swing.event.PopupMenuEvent;
import javax.swing.event.PopupMenuListener;
import javax.swing.event.TableColumnModelEvent;
import javax.swing.event.TableColumnModelListener;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.TableColumnModel;

import skt.swing.SwingUtil;
import blue.BlueSystem;
import blue.ui.components.IconFactory;
import blue.soundObject.TrackerObject;
import blue.soundObject.tracker.Column;
import blue.soundObject.tracker.Track;
import blue.soundObject.tracker.TrackList;
import blue.soundObject.tracker.TrackerNote;
import blue.utility.GUI;
import blue.utility.ObjectUtilities;

public class TracksEditor extends JPanel {

    TracksHeader header = new TracksHeader();

    JTable table;

    private final TrackerNamePanel namePanel = new TrackerNamePanel();

    private TrackList trackList;

    private final TrackEditor trackEditor = new TrackEditor();

    private final TableModelListener trackListListener;

    private Track selectedTrack = null;

    private final JScrollPane trackEditorScrollPane;

    private final ArrayList noteCopyBuffer = new ArrayList();

    private Action[] keyboardNoteActions = null;

    int keyboardOctave = 0;

    public TracksEditor() {
        this.setLayout(new BorderLayout());

        final JScrollPane jsp = new JScrollPane();
        this.add(jsp, BorderLayout.CENTER);

        table = new JTable();

        header.setPreferredSize(new Dimension(25, 2000));

        jsp.setRowHeaderView(header);
        setupTable();

        jsp.setViewportView(table);

        final JViewport namePort = new JViewport();
        namePort.setView(namePanel);

        final JPanel topPanel = new JPanel();

        topPanel.setLayout(null);
        topPanel.setMinimumSize(new Dimension(20, 20));
        topPanel.setPreferredSize(new Dimension(20, 20));

        topPanel.add(namePort);

        jsp.getViewport().addComponentListener(new ComponentAdapter() {

            public void componentMoved(ComponentEvent e) {
                int x = e.getComponent().getX();
                namePort.setLocation(x, 0);
            }

            public void componentResized(ComponentEvent e) {
                int w = e.getComponent().getWidth();
                namePort.setSize(w, 20);
            }
        });

        jsp.getViewport().addChangeListener(new ChangeListener() {

            public void stateChanged(ChangeEvent e) {
                namePort.setViewPosition(new Point(jsp.getViewport()
                        .getViewPosition().x, 0));
            }

        });

        this.add(topPanel, BorderLayout.NORTH);

        namePanel.addChangeListener(new ChangeListener() {
            public void stateChanged(ChangeEvent e) {
                int index = namePanel.getSelectedIndex();

                if (index > -1) {
                    Track track = trackList.getTrack(index);

                    selectedTrack = track;

                    trackEditor.setTrack(track);
                } else {
                    trackEditor.setTrack(null);
                    selectedTrack = null;
                }

            }
        });

        trackEditorScrollPane = new JScrollPane(trackEditor);
        trackEditorScrollPane
                .setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_NEVER);
        trackEditorScrollPane.setPreferredSize(new Dimension(320, 30));
        trackEditorScrollPane.setVisible(false);

        this.add(trackEditorScrollPane, BorderLayout.EAST);

        JToggleButton snapButton = new JToggleButton();

        snapButton.setIcon(IconFactory.getLeftArrowIcon());
        snapButton.setSelectedIcon(IconFactory.getRightArrowIcon());
        snapButton.setFocusable(false);

        jsp.setCorner(JScrollPane.UPPER_RIGHT_CORNER, snapButton);

        jsp.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);

        snapButton.addActionListener(new ActionListener() {
            public void actionPerformed(ActionEvent e) {
                trackEditorScrollPane.setVisible(!trackEditorScrollPane
                        .isVisible());

                revalidate();
            }
        });

        trackListListener = new TableModelListener() {
            public void tableChanged(TableModelEvent e) {
                if (trackList == null) {
                    return;
                }

                int selectedIndex = namePanel.getSelectedIndex();

                namePanel.updateLabels();

                if (trackList.contains(selectedTrack)) {
                    namePanel.setSelected(selectedIndex, false);
                } else {
                    trackEditor.setTrack(null);
                }

                setColumnWidths();
            }

        };

        final Action pAction = new PasteAction();

        final JPopupMenu popup = new JPopupMenu();

        popup.add(new CutAction());
        popup.add(new CopyAction());
        popup.add(pAction);
        popup.addSeparator();
        popup.add(new DeleteAction());

        popup.addPopupMenuListener(new PopupMenuListener() {
            public void popupMenuCanceled(PopupMenuEvent e) {
            }

            public void popupMenuWillBecomeInvisible(PopupMenuEvent e) {
            }

            public void popupMenuWillBecomeVisible(PopupMenuEvent e) {
                pAction.setEnabled(noteCopyBuffer.size() > 0);
            }
        });

        table.addMouseListener(new MouseAdapter() {
            public void mousePressed(MouseEvent e) {
                if (e.isPopupTrigger()) {
                    popup.show(table, e.getX(), e.getY());
                }
            }
        });
    }

    private void setupTable() {

        table.setShowGrid(false);
        table.getTableHeader().setReorderingAllowed(false);

        table.setAutoResizeMode(JTable.AUTO_RESIZE_OFF);

        table.setDefaultRenderer(String.class, new TrackerCellRenderer());
        table.setDefaultEditor(String.class, new TrackColumnEditor());

        table.addComponentListener(new ComponentAdapter() {

            public void componentResized(ComponentEvent e) {
                namePanel.updateSize();
            }

        });

        table.getColumnModel().addColumnModelListener(
                new TableColumnModelListener() {
                    public void columnAdded(TableColumnModelEvent e) {
                    }

                    public void columnMarginChanged(ChangeEvent e) {
                        if (trackList != null) {
                            namePanel.updateLabelSizes();
                        }
                    }

                    public void columnMoved(TableColumnModelEvent e) {
                    }

                    public void columnRemoved(TableColumnModelEvent e) {
                    }

                    public void columnSelectionChanged(ListSelectionEvent e) {
                    }
                });

        table.getColumnModel().getSelectionModel().addListSelectionListener(
                new ListSelectionListener() {
                    public void valueChanged(ListSelectionEvent e) {
                        int h = table.getRowHeight();

                        int y = table.getSelectedRow() * h;
                        int selectionH = table.getSelectedRowCount() * h;

                        table.repaint(0, y, table.getWidth(), selectionH);

                    }
                });

        SwingUtil.installActions(table, new Action[] { new IncrementAction(),
                new DecrementAction(), new TieAction(), new SpaceBarAction(),
                new NoteOffAction(), new CutAction(), new CopyAction(),
                new PasteAction(), new InsertAction(), new DeleteAction(),
                new BackSpaceAction() });
    }

    /**
     * @param args
     */
    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();
        TracksEditor tracksEditor = new TracksEditor();

        TrackList testData = new TrackList();
        testData.addTrack(new Track());
        testData.addTrack(new Track());
        testData.addTrack(new Track());

        tracksEditor.setTrackList(testData);
        GUI.showComponentAsStandalone(tracksEditor, "Tracks Editor", true);
    }

    public void setTrackerObject(TrackerObject tracker) {
        setTrackList(tracker.getTracks());
        header.setTracker(tracker);
    }

    public void setKeyboardOctave(int octave) {
        this.keyboardOctave = octave;
    }

    public void useKeyboardNoteShortcuts(boolean val) {
        if (keyboardNoteActions == null) {
            keyboardNoteActions = new Action[] {
                    new KeyboardNoteAction(KeyEvent.VK_Z, 0),
                    new KeyboardNoteAction(KeyEvent.VK_S, 1),
                    new KeyboardNoteAction(KeyEvent.VK_X, 2),
                    new KeyboardNoteAction(KeyEvent.VK_D, 3),
                    new KeyboardNoteAction(KeyEvent.VK_C, 4),
                    new KeyboardNoteAction(KeyEvent.VK_V, 5),
                    new KeyboardNoteAction(KeyEvent.VK_G, 6),
                    new KeyboardNoteAction(KeyEvent.VK_B, 7),
                    new KeyboardNoteAction(KeyEvent.VK_H, 8),
                    new KeyboardNoteAction(KeyEvent.VK_N, 9),
                    new KeyboardNoteAction(KeyEvent.VK_J, 10),
                    new KeyboardNoteAction(KeyEvent.VK_M, 11),

                    new KeyboardNoteAction(KeyEvent.VK_Q, 12),
                    new KeyboardNoteAction(KeyEvent.VK_2, 13),
                    new KeyboardNoteAction(KeyEvent.VK_W, 14),
                    new KeyboardNoteAction(KeyEvent.VK_3, 15),
                    new KeyboardNoteAction(KeyEvent.VK_E, 16),
                    new KeyboardNoteAction(KeyEvent.VK_R, 17),
                    new KeyboardNoteAction(KeyEvent.VK_5, 18),
                    new KeyboardNoteAction(KeyEvent.VK_T, 19),
                    new KeyboardNoteAction(KeyEvent.VK_6, 20),
                    new KeyboardNoteAction(KeyEvent.VK_Y, 21),
                    new KeyboardNoteAction(KeyEvent.VK_7, 22),
                    new KeyboardNoteAction(KeyEvent.VK_U, 23),
                    new KeyboardNoteAction(KeyEvent.VK_I, 24),
                    new KeyboardNoteAction(KeyEvent.VK_9, 25),
                    new KeyboardNoteAction(KeyEvent.VK_O, 26),
                    new KeyboardNoteAction(KeyEvent.VK_0, 27),
                    new KeyboardNoteAction(KeyEvent.VK_P, 28), };
        }
        if (val) {
            SwingUtil.installActions(table, keyboardNoteActions);
        } else {
            ActionMap actionMap = table.getActionMap();
            InputMap inputMap = table.getInputMap(WHEN_FOCUSED);
            for (int i = 0; i < keyboardNoteActions.length; i++) {
                String name = (String) keyboardNoteActions[i]
                        .getValue(Action.NAME);

                actionMap.remove(name);
                inputMap.remove((KeyStroke) keyboardNoteActions[i]
                        .getValue(Action.ACCELERATOR_KEY));
            }
        }
    }

    private void setTrackList(TrackList list) {
        if (this.trackList != null) {
            this.trackList.removeTableModelListener(trackListListener);
            this.trackList = null;
        }

        selectedTrack = null;
        trackEditor.setTrack(null);

        setColumnWidths();

        namePanel.updateLabels();

        this.trackList = list;
        table.setModel(list);
        setColumnWidths();

        if (this.trackList != null) {
            this.trackList.addTableModelListener(trackListListener);
        }
    }

    private void setColumnWidths() {
        TableColumnModel cModel = table.getColumnModel();

        if (trackList == null) {
            return;
        }

        for (int i = 0; i < cModel.getColumnCount(); i++) {

            Column c = trackList.getTrackColumn(i);

            int size = (c == null) ? 20 : 50;

            cModel.getColumn(i).setMaxWidth(size);
            cModel.getColumn(i).setMinWidth(size);
        }
    }

    class TrackerCellRenderer extends DefaultTableCellRenderer {

        public boolean isColumnInSelectedTrack(int col) {
            int selectedCol = table.getColumnModel().getSelectionModel()
                    .getLeadSelectionIndex();

            int counter = col;

            Track selectedTrack = trackList.getTrackForColumn(selectedCol);

            Track found = null;

            for (int i = 0; i < trackList.size(); i++) {
                Track track = trackList.getTrack(i);

                if (counter >= track.getNumColumns()) {
                    counter -= track.getNumColumns();
                } else {
                    found = track;
                    break;
                }
            }

            return (selectedTrack == found);

        }

        public Component getTableCellRendererComponent(JTable table,
                Object value, boolean isSelected, boolean hasFocus, int row,
                int column) {

            TrackList model = (TrackList) table.getModel();

            int index = model.getTrackIndexForColumn(column);

            if (row % 4 == 0) {
                setBackground(Color.DARK_GRAY);
            } else if (index % 2 != 0) {
                setBackground(Color.DARK_GRAY.darker().darker());
            } else {
                setBackground(null);
            }

            int selectedCol = table.getSelectedColumn();
            boolean inSelectedTrack = isColumnInSelectedTrack(column);
            inSelectedTrack = (inSelectedTrack && table.isRowSelected(row));

            Component c = super.getTableCellRendererComponent(table, value,
                    inSelectedTrack, hasFocus, row, column);

            Column trCol = trackList.getTrackColumn(column);

            ((JLabel) c).setHorizontalAlignment(trCol == null ? CENTER : LEFT);

            int counter = column;

            for (int i = 0; i < model.size(); i++) {
                Track track = model.getTrack(i);

                if (counter >= track.getNumColumns()) {
                    counter -= track.getNumColumns();
                } else {
                    if (counter != 0) {
                        if (value == null || value.equals("")) {
                            super.setValue("---");
                        }
                    }
                    break;
                }
            }

            return c;
        }

    }

    class TrackerNamePanel extends JComponent {

        Vector listeners = null;

        ChangeEvent ce = null;

        JPopupMenu popup = new JPopupMenu();

        PropertyChangeListener nameListener;

        public TrackerNamePanel() {
            setLayout(null);
            this.setMinimumSize(new Dimension(20, 20));
            this.setPreferredSize(new Dimension(20, 20));

            Action duplicateTrackAction = new AbstractAction() {
                public void actionPerformed(ActionEvent e) {
                    if (getSelectedIndex() >= 0) {
                        duplicateTrack();
                    }
                }
            };
            duplicateTrackAction.putValue(Action.NAME, "Duplicate");

            Action clearTrackAction = new AbstractAction() {
                public void actionPerformed(ActionEvent e) {
                    if (getSelectedIndex() >= 0) {
                        clearTrack();
                    }
                }
            };
            clearTrackAction.putValue(Action.NAME, "Clear");

            Action removeAction = new AbstractAction() {
                public void actionPerformed(ActionEvent e) {
                    if (getSelectedIndex() >= 0) {
                        removeTrack();
                    }
                }
            };

            removeAction.putValue(Action.NAME, BlueSystem
                    .getString("common.remove"));

            popup.add(duplicateTrackAction);
            popup.add(clearTrackAction);

            popup.add(removeAction);

            this.addMouseListener(new MouseAdapter() {
                public void mousePressed(MouseEvent e) {
                    Component c = getComponentAt(e.getX(), e.getY());

                    if (e.isPopupTrigger()) {
                        if (c != null && c.getBackground() == Color.GREEN) {
                            popup.show((Component) e.getSource(), e.getX(), e
                                    .getY());
                        }
                    } else {
                        setSelected(c, true);
                    }

                }
            });

            nameListener = new PropertyChangeListener() {
                public void propertyChange(PropertyChangeEvent evt) {
                    if (!(evt.getSource() instanceof Track)
                            || !evt.getPropertyName().equals(Track.NAME)) {
                        return;
                    }
                    Track t = (Track) evt.getSource();

                    updateLabel(t);
                }
            };
        }

        private void removeTrack() {
            if (trackList == null) {
                return;
            }

            int index = getSelectedIndex();

            if (index >= 0 && index < trackList.size()) {
                trackList.removeTrack(index);
            }
        }

        private void duplicateTrack() {
            if (trackList == null) {
                return;
            }

            int index = getSelectedIndex();

            if (index >= 0 && index < trackList.size()) {
                trackList.duplicateTrack(index);
            }
        }

        private void clearTrack() {
            if (trackList == null) {
                return;
            }

            int index = getSelectedIndex();

            if (index >= 0 && index < trackList.size()) {
                trackList.clearTrack(index);
            }
        }

        private void updateLabel(Track t) {
            if (trackList == null) {
                return;
            }

            int index = trackList.getIndexOfTrack(t);

            if (index < 0 || index > getComponentCount() - 1) {
                return;
            }

            JLabel label = (JLabel) getComponent(index);
            label.setText(t.getName());
        }

        public int getSelectedIndex() {
            Component[] components = getComponents();

            for (int i = 0; i < components.length; i++) {
                if (components[i].getBackground() == Color.GREEN) {
                    return i;
                }
            }

            return -1;
        }

        public void setSelected(final int index, final boolean fireEvent) {
            SwingUtilities.invokeLater(new Runnable() {
                final int count = getComponentCount();

                public void run() {
                    if (index < count) {
                        setSelected(getComponent(index), fireEvent);
                    }
                }
            });
        }

        public void setSelected(final Component c, final boolean fireEvent) {
            if (c != null) {
                final Component[] components = getComponents();

                SwingUtilities.invokeLater(new Runnable() {

                    public void run() {
                        for (int i = 0; i < components.length; i++) {
                            if (components[i] == c) {
                                components[i].setBackground(Color.GREEN);
                            } else {
                                components[i].setBackground(null);
                            }
                        }

                        if (fireEvent) {
                            fireChangeEvent();
                        }
                    }
                });
            }
        }

        public void updateSize() {
            this.setSize(table.getWidth(), 20);
        }

        public void updateLabels() {
            if (trackList != null) {
                for (int i = 0; i < trackList.size(); i++) {
                    Track track = trackList.getTrack(i);
                    track.removePropertyChangeListener(nameListener);
                }
            }

            SwingUtilities.invokeLater(new Runnable() {
                public void run() {
                    removeAll();

                    if (trackList == null) {
                        return;
                    }

                    TableColumnModel columnModel = table.getColumnModel();

                    int count = columnModel.getColumnCount();

                    if (count == 0) {
                        return;
                    }

                    int offset = 0;
                    int offsetX = 0;

                    for (int i = 0; i < trackList.size(); i++) {
                        Track track = trackList.getTrack(i);
                        track.addPropertyChangeListener(nameListener);

                        int size = track.getNumColumns();

                        int x = offsetX;

                        for (int j = 0; j < size; j++) {
                            offsetX += columnModel.getColumn(offset).getWidth();
                            offset++;
                        }

                        JLabel label = new JLabel();
                        label.setBorder(new BevelBorder(BevelBorder.RAISED));

                        label.setHorizontalAlignment(JLabel.CENTER);
                        // label.setOpaque(true);
                        // label.setBackground(i % 2 == 0 ? Color.DARK_GRAY
                        // : Color.DARK_GRAY.darker().darker());
                        // label.setForeground(Color.WHITE);
                        label.setText(track.getName());

                        add(label);

                        label.setLocation(x, 0);
                        label.setSize(offsetX - x, 20);

                    }

                    setMinimumSize(new Dimension(offsetX, 20));
                    setPreferredSize(new Dimension(offsetX, 20));
                }
            });
        }

        public void updateLabelSizes() {
            SwingUtilities.invokeLater(new Runnable() {
                public void run() {
                    if (trackList == null || getComponentCount() == 0) {
                        return;
                    }

                    TableColumnModel columnModel = table.getColumnModel();

                    int count = columnModel.getColumnCount();

                    if (count == 0) {
                        return;
                    }

                    int offset = 0;
                    int offsetX = 0;

                    for (int i = 0; i < trackList.size(); i++) {
                        Track track = trackList.getTrack(i);

                        int size = track.getNumColumns();

                        int x = offsetX;

                        for (int j = 0; j < size; j++) {
                            offsetX += columnModel.getColumn(offset).getWidth();
                            offset++;
                        }

                        JLabel label = (JLabel) getComponent(i);

                        label.setLocation(x, 0);
                        label.setSize(offsetX - x, 20);

                    }

                    setMinimumSize(new Dimension(offsetX, 20));
                    setPreferredSize(new Dimension(offsetX, 20));
                }
            });
        }

        /* CHANGE EVENT CODE */

        public void addChangeListener(ChangeListener cl) {
            if (listeners == null) {
                listeners = new Vector();
            }

            listeners.add(cl);
        }

        public void fireChangeEvent() {
            if (listeners == null) {
                return;
            }

            if (ce == null) {
                new ChangeEvent(this);
            }

            for (Iterator it = listeners.iterator(); it.hasNext();) {
                ChangeListener listener = (ChangeListener) it.next();
                listener.stateChanged(ce);
            }

        }

    }

    class TrackColumnEditor extends DefaultCellEditor {

        private int row = -1;

        private int column = -1;

        JTextField textField;

        Border normalBorder;

        Border errorBorder = BorderFactory.createLineBorder(Color.RED);

        public TrackColumnEditor() {
            super(new JTextField());

            textField = (JTextField) editorComponent;

            normalBorder = textField.getBorder();
        }

        public Component getTableCellEditorComponent(JTable table,
                Object value, boolean isSelected, int row, int column) {
            this.row = row;
            this.column = column;

            textField.setBorder(normalBorder);

            return super.getTableCellEditorComponent(table, value, isSelected,
                    row, column);
        }

        public boolean stopCellEditing() {
            if (row < 0 || column < 0 || trackList == null) {
                return super.stopCellEditing();
            }

            Column c = trackList.getTrackColumn(column);

            if (!c.isValid(textField.getText())) {
                textField.setBorder(errorBorder);
                return false;
            }

            return super.stopCellEditing();
        }

    }

    /* ACTION CLASSES */

    class IncrementAction extends AbstractAction {

        public IncrementAction() {
            super("increment-column-value");
            putValue(Action.SHORT_DESCRIPTION, "Increment Value");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_UP, BlueSystem.getMenuShortcutKey()));
        }

        public void actionPerformed(ActionEvent e) {
            if (trackList == null) {
                return;
            }

            int col = table.getSelectedColumn();
            int row = table.getSelectedRow();

            String val = (String) table.getValueAt(row, col);

            if (val == null || val.equals("") || val.equals("-")
                    || val.equals("OFF")) {
                return;
            }

            Column c = trackList.getTrackColumn(col);
            String newVal = c.getIncrementValue(val);

            table.setValueAt(newVal, row, col);
            trackList.fireRowChanged(row);
        }
    }

    class DecrementAction extends AbstractAction {

        public DecrementAction() {
            super("decrement-column-value");
            putValue(Action.SHORT_DESCRIPTION, "Decrement Value");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_DOWN, BlueSystem.getMenuShortcutKey()));
        }

        public void actionPerformed(ActionEvent e) {
            if (trackList == null) {
                return;
            }

            int col = table.getSelectedColumn();
            int row = table.getSelectedRow();

            String val = (String) table.getValueAt(row, col);

            if (val == null || val.equals("") || val.equals("-")
                    || val.equals("OFF")) {
                return;
            }

            Column c = trackList.getTrackColumn(col);
            String newVal = c.getDecrementValue(val);

            table.setValueAt(newVal, row, col);
            trackList.fireRowChanged(row);
        }
    }

    class TieAction extends AbstractAction {

        public TieAction() {
            super("set-tied");
            putValue(Action.SHORT_DESCRIPTION, "Toggle Tied-Note");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_T, BlueSystem.getMenuShortcutKey()));
        }

        public void actionPerformed(ActionEvent e) {
            if (trackList == null) {
                return;
            }

            int col = table.getSelectedColumn();
            int row = table.getSelectedRow();

            Track track = trackList.getTrackForColumn(col);

            TrackerNote currentNote = track.getTrackerNote(row);

            if (currentNote.isActive() && !currentNote.isOff()) {
                currentNote.setTied(!currentNote.isTied());
                trackList.fireRowChanged(row);
            }
        }
    }

    class SpaceBarAction extends AbstractAction {

        public SpaceBarAction() {
            super("spacebar-action");
            putValue(Action.SHORT_DESCRIPTION, "Spacebar Action");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_SPACE, InputEvent.CTRL_DOWN_MASK));
        }

        public void actionPerformed(ActionEvent e) {
            if (trackList == null) {
                return;
            }

            int col = table.getSelectedColumn();
            int row = table.getSelectedRow();

            Track track = trackList.getTrackForColumn(col);

            TrackerNote currentNote = track.getTrackerNote(row);

            if (currentNote.isOff() || currentNote.isActive()) {
                currentNote.clear();
                trackList.fireRowChanged(row);
                return;
            }

            TrackerNote previousNote = null;

            for (int i = row - 1; i >= 0; i--) {
                TrackerNote temp = track.getTrackerNote(i);

                if (temp.isActive()) {
                    previousNote = temp;
                    break;
                }
            }

            if (previousNote != null) {
                currentNote.copyValues(previousNote);
                trackList.fireRowChanged(row);
            }
        }
    }

    class NoteOffAction extends AbstractAction {

        public NoteOffAction() {
            super("note-off-action");
            putValue(Action.SHORT_DESCRIPTION, "Note-Off Action");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_SPACE, InputEvent.CTRL_DOWN_MASK
                            | InputEvent.SHIFT_DOWN_MASK));
        }

        public void actionPerformed(ActionEvent e) {
            if (trackList == null) {
                return;
            }

            int col = table.getSelectedColumn();
            int row = table.getSelectedRow();

            Track track = trackList.getTrackForColumn(col);

            TrackerNote currentNote = track.getTrackerNote(row);

            boolean isOff = currentNote.isOff();
            currentNote.clear();
            currentNote.setOff(!isOff);

            trackList.fireRowChanged(row);

        }
    }

    class CutAction extends AbstractAction {

        public CutAction() {
            super("Cut");
            putValue(Action.SHORT_DESCRIPTION, "Cut");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_X, BlueSystem.getMenuShortcutKey()));
        }

        public void actionPerformed(ActionEvent e) {
            int selectedCol = table.getColumnModel().getSelectionModel()
                    .getLeadSelectionIndex();

            if (selectedCol < 0) {
                return;
            }

            Track selectedTrack = trackList.getTrackForColumn(selectedCol);

            if (selectedTrack == null) {
                return;
            }

            noteCopyBuffer.clear();

            int start = table.getSelectedRow();

            for (int i = 0; i < table.getSelectedRowCount(); i++) {
                TrackerNote note = selectedTrack.getTrackerNote(start + i);
                noteCopyBuffer.add(ObjectUtilities.clone(note));
                note.clear();
            }

            table.repaint();

        }
    }

    class CopyAction extends AbstractAction {

        public CopyAction() {
            super("Copy");
            putValue(Action.SHORT_DESCRIPTION, "Copy");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_C, BlueSystem.getMenuShortcutKey()));
        }

        public void actionPerformed(ActionEvent e) {
            int selectedCol = table.getColumnModel().getSelectionModel()
                    .getLeadSelectionIndex();

            if (selectedCol < 0) {
                return;
            }

            Track selectedTrack = trackList.getTrackForColumn(selectedCol);

            if (selectedTrack == null) {
                return;
            }

            noteCopyBuffer.clear();

            int start = table.getSelectedRow();

            for (int i = 0; i < table.getSelectedRowCount(); i++) {
                TrackerNote note = selectedTrack.getTrackerNote(start + i);
                noteCopyBuffer.add(ObjectUtilities.clone(note));
            }
        }
    }

    class PasteAction extends AbstractAction {

        public PasteAction() {
            super("Paste");
            putValue(Action.SHORT_DESCRIPTION, "Paste");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_V, BlueSystem.getMenuShortcutKey()));
        }

        public void actionPerformed(ActionEvent e) {
            int selectedCol = table.getColumnModel().getSelectionModel()
                    .getLeadSelectionIndex();
            int selectedRow = table.getSelectionModel().getLeadSelectionIndex();

            Track selectedTrack = trackList.getTrackForColumn(selectedCol);

            if (selectedTrack == null || noteCopyBuffer.size() == 0) {
                return;
            }

            if (selectedRow + noteCopyBuffer.size() > selectedTrack
                    .getNumSteps()) {
                JOptionPane.showMessageDialog(SwingUtilities
                        .getRoot(TracksEditor.this),
                        "Not enough steps to paste", "Error",
                        JOptionPane.ERROR_MESSAGE);
                return;
            }

            TrackerNote firstNote = (TrackerNote) noteCopyBuffer.get(0);

            if (selectedTrack.getNumColumns() != firstNote.getNumFields()) {
                JOptionPane
                        .showMessageDialog(
                                SwingUtilities.getRoot(TracksEditor.this),
                                "Column does not have the same number of fields as copy buffer notes.",
                                "Error", JOptionPane.ERROR_MESSAGE);
                return;
            }

            for (int i = 0; i < noteCopyBuffer.size(); i++) {
                TrackerNote bufferNote = (TrackerNote) noteCopyBuffer.get(i);
                TrackerNote temp = selectedTrack
                        .getTrackerNote(i + selectedRow);
                temp.copyValues(bufferNote);
            }

            table.repaint();
        }
    }

    class InsertAction extends AbstractAction {

        public InsertAction() {
            super("Insert");
            putValue(Action.SHORT_DESCRIPTION, "Insert");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_INSERT, 0));
        }

        public void actionPerformed(ActionEvent e) {
            int selectedCol = table.getColumnModel().getSelectionModel()
                    .getLeadSelectionIndex();

            if (selectedCol < 0) {
                return;
            }

            Track selectedTrack = trackList.getTrackForColumn(selectedCol);

            if (selectedTrack == null) {
                return;
            }

            int start = table.getSelectedRow();

            if (start < table.getRowCount() - 1) {
                selectedTrack.insertNote(start);
            }

            table.repaint();
        }
    }

    class BackSpaceAction extends AbstractAction {

        public BackSpaceAction() {
            super("BackSpace");
            putValue(Action.SHORT_DESCRIPTION, "BackSpace");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_BACK_SPACE, 0));
        }

        public void actionPerformed(ActionEvent e) {
            int selectedCol = table.getColumnModel().getSelectionModel()
                    .getLeadSelectionIndex();

            if (selectedCol < 0) {
                return;
            }

            Track selectedTrack = trackList.getTrackForColumn(selectedCol);

            if (selectedTrack == null) {
                return;
            }

            int start = table.getSelectedRow();

            for (int i = 0; i < table.getSelectedRowCount(); i++) {
                selectedTrack.removeNote(start);
            }

            table.repaint();
        }
    }

    class DeleteAction extends AbstractAction {

        public DeleteAction() {
            super("Delete");
            putValue(Action.SHORT_DESCRIPTION, "Delete");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_DELETE, 0));
        }

        public void actionPerformed(ActionEvent e) {
            int selectedCol = table.getColumnModel().getSelectionModel()
                    .getLeadSelectionIndex();

            if (selectedCol < 0) {
                return;
            }

            Track selectedTrack = trackList.getTrackForColumn(selectedCol);

            if (selectedTrack == null) {
                return;
            }

            int start = table.getSelectedRow();

            for (int i = 0; i < table.getSelectedRowCount(); i++) {
                TrackerNote note = selectedTrack.getTrackerNote(start + i);
                note.clear();
            }

            if (start < table.getRowCount() - 2) {
                table.getSelectionModel().setSelectionInterval(start + 1,
                        start + 1);
            }

            table.repaint();
        }
    }

    class KeyboardNoteAction extends AbstractAction {

        private final int value;

        public KeyboardNoteAction(int key, int value) {
            super("keyboard-action-" + key);
            putValue(Action.SHORT_DESCRIPTION, "keyboard-action-" + key);
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(key, 0));
            this.value = value;
        }

        public void actionPerformed(ActionEvent e) {
            if (table.getSelectedRowCount() > 1) {
                return;
            }

            int selectedCol = table.getColumnModel().getSelectionModel()
                    .getLeadSelectionIndex();

            if (selectedCol < 0) {
                return;
            }

            Column c = trackList.getTrackColumn(selectedCol);

            int row = table.getSelectedRow();

            if (c == null) {
                return;
            }

            String value = null;
            int val, oct, pch;

            switch (c.getType()) {
                case Column.TYPE_PCH:
                    val = ((8 + keyboardOctave) * 12) + this.value;

                    oct = val / 12;
                    pch = val % 12;

                    String pchVal = Integer.toString(pch);

                    if (pch < 10) {
                        pchVal = "0" + pchVal;
                    }

                    value = oct + "." + pchVal;
                    break;
                case Column.TYPE_BLUE_PCH:
                    val = ((8 + keyboardOctave) * 12) + this.value;

                    oct = val / 12;
                    pch = val % 12;

                    value = oct + "." + pch;

                    break;
                case Column.TYPE_MIDI:
                    value = Integer.toString(60 + (keyboardOctave * 12)
                            + this.value);
                    break;
            }

            if (value == null) {
                return;
            }

            if (row < table.getRowCount() - 2) {
                table.getSelectionModel()
                        .setSelectionInterval(row + 1, row + 1);
            }

            trackList.setValueAt(value, row, selectedCol);
            trackList.fireRowChanged(row);

        }

    }
}
