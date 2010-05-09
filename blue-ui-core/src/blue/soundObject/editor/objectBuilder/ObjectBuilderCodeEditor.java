/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

package blue.soundObject.editor.objectBuilder;

import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Arrays;

import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.ActionMap;
import javax.swing.BoxLayout;
import javax.swing.InputMap;
import javax.swing.JCheckBox;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JTextField;
import javax.swing.KeyStroke;
import javax.swing.SwingConstants;
import javax.swing.border.EmptyBorder;
import javax.swing.event.DocumentEvent;
import javax.swing.event.UndoableEditEvent;
import javax.swing.event.UndoableEditListener;
import javax.swing.text.BadLocationException;
import javax.swing.undo.UndoManager;
import javax.swing.undo.UndoableEdit;

import skt.swing.SwingUtil;
import blue.BlueSystem;
import blue.actions.RedoAction;
import blue.actions.UndoAction;
import blue.components.EditEnabledCheckBox;
import blue.event.EditModeListener;
import blue.event.SimpleDocumentListener;
import blue.gui.BlueEditorPane;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.soundObject.ObjectBuilder;
import blue.undo.NoStyleChangeUndoManager;
import blue.utility.GUI;

public class ObjectBuilderCodeEditor extends JComponent {

    BlueEditorPane codePane = new BlueEditorPane();

    ObjectBuilder objBuilder = new ObjectBuilder();

    EditEnabledCheckBox editBox = new EditEnabledCheckBox();

    JCheckBox isExternalBox = new JCheckBox("External:");

    JTextField commandLineText = new JTextField();

    UndoManager undo = new NoStyleChangeUndoManager();

    private boolean isUpdating = false;

    public ObjectBuilderCodeEditor() {
        isExternalBox.setHorizontalTextPosition(SwingConstants.LEFT);
        isExternalBox.setFocusable(false);
        isExternalBox.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                boolean selected = isExternalBox.isSelected();

                commandLineText.setEnabled(selected);

                if (objBuilder != null) {
                    objBuilder.setExternal(selected);

                    isUpdating = true;

                    setCodeSyntaxType(objBuilder);

                    isUpdating = false;
                }
            }

        });

        commandLineText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
                    public void documentChanged(DocumentEvent e) {
                        if (objBuilder != null) {
                            objBuilder
                                    .setCommandLine(commandLineText.getText());
                        }
                    }
                });

        editBox.addEditModeListener(new EditModeListener() {

            public void setEditing(boolean isEditing) {
                codePane.setEnabled(isEditing);

                if (objBuilder != null) {
                    objBuilder.setEditEnabled(isEditing);
                }
            }
        });

        codePane.addPropertyChangeListener(new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                if (isUpdating) {
                    return;
                }

                if (evt.getPropertyName().equals("syntaxType")) {
                    String type = (String) evt.getNewValue();
                    objBuilder.setSyntaxType(type);
                }
            }

        });

        codePane.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
                    public void documentChanged(DocumentEvent e) {
                        if (objBuilder != null) {
                            objBuilder.setCode(codePane.getText());
                        }
                    }
                });

        JPanel topBar = new JPanel();
        topBar.setBorder(new EmptyBorder(3, 3, 3, 3));

        BoxLayout boxLayout = new BoxLayout(topBar, BoxLayout.X_AXIS);
        topBar.setLayout(boxLayout);

        JLabel commandLabel = new JLabel(BlueSystem
                .getString("programOptions.commandLine"));
        commandLabel.setBorder(new EmptyBorder(0, 3, 0, 0));

        isExternalBox.setBorder(new EmptyBorder(0, 3, 0, 3));

        topBar.add(commandLabel);
        topBar.add(commandLineText);
        topBar.add(isExternalBox);
        topBar.add(editBox);

        this.setLayout(new BorderLayout());
        this.add(topBar, BorderLayout.NORTH);
        this.add(codePane, BorderLayout.CENTER);

        UndoableEditListener ul = new UndoableEditListener() {

            public void undoableEditHappened(UndoableEditEvent e) {
                UndoableEdit event = e.getEdit();

                // if (event.getPresentationName().equals("style change")) {
                undo.addEdit(event);
                // } else {
                // undo.addEdit(event);
                // }
            }

        };

        codePane.getDocument().addUndoableEditListener(ul);

        Action[] undoActions = new Action[] { new UndoAction(undo),
                new RedoAction(undo) };

        SwingUtil.installActions(codePane, undoActions);

        undo.setLimit(1000);

        initActions();

        codePane.setEnabled(false);
    }

    public void codeComplete(BlueEditorPane bPane) {
        BSBGraphicInterface bsbGr = objBuilder.getGraphicInterface();

        if (bsbGr.size() == 0) {
            return;
        }

        ArrayList matches = new ArrayList();

        for (int i = 0; i < bsbGr.size(); i++) {
            BSBObject bsbObj = bsbGr.getBSBObject(i);
            String objName = bsbObj.getObjectName();

            if (objName != null && !objName.equals("")) {
                matches.addAll(Arrays.asList(bsbObj.getReplacementKeys()));
            }
        }

        if (matches.size() == 0) {
            return;
        }

        Object selectedValue = JOptionPane.showInputDialog(null, BlueSystem
                .getString("instrument.bsb.codeComplete.message"), BlueSystem
                .getString("instrument.bsb.codeComplete.title"),
                JOptionPane.INFORMATION_MESSAGE, null, matches.toArray(),
                matches.get(0));

        if (selectedValue == null) {
            return;
        }

        int position = bPane.getCaretPosition();

        try {
            bPane.getDocument().insertString(position,
                    "<" + selectedValue.toString() + ">", null);
        } catch (BadLocationException e) {
            // should never occur
            e.printStackTrace();
        }

    }

    /**
     * 
     */
    private void initActions() {

        AbstractAction codeCompleteAction = new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (codePane.isEditable()) {
                    codeComplete((BlueEditorPane) e.getSource());
                }
            }
        };

        KeyStroke codeCompleteKeyStroke = KeyStroke.getKeyStroke(
                KeyEvent.VK_SPACE, BlueSystem.getMenuShortcutKey()
                        | InputEvent.SHIFT_DOWN_MASK, false);

        InputMap inputMap = codePane.getInputMap(WHEN_FOCUSED);
        ActionMap actionMap = codePane.getActionMap();

        inputMap.put(codeCompleteKeyStroke, "bsbCodeComplete");

        actionMap.put("bsbCodeComplete", codeCompleteAction);

        this.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(
                KeyStroke.getKeyStroke(KeyEvent.VK_E, BlueSystem
                        .getMenuShortcutKey()), "switchEditMode");
        this.getActionMap().put("switchEditMode", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                editBox.doClick();
            }
        });
    }

    /**
     * @param bsb
     */
    public void editObjectBuilder(ObjectBuilder objBuilder) {
        this.objBuilder = null;

        isUpdating = true;

        setCodeSyntaxType(objBuilder);

        codePane.setText(objBuilder.getCode());
        codePane.setCaretPosition(0);

        if (objBuilder != null) {
            if (editBox.isSelected() != objBuilder.isEditEnabled()) {
                editBox.doClick();
            }
        } else {
            editBox.setSelected(false);
        }

        isExternalBox.setSelected(objBuilder.isExternal());
        commandLineText.setEnabled(objBuilder.isExternal());
        commandLineText.setText(objBuilder.getCommandLine());

        this.objBuilder = objBuilder;

        undo.discardAllEdits();

        isUpdating = false;
    }

    private void setCodeSyntaxType(ObjectBuilder objBuilder) {
        if (objBuilder.isExternal()) {
            codePane.setSyntaxType(objBuilder.getSyntaxType());
        } else {
            codePane.setSyntaxType("Python");
        }

        codePane.setSyntaxSettable(objBuilder.isExternal());

        codePane.repaint();
    }

    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();
        ObjectBuilderCodeEditor codeEditor = new ObjectBuilderCodeEditor();
        codeEditor.editObjectBuilder(new ObjectBuilder());
        GUI.showComponentAsStandalone(codeEditor, "ObjectBuilder Code Editor",
                true);
    }

}
