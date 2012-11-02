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

package blue.ui.core.mixer;

import blue.mixer.*;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.util.ArrayList;
import java.util.Arrays;

import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.JOptionPane;
import javax.swing.KeyStroke;
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
import blue.gui.BlueEditorPane;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.ui.utilities.SimpleDocumentListener;

public class EffectCodeEditor extends JComponent {

    BlueEditorPane codePane = new BlueEditorPane();

    UndoManager undo = new UndoManager();

    private boolean updating = false;

    private Effect effect;

    public EffectCodeEditor() {
        this.setLayout(new BorderLayout());
        this.add(codePane, BorderLayout.CENTER);

        codePane.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
                    public void documentChanged(DocumentEvent e) {
                        if (effect != null && !updating) {
                            effect.setCode(codePane.getText());
                        }
                    }
                });

        UndoableEditListener ul = new UndoableEditListener() {

            public void undoableEditHappened(UndoableEditEvent e) {
                UndoableEdit event = e.getEdit();
                undo.addEdit(event);
            }

        };

        codePane.getDocument().addUndoableEditListener(ul);

        Action[] undoActions = new Action[] { new UndoAction(undo),
                new RedoAction(undo) };

        SwingUtil.installActions(codePane, undoActions);

        undo.setLimit(1000);

        initActions();
    }

    public void editEffect(Effect effect) {
        this.effect = null;

        updating = true;

        if (effect == null) {
            codePane.setText("");
            codePane.setEnabled(false);
        } else {
            codePane.setEnabled(true);
            codePane.setText(effect.getCode());
            codePane.setCaretPosition(0);
        }

        this.effect = effect;

        undo.discardAllEdits();

        updating = false;
    }

    public void codeComplete(BlueEditorPane bPane) {
        BSBGraphicInterface bsbGr = effect.getGraphicInterface();

        if (bsbGr.size() == 0) {
            return;
        }

        // String[] matches = new String[bsbGr.size()];

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

    }

}
