/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
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
package blue.ui.editor.csound.orc.actions;

import java.awt.event.ActionEvent;
import javax.swing.Action;
import javax.swing.text.BadLocationException;
import javax.swing.text.Caret;
import javax.swing.text.JTextComponent;
import org.netbeans.api.editor.document.LineDocumentUtils;
import org.netbeans.editor.BaseAction;
import org.netbeans.editor.BaseDocument;

/**
 *
 * @author stevenyi
 */
//@EditorActionRegistration(name = "add-semicolon-line-comment",
//                          menuPath="Source",
//                          mimeType = "text/x-csound-orc",
//                          menuText = "#add-semicolon-line-comment")
public class AddSemiColonLineCommentAction extends BaseAction {

    public static String ACTION_NAME = "add-semicolon-line-comment";
    private static String COMMENT_STRING = ";";

    public AddSemiColonLineCommentAction() {
        this.putValue(Action.NAME, ACTION_NAME);
    }

    @Override
    public void actionPerformed(ActionEvent evt, final JTextComponent target) {
        if (target != null) {
            if (!target.isEditable() || !target.isEnabled()) {
                target.getToolkit().beep();
                return;
            }
            final Caret caret = target.getCaret();
            final BaseDocument doc = (BaseDocument) target.getDocument();

            doc.runAtomicAsUser(() -> {
                try {
                    int startPos;
                    int endPos;
                    
                    if (org.netbeans.editor.Utilities.isSelectionShowing(
                            caret)) {
                        
                        startPos = org.netbeans.editor.Utilities.getRowStart(
                                doc,
                                target.getSelectionStart());
                        endPos = target.getSelectionEnd();
                        if (endPos > 0 && org.netbeans.editor.Utilities.getRowStart(
                                doc, endPos) == endPos) {
                            endPos--;
                        }
                        endPos = org.netbeans.editor.Utilities.getRowEnd(doc,
                                endPos);
                    } else { // selection not visible
                        startPos = org.netbeans.editor.Utilities.getRowStart(
                                doc, caret.getDot());
                        endPos = org.netbeans.editor.Utilities.getRowEnd(doc,
                                caret.getDot());
                    }
                    
                    int lineCount = org.netbeans.editor.Utilities.getRowCount(
                            doc, startPos,
                            endPos);
                    
                    comment(doc, startPos, lineCount);
                    
                    
                } catch (BadLocationException e) {
                    target.getToolkit().beep();
                }
            });
        }
    }

    private void comment(BaseDocument doc, int startOffset, int lineCount) throws BadLocationException {
        for (int offset = startOffset; lineCount > 0; lineCount--) {
            doc.insertString(offset, COMMENT_STRING, null); // NOI18N
            offset = org.netbeans.editor.Utilities.getRowStart(doc, offset, +1);;
        }
    }
}
