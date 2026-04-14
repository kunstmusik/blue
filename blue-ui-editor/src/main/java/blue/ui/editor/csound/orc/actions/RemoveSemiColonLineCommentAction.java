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
import java.util.ArrayList;
import java.util.List;
import javax.swing.Action;
import javax.swing.text.BadLocationException;
import javax.swing.text.Caret;
import javax.swing.text.JTextComponent;
import org.netbeans.api.editor.document.LineDocument;
import org.netbeans.api.editor.document.LineDocumentUtils;
import org.netbeans.editor.BaseAction;
import org.netbeans.editor.BaseDocument;
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

            doc.runAtomicAsUser(() -> {
                try {
                    int startPos;
                    int endPos;
                    
                    LineDocument lineDoc = (LineDocument) doc;

                    if (target.getSelectionStart() != target.getSelectionEnd()) {
                        startPos = LineDocumentUtils.getLineStart(lineDoc,
                                target.getSelectionStart());
                        endPos = target.getSelectionEnd();
                        if (endPos > 0 && LineDocumentUtils.getLineStart(lineDoc, endPos) == endPos) {
                            endPos--;
                        }
                        endPos = LineDocumentUtils.getLineEnd(lineDoc, endPos);
                    } else { // selection not visible
                        startPos = LineDocumentUtils.getLineStart(lineDoc, caret.getDot());
                        endPos = LineDocumentUtils.getLineEnd(lineDoc, caret.getDot());
                    }

                    uncomment(doc, startPos, endPos);
                    
                    
                } catch (BadLocationException e) {
                    target.getToolkit().beep();
                }
            });
        }


    }

    private void uncomment(BaseDocument doc, int startOffset, int endOffset) throws BadLocationException {
        LineDocument lineDoc = (LineDocument) doc;
        List<Integer> lineStarts = getLineStarts(lineDoc, startOffset, endOffset);
        int lineCommentStringLen = 1;

        for (int i = lineStarts.size() - 1; i >= 0; i--) {
            int rowStart = lineStarts.get(i);

            if (rowStart != -1) {
                if (LineDocumentUtils.getLineEnd(lineDoc, rowStart) - rowStart >= lineCommentStringLen) {
                    CharSequence maybeLineComment = DocumentUtilities.getText(
                            doc, rowStart, lineCommentStringLen);
                    if (CharSequenceUtilities.textEquals(maybeLineComment,
                            COMMENT_STRING)) {
                        doc.remove(rowStart, lineCommentStringLen);
                    }
                }
            }
        }
    }

    private List<Integer> getLineStarts(LineDocument lineDoc, int startOffset,
            int endOffset) throws BadLocationException {
        int startLine = LineDocumentUtils.getLineIndex(lineDoc, startOffset);
        int endLine = LineDocumentUtils.getLineIndex(lineDoc, endOffset);
        List<Integer> lineStarts = new ArrayList<>(endLine - startLine + 1);

        for (int line = startLine; line <= endLine; line++) {
            lineStarts.add(LineDocumentUtils.getLineStartFromIndex(lineDoc,
                    line));
        }

        return lineStarts;
    }
}
