/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
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

package blue.ui.core.score;

import blue.BlueData;
import blue.Marker;
import blue.MarkersList;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.time.TimeBase;
import blue.time.TimeContext;
import blue.time.TimeContextManager;
import blue.time.TimePosition;
import blue.time.TimeUtilities;
import blue.ui.core.time.TimeUnitTextField;
import blue.ui.utilities.UiUtilities;
import java.awt.Component;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import javax.swing.AbstractCellEditor;
import javax.swing.AbstractAction;
import javax.swing.DefaultCellEditor;
import javax.swing.DefaultComboBoxModel;
import javax.swing.JComboBox;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.TableCellEditor;
import org.netbeans.api.settings.ConvertAsProperties;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.util.NbBundle;
import org.openide.windows.TopComponent;

/**
 * Top component which displays something.
 */
@ConvertAsProperties(
    dtd="-//blue.ui.core.score//Markers//EN",
    autostore=false
)
@TopComponent.Description(
        preferredID = "MarkersTopComponent",
        //iconBase="SET/PATH/TO/ICON/HERE", 
        persistenceType = TopComponent.PERSISTENCE_ALWAYS
)
@TopComponent.Registration(mode = "properties", openAtStartup = false)
@ActionID(category = "Window", id = "blue.ui.core.score.MarkersTopComponent")
@ActionReferences({
    @ActionReference(path = "Menu/Window", position = 500, separatorBefore = 490),
    @ActionReference(path = "Shortcuts", name = "S-F4")
})
@TopComponent.OpenActionRegistration(
        displayName = "#CTL_MarkersAction",
        preferredID = "MarkersTopComponent"
)
@NbBundle.Messages({
    "CTL_MarkersAction=Markers List",
    "CTL_MarkersTopComponent=Markers",
    "HINT_MarkersTopComponent=This is a Markers window"
})
public final class MarkersTopComponent extends TopComponent {

    private static MarkersTopComponent instance;
    private MarkersPopup popup = null;
    private BlueData data = null;

    public MarkersTopComponent() {
        initComponents();
        setName(NbBundle.getMessage(MarkersTopComponent.class, "CTL_MarkersTopComponent"));
        setToolTipText(NbBundle.getMessage(MarkersTopComponent.class, "HINT_MarkersTopComponent"));
//        setIcon(ImageUtilities.loadImage(ICON_PATH, true));

        BlueProjectManager.getInstance().addPropertyChangeListener((PropertyChangeEvent evt) -> {
            if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
                reinitialize();
            }
        });

        reinitialize();
    }

    protected void reinitialize() {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        BlueData currentData = null;
        if (project != null) {
            currentData = project.getData();
        }

        this.data = currentData;

        markersTable.setModel(currentData.getMarkersList());
        
        // Column 0: TimeBase - combo box editor
        JComboBox<TimeBase> timeBaseCombo = new JComboBox<>(
                new DefaultComboBoxModel<>(TimeBase.values()));
        markersTable.getColumnModel().getColumn(0).setCellEditor(
                new DefaultCellEditor(timeBaseCombo));
        
        // Column 1: Time - custom editor and renderer
        markersTable.getColumnModel().getColumn(1).setCellEditor(new MarkerTimeCellEditor());
        markersTable.getColumnModel().getColumn(1).setCellRenderer(new MarkerTimeRenderer());
        
        markersTable.getColumnModel().getColumn(0).setPreferredWidth(70);
        markersTable.getColumnModel().getColumn(1).setPreferredWidth(100);
        markersTable.getColumnModel().getColumn(2).setPreferredWidth(120);
        
        // Right-click popup on TimeBase column header
        markersTable.getTableHeader().addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                if (UiUtilities.isRightMouseButton(e)) {
                    int col = markersTable.columnAtPoint(e.getPoint());
                    if (col == 0) {
                        showTimeBaseHeaderPopup(e);
                    }
                }
            }
        });
    }

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jScrollPane1 = new javax.swing.JScrollPane();
        markersTable = new javax.swing.JTable();

        markersTable.setModel(new javax.swing.table.DefaultTableModel(
            new Object [][] {
                {null, null, null, null},
                {null, null, null, null},
                {null, null, null, null},
                {null, null, null, null}
            },
            new String [] {
                "Title 1", "Title 2", "Title 3", "Title 4"
            }
        ));
        markersTable.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mousePressed(java.awt.event.MouseEvent evt) {
                markersTableMousePressed(evt);
            }
        });
        jScrollPane1.setViewportView(markersTable);

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jScrollPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 291, Short.MAX_VALUE)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jScrollPane1, javax.swing.GroupLayout.DEFAULT_SIZE, 300, Short.MAX_VALUE)
        );
    }// </editor-fold>//GEN-END:initComponents

    private void markersTableMousePressed(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_markersTableMousePressed
         if (UiUtilities.isRightMouseButton(evt)) {
            if (popup == null) {
                popup = new MarkersPopup();
            }

            popup.show(markersTable, evt.getX(), evt.getY());
        }
    }//GEN-LAST:event_markersTableMousePressed

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JScrollPane jScrollPane1;
    private javax.swing.JTable markersTable;
    // End of variables declaration//GEN-END:variables

    @Override
    public void componentOpened() {
        // TODO add custom code on component opening
    }

    @Override
    public void componentClosed() {
        // TODO add custom code on component closing
    }

    void writeProperties(java.util.Properties p) {
        // better to version settings since initial version as advocated at
        // http://wiki.apidesign.org/wiki/PropertyFiles
        p.setProperty("version", "1.0");
        // TODO store your settings
    }

    void readProperties(java.util.Properties p) {
        String version = p.getProperty("version");
        // TODO read your settings according to their version
    }

    class MarkersPopup extends JPopupMenu {

        public MarkersPopup() {
            this.add(new SetStartTimeAction());
            this.add(new DeleteMarkerAction());
        }

        @Override
        public void show(Component invoker, int x, int y) {
            if (markersTable.getSelectedRow() < 0) {
                return;
            }
            super.show(invoker, x, y);
        }

        class SetStartTimeAction extends AbstractAction {

            public SetStartTimeAction() {
                super("Set Start Time to Marker Time");
            }

            @Override
            public void actionPerformed(ActionEvent e) {
                int index = markersTable.getSelectedRow();
                Marker m = data.getMarkersList().getMarker(index);
                TimeContext ctx = TimeContextManager.getContext();
                data.setRenderStartTime(m.getTime().toBeats(ctx));
            }
        }

        class DeleteMarkerAction extends AbstractAction {

            public DeleteMarkerAction() {
                super("Delete Marker");
            }

            @Override
            public void actionPerformed(ActionEvent e) {
                int index = markersTable.getSelectedRow();
                data.getMarkersList().removeMarker(index);
            }
        }

    }

    private void showTimeBaseHeaderPopup(MouseEvent e) {
        if (data == null) return;
        JPopupMenu headerPopup = new JPopupMenu();
        for (TimeBase tb : TimeBase.values()) {
            JMenuItem item = new JMenuItem("Set All to " + tb.name());
            item.addActionListener(evt -> {
                MarkersList markers = data.getMarkersList();
                TimeContext ctx = TimeContextManager.hasContext()
                        ? TimeContextManager.getContext()
                        : new TimeContext();
                for (int i = 0; i < markers.size(); i++) {
                    Marker m = markers.getMarker(i);
                    if (m.getTime().getTimeBase() != tb) {
                        m.setTime(TimeUtilities.convertTimePosition(
                                m.getTime(), tb, ctx));
                    }
                }
            });
            headerPopup.add(item);
        }
        headerPopup.show(e.getComponent(), e.getX(), e.getY());
    }

    private static final class MarkerTimeRenderer extends DefaultTableCellRenderer {

        @Override
        public Component getTableCellRendererComponent(JTable table, Object value,
                boolean isSelected, boolean hasFocus, int row, int column) {
            super.getTableCellRendererComponent(table, value, isSelected, hasFocus, row, column);
            if (value instanceof TimePosition tp) {
                setText(TimeUnitTextField.format(tp, tp.getTimeBase()));
            }
            return this;
        }
    }

    private final class MarkerTimeCellEditor extends AbstractCellEditor implements TableCellEditor {

        private final JTextField textField = new JTextField();
        private TimePosition previousValue = TimePosition.beats(0.0);
        private TimeBase timeBase = TimeBase.BEATS;

        @Override
        public Object getCellEditorValue() {
            try {
                return TimeUnitTextField.parse(textField.getText(), timeBase);
            } catch (RuntimeException ex) {
                return previousValue;
            }
        }

        @Override
        public Component getTableCellEditorComponent(JTable table, Object value,
                boolean isSelected, int row, int column) {
            int modelRow = table.convertRowIndexToModel(row);
            Marker marker = data.getMarkersList().getMarker(modelRow);
            previousValue = marker.getTime();
            timeBase = previousValue.getTimeBase();
            textField.setText(TimeUnitTextField.format(previousValue, timeBase));
            return textField;
        }
    }
}
