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

import blue.BlueSystem;
import blue.components.EditEnabledCheckBox;
import blue.orchestra.editor.blueSynthBuilder.BSBCompletionProvider;
import blue.soundObject.ObjectBuilder;
import blue.soundObject.ObjectBuilder.LanguageType;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.SimpleDocumentListener;
import blue.utility.GUI;
import java.awt.BorderLayout;
import java.awt.event.ItemEvent;
import javax.swing.BoxLayout;
import javax.swing.JComboBox;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextField;
import javax.swing.border.EmptyBorder;
import javax.swing.event.DocumentEvent;
import javax.swing.undo.UndoManager;
import org.openide.awt.UndoRedo;

public class ObjectBuilderCodeEditor extends JComponent {

    //FIXME - maybe need to recreate for each syntax type?
    MimeTypeEditorComponent codePane = new MimeTypeEditorComponent("text/x-object-builder");

    BSBCompletionProvider completionProvider = new BSBCompletionProvider();

    ObjectBuilder objBuilder = null;

    EditEnabledCheckBox editBox = new EditEnabledCheckBox();

    JComboBox<LanguageType> languageTypeCombo = new JComboBox<>(
            LanguageType.values()
    );

    JTextField commandLineText = new JTextField();

    UndoManager undo = new UndoRedo.Manager();

    public ObjectBuilderCodeEditor() {
        languageTypeCombo.addItemListener((e) -> {
            if (e.getStateChange() == ItemEvent.SELECTED) {
                LanguageType langType = (LanguageType) e.getItem();
                commandLineText.setEnabled(e.getItem() == LanguageType.EXTERNAL);
                if (objBuilder != null) {
                    objBuilder.setLanguageType(langType);
                }

//                codePane.setMimeType(langType.getMimeType());
//                codePane.getJEditorPane().putClientProperty("bsb-completion-provider",
//                        completionProvider);
            }
        });
        commandLineText.setEnabled(false);
//        isExternalBox.setHorizontalTextPosition(SwingConstants.LEFT);
//        isExternalBox.setFocusable(false);
//        isExternalBox.addActionListener((ActionEvent e) -> {
//            boolean selected = isExternalBox.isSelected();
//            
//            commandLineText.setEnabled(selected);
//            
//            if (objBuilder != null) {
//                objBuilder.setExternal(selected);
//                
//                isUpdating = true;
//                
////                    setCodeSyntaxType(objBuilder);
//
//isUpdating = false;
//            }
//        });

        commandLineText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
            @Override
            public void documentChanged(DocumentEvent e) {
                if (objBuilder != null) {
                    objBuilder
                            .setCommandLine(commandLineText.getText());
                }
            }
        });

        editBox.addEditModeListener((boolean isEditing) -> {
            codePane.getJEditorPane().setEnabled(isEditing);

            if (objBuilder != null) {
                objBuilder.setEditEnabled(isEditing);
            }
        });

//        codePane.addPropertyChangeListener(new PropertyChangeListener() {
//
//            public void propertyChange(PropertyChangeEvent evt) {
//                if (isUpdating) {
//                    return;
//                }
//
//                if (evt.getPropertyName().equals("syntaxType")) {
//                    String type = (String) evt.getNewValue();
//                    objBuilder.setSyntaxType(type);
//                }
//            }
//
//        });
        codePane.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
            @Override
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

//        isExternalBox.setBorder(new EmptyBorder(0, 3, 0, 3));
//        .setB
        topBar.add(commandLabel);
        topBar.add(commandLineText);
        topBar.add(languageTypeCombo);
        topBar.add(editBox);

        this.setLayout(new BorderLayout());
        this.add(topBar, BorderLayout.NORTH);
        this.add(codePane, BorderLayout.CENTER);

        codePane.getDocument().addUndoableEditListener(undo);
        codePane.setUndoManager(undo);
        codePane.getJEditorPane().putClientProperty("bsb-completion-provider",
                completionProvider);
        codePane.getJEditorPane().setEnabled(false);

        undo.setLimit(1000);
    }

    /**
     * @param bsb
     */
    public void editObjectBuilder(ObjectBuilder objBuilder) {
        this.objBuilder = null;

//        setCodeSyntaxType(objBuilder);
        codePane.setText(objBuilder.getCode());
        codePane.getJEditorPane().setCaretPosition(0);

        if (objBuilder != null) {
            if (editBox.isSelected() != objBuilder.isEditEnabled()) {
                editBox.doClick();
            }
        } else {
            editBox.setSelected(false);
        }

        languageTypeCombo.setSelectedItem(objBuilder.getLanguageType());
//        isExternalBox.setSelected(objBuilder.isExternal());
//        commandLineText.setEnabled(objBuilder.isExternal());
        commandLineText.setText(objBuilder.getCommandLine());

        this.objBuilder = objBuilder;

        completionProvider.setBSBGraphicInterface(objBuilder.getGraphicInterface());

        undo.discardAllEdits();

    }

    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();
        ObjectBuilderCodeEditor codeEditor = new ObjectBuilderCodeEditor();
        codeEditor.editObjectBuilder(new ObjectBuilder());
        GUI.showComponentAsStandalone(codeEditor, "ObjectBuilder Code Editor",
                true);
    }

}
