/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.score.noteProcessorChain;

import blue.noteProcessor.Code;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.utility.GUI;
import com.l2fprod.common.swing.BaseDialog;
import java.awt.BorderLayout;
import java.awt.Container;
import java.awt.Frame;
import java.awt.Insets;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.undo.UndoManager;
import org.openide.awt.UndoRedo;
import org.openide.windows.WindowManager;

/**
 * @author steven
 */
public class CodeEditor extends JComponent {
    Vector listeners = new Vector();

    private static CodeEditDialog codeDialog = null;

    JButton button;

    JLabel label;

    Code code;

    public CodeEditor() {
        this.setLayout(new BorderLayout(0, 0));
        button = new JButton("...");
        this.add(button, BorderLayout.EAST);
        button.setMargin(new Insets(0, 0, 0, 0));

        button.addActionListener((ActionEvent e) -> {
            editCode();
        });

        label = new JLabel();
        this.add(label, BorderLayout.CENTER);
    }

    public void addActionListener(ActionListener al) {
        listeners.add(al);
    }

    public void removeActionListener(ActionListener al) {
        listeners.remove(al);
    }

    public void fireActionPerformed() {
        ActionEvent ae = new ActionEvent(this, ActionEvent.ACTION_PERFORMED,
                "scale");
        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            ActionListener al = (ActionListener) iter.next();
            al.actionPerformed(ae);
        }
    }

    protected void editCode() {
        if (codeDialog == null) {
            codeDialog = new CodeEditDialog(WindowManager.getDefault().getMainWindow());
            codeDialog.setSize(400, 400);
            GUI.centerOnScreen(codeDialog);
        }

        codeDialog.setCodeText(code.getCode());

        boolean retVal = codeDialog.ask();

        if (!retVal) {
            fireActionPerformed();
            return;
        }

        this.code.setCode(codeDialog.getCodeText());
        fireActionPerformed();
    }

    /**
     * @return Returns the scale.
     */
    public Code getCode() {
        return code;
    }

    /**
     * @param scale
     *            The scale to set.
     */
    public void setCode(Code code) {
        this.code = code;
        label.setText(code.toString());
    }

    private static class CodeEditDialog extends BaseDialog {

        MimeTypeEditorComponent editor = new MimeTypeEditorComponent("text/x-python");
        
        UndoManager undo = new UndoRedo.Manager();

        public CodeEditDialog(Frame parent) {
            super(parent, "Edit Code", true);

            this.getBanner().setVisible(false);

            this.setDefaultCloseOperation(HIDE_ON_CLOSE);

            Container contentPane = this.getContentPane();
            contentPane.setLayout(new BorderLayout());
            contentPane.add(editor, BorderLayout.CENTER);
            
            editor.setUndoManager(undo);
            editor.getDocument().addUndoableEditListener(undo);
        }

        public void setCodeText(String code) {
            editor.setText(code);
            editor.getJEditorPane().setCaretPosition(0);
            editor.resetUndoManager();
            undo.discardAllEdits();
        }

        public String getCodeText() {
            return editor.getText();
        }

    }
}