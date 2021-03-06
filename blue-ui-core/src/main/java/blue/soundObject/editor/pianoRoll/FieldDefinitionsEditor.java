/*
 * blue - object composition environment for csound
 * Copyright (c) 2020 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.editor.pianoRoll;

import blue.BlueSystem;
import blue.soundObject.PianoRoll;
import blue.soundObject.editor.pianoRoll.undo.UndoablePropertyEdit;
import blue.soundObject.pianoRoll.Field;
import blue.soundObject.pianoRoll.FieldDef;
import blue.soundObject.pianoRoll.FieldType;
import blue.soundObject.pianoRoll.PianoNote;
import java.awt.event.KeyEvent;
import java.util.EventObject;
import java.util.HashMap;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import javafx.collections.ObservableList;
import javax.swing.DefaultCellEditor;
import javax.swing.JComboBox;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.table.TableCellEditor;
import javax.swing.table.TableColumn;
import javax.swing.undo.UndoManager;

/**
 *
 * @author stevenyi
 */
public class FieldDefinitionsEditor extends javax.swing.JPanel {

    private ObservableList<FieldDef> fieldDefinitions;
    private final UndoManager undoManager;
    private PianoRoll pianoRoll;
    private final JTable fieldDefinitionTable;

    /**
     * Creates new form FieldDefinitionsEditor
     */
    public FieldDefinitionsEditor(UndoManager undoManager) {
        this.undoManager = undoManager;
        initComponents();
        fieldDefinitionTable = new JTable() {
            @Override
            public TableCellEditor getDefaultEditor(Class<?> columnClass) {
                return new DefaultCellEditor(new JTextField()) {
                    @Override
                    public boolean isCellEditable(EventObject anEvent) {
                        if (anEvent instanceof KeyEvent) {
                            int shortcutKey = BlueSystem.getMenuShortcutKey();
                            KeyEvent ke = (KeyEvent) anEvent;
                            if ((ke.getKeyCode() == KeyEvent.VK_Z || ke.getKeyCode() == KeyEvent.VK_Y)
                                    && (ke.getModifiers() & shortcutKey) == shortcutKey) {
                                return false;
                            }
                        }

                        return super.isCellEditable(anEvent);
                    }
                };
            }

        };
        fieldDefinitionTable.setFillsViewportHeight(true);
        tableScrollPane.setViewportView(fieldDefinitionTable);
    }

    public void editPianoRoll(PianoRoll p) {

        ObservableList<FieldDef> fieldDefinitions = p.getFieldDefinitions();
        this.pianoRoll = p;
        this.fieldDefinitions = fieldDefinitions;

        var oldModel = fieldDefinitionTable.getModel();
        if (oldModel instanceof FieldDefinitionsTableModel) {
            ((FieldDefinitionsTableModel) oldModel).clearListener();
        }

        var model = new FieldDefinitionsTableModel(p, fieldDefinitions, undoManager);
        fieldDefinitionTable.setModel(model);

        var colModel = fieldDefinitionTable.getColumnModel();
        TableColumn fieldTypeColumn = colModel.getColumn(1);

        JComboBox<FieldType> comboBox = new JComboBox<>();
        comboBox.addItem(FieldType.CONTINUOUS);
        comboBox.addItem(FieldType.DISCRETE);
        fieldTypeColumn.setCellEditor(new DefaultCellEditor(comboBox) {
            @Override
            public boolean isCellEditable(EventObject anEvent) {
                if (anEvent instanceof KeyEvent) {
                    int shortcutKey = BlueSystem.getMenuShortcutKey();
                    KeyEvent ke = (KeyEvent) anEvent;
                    if ((ke.getKeyCode() == KeyEvent.VK_Z || ke.getKeyCode() == KeyEvent.VK_Y)
                            && (ke.getModifiers() & shortcutKey) == shortcutKey) {
                        return false;
                    }
                }

                return super.isCellEditable(anEvent);
            }
        });
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    @SuppressWarnings("unchecked")
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        addButton = new javax.swing.JButton();
        removeButton = new javax.swing.JButton();
        tableScrollPane = new javax.swing.JScrollPane();

        org.openide.awt.Mnemonics.setLocalizedText(addButton, org.openide.util.NbBundle.getMessage(FieldDefinitionsEditor.class, "FieldDefinitionsEditor.addButton.text")); // NOI18N
        addButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                addButtonActionPerformed(evt);
            }
        });

        org.openide.awt.Mnemonics.setLocalizedText(removeButton, org.openide.util.NbBundle.getMessage(FieldDefinitionsEditor.class, "FieldDefinitionsEditor.removeButton.text")); // NOI18N
        removeButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                removeButtonActionPerformed(evt);
            }
        });

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(addButton)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(removeButton)
                .addContainerGap(274, Short.MAX_VALUE))
            .addComponent(tableScrollPane)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addComponent(tableScrollPane, javax.swing.GroupLayout.DEFAULT_SIZE, 187, Short.MAX_VALUE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(addButton)
                    .addComponent(removeButton))
                .addContainerGap())
        );
    }// </editor-fold>//GEN-END:initComponents

    private void addButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_addButtonActionPerformed
        String fieldName = "FIELD";
        Set<String> fieldNames = fieldDefinitions.stream()
                .map(fd -> fd.getFieldName())
                .collect(Collectors.toSet());
        int index = 1;
        while (fieldNames.contains(fieldName)) {
            fieldName = "FIELD" + index;
            index++;
        }
        FieldDef fd = new FieldDef();
        fd.setFieldName(fieldName);

        // add field definition
        fieldDefinitions.add(fd);
        var row = fieldDefinitions.indexOf(fd);

        // get newly created fields from notes
        final var fieldMap = new HashMap<PianoNote, Optional<Field>>();

        for (var note : pianoRoll.getNotes()) {
            fieldMap.put(note, note.getField(fd));
        }

        undoManager.addEdit(new UndoablePropertyEdit<Boolean>(v -> {
            if (v) {
                for (var entry : fieldMap.entrySet()) {
                    var fields = entry.getKey().getFields();
                    entry.getValue().ifPresent(f -> fields.add(f));
                }
                fieldDefinitions.add(row, fd);
            } else {
                fieldDefinitions.remove(fd);
            }
        }, false, true));
    }//GEN-LAST:event_addButtonActionPerformed

    private void removeButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_removeButtonActionPerformed
        var row = fieldDefinitionTable.getSelectedRow();

        if (row >= 0) {
            final var fd = fieldDefinitions.get(row);

            final var fieldMap = new HashMap<PianoNote, Optional<Field>>();

            for (var note : pianoRoll.getNotes()) {
                fieldMap.put(note, note.getField(fd));
            }

            fieldDefinitions.remove(fd);

            undoManager.addEdit(new UndoablePropertyEdit<Boolean>(v -> {
                if (v) {
                    fieldDefinitions.remove(fd);
                } else {
                    for (var entry : fieldMap.entrySet()) {
                        var fields = entry.getKey().getFields();
                        entry.getValue().ifPresent(f -> fields.add(f));
                    }
                    fieldDefinitions.add(row, fd);
                }
            }, false, true));
        }
    }//GEN-LAST:event_removeButtonActionPerformed


    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton addButton;
    private javax.swing.JButton removeButton;
    private javax.swing.JScrollPane tableScrollPane;
    // End of variables declaration//GEN-END:variables
}
