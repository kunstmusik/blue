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
import org.netbeans.editor.BaseAction;
import org.netbeans.editor.BaseDocument;
import org.netbeans.editor.Utilities;
import org.netbeans.lib.editor.util.CharSequenceUtilities;
import org.netbeans.lib.editor.util.swing.DocumentUtilities;

/**
 *
 * @author stevenyi
 */
//@EditorActionRegistration(name = "remove-semicolon-line-comment",
//menuPath = "Source",
//mimeType = "text/x-csound-orc",
//menuText = "#remove-semicolon-line-comment")
public class RemoveSemiColonLineCommentAction extends BaseAction {

    public static String ACTION_NAME = "remove-semicolon-line-comment";
    private static String COMMENT_STRING = ";";

    public RemoveSemiColonLineCommentAction() {
        this.putValue(Action.NAME, ACTION_NAME);
//        this.putValue(Action.ACCELERATOR_KEY, Utilities.stringToKey("DS-SEMICOLON"));
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

            doc.runAtomicAsUser(new Runnable() {
                @Override
                public void run() {
                    try {
                        int startPos;
                        int endPos;

                        if (Utilities.isSelectionShowing(caret)) {
                            startPos = Utilities.getRowStart(doc,
                                    target.getSelectionStart());
                            endPos = target.getSelectionEnd();
                            if (endPos > 0 && Utilities.getRowStart(doc, endPos) == endPos) {
                                endPos--;
                            }
                            endPos = Utilities.getRowEnd(doc, endPos);
                        } else { // selection not visible
                            startPos = Utilities.getRowStart(doc, caret.getDot());
                            endPos = Utilities.getRowEnd(doc, caret.getDot());
                        }

                        int lineCount = Utilities.getRowCount(doc, startPos,
                                endPos);

                        uncomment(doc, startPos, lineCount);


                    } catch (BadLocationException e) {
                        target.getToolkit().beep();
                    }
                }
            });
        }


    }

    private void uncomment(BaseDocument doc, int startOffset, int lineCount) throws BadLocationException {

        int lineCommentStringLen = 1;

        for (int offset = startOffset; lineCount > 0; lineCount--) {

            int rowStart = Utilities.getRowStart(doc, offset);

            if (rowStart != -1) {
                if (Utilities.getRowEnd(doc, rowStart) - rowStart >= lineCommentStringLen) {
                    CharSequence maybeLineComment = DocumentUtilities.getText(
                            doc, rowStart, lineCommentStringLen);
                    if (CharSequenceUtilities.textEquals(maybeLineComment,
                            COMMENT_STRING)) {
                        doc.remove(rowStart, lineCommentStringLen);
                    }
                }
            }

            offset = Utilities.getRowStart(doc, offset, +1);
        }
    }
}

