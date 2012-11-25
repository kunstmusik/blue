/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.orc;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.event.KeyEvent;
import javax.swing.text.BadLocationException;
import javax.swing.text.Document;
import javax.swing.text.JTextComponent;
import org.netbeans.api.editor.completion.Completion;
import org.netbeans.spi.editor.completion.CompletionItem;
import org.netbeans.spi.editor.completion.CompletionResultSet;
import org.netbeans.spi.editor.completion.CompletionTask;
import org.netbeans.spi.editor.completion.support.AsyncCompletionQuery;
import org.netbeans.spi.editor.completion.support.AsyncCompletionTask;
import org.netbeans.spi.editor.completion.support.CompletionUtilities;

/**
 *
 * @author stevenyi
 */
public class CsoundOrcCompletionItem implements CompletionItem {

    private final String opName;
    private final String signature;

    public CsoundOrcCompletionItem(String opName, String signature) {
        this.opName = opName;
        this.signature = signature;
    }

    @Override
    public void defaultAction(JTextComponent component) {
        replaceWordBeforeCaret(this.signature, component);
        Completion.get().hideAll();
    }

    protected void replaceWordBeforeCaret(String replacementText, JTextComponent jtc) {
        int index1 = jtc.getCaretPosition();
        int index2 = index1;

        index1 = index1 > 0 ? index1 - 1 : index1;

        String text = jtc.getText();
        int len = text.length();

        while (index1 >= 0 && !Character.isWhitespace(text.charAt(index1))) {
            index1--;
        }

        index1 += 1;

        while (index2 < len && !Character.isWhitespace(text.charAt(index2))) {
            index2++;
        }

        try {
            jtc.getDocument().remove(index1, index2 - index1);
            jtc.getDocument().insertString(index1, replacementText, null);
        } catch (BadLocationException e) {
            // Should not ever occur...
            e.printStackTrace();
        }

    }

    @Override
    public void processKeyEvent(KeyEvent evt) {
    }

    @Override
    public int getPreferredWidth(Graphics g, Font defaultFont) {
        return CompletionUtilities.getPreferredWidth(this.opName, null, g,
                defaultFont);
    }

    @Override
    public void render(Graphics g, Font defaultFont, Color defaultColor, Color backgroundColor, int width, int height, boolean selected) {
        CompletionUtilities.renderHtml(null, this.opName, null, g, defaultFont,
                (selected ? Color.red : Color.white), width, height, selected);
    }

    @Override
    public CompletionTask createDocumentationTask() {
        return new AsyncCompletionTask(new AsyncCompletionQuery() {
            @Override
            protected void query(CompletionResultSet completionResultSet, Document document, int i) {

                completionResultSet.setDocumentation(
                        new CsoundOrcCompletionDocumentation(
                            OpcodeDocumentation.getOpcodeDocumentation(opName)));

                completionResultSet.finish();

            }
        });
    }

    @Override
    public CompletionTask createToolTipTask() {
        return null;
    }

    @Override
    public boolean instantSubstitution(JTextComponent component) {
        return false;
    }

    @Override
    public int getSortPriority() {
        return 0;
    }

    @Override
    public CharSequence getSortText() {
        return opName;
    }

    @Override
    public CharSequence getInsertPrefix() {
        return opName;
    }
}
