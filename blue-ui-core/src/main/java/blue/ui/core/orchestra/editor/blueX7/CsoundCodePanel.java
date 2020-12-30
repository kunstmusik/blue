/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.ui.core.orchestra.editor.blueX7;

import blue.orchestra.BlueX7;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.SimpleDocumentListener;
import java.awt.BorderLayout;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.border.EmptyBorder;
import javax.swing.event.DocumentEvent;
import javax.swing.undo.UndoManager;
import org.openide.awt.UndoRedo;

/**
 * @author steven
 * 
 */
public class CsoundCodePanel extends JComponent {
    BlueX7 blueX7 = null;

    MimeTypeEditorComponent postCodeText = new MimeTypeEditorComponent("text/x-csound-orc");
    
    UndoManager undo = new UndoRedo.Manager();

    public CsoundCodePanel() {
        this.setLayout(new BorderLayout());
        this.setBorder(new EmptyBorder(5, 5, 5, 5));
        this.add(new JLabel("[ Post Code ]"), BorderLayout.NORTH);

        this.add(postCodeText, BorderLayout.CENTER);

        postCodeText.getDocument().addDocumentListener(new SimpleDocumentListener() {

            @Override
            public void documentChanged(DocumentEvent e) {
                 if (blueX7 != null) {
                    blueX7.setCsoundPostCode(postCodeText.getText());
                }
            }

        });
        postCodeText.setUndoManager(undo);
        postCodeText.getDocument().addUndoableEditListener(undo);
    }

    public void editBlueX7(BlueX7 blueX7) {
        this.blueX7 = null;
        postCodeText.setText(blueX7.getCsoundPostCode());
        postCodeText.getJEditorPane().setCaretPosition(0);
        postCodeText.resetUndoManager();
        undo.discardAllEdits();
        this.blueX7 = blueX7;
    }
}
