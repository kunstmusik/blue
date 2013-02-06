/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.orchestra.editor.blueSynthBuilder;

import blue.orchestra.blueSynthBuilder.BSBObject;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.event.KeyEvent;
import javax.swing.text.BadLocationException;
import javax.swing.text.JTextComponent;
import org.apache.commons.lang3.StringEscapeUtils;
import org.netbeans.api.editor.completion.Completion;
import org.netbeans.editor.DocumentUtilities;
import org.netbeans.spi.editor.completion.CompletionItem;
import org.netbeans.spi.editor.completion.CompletionTask;
import org.netbeans.spi.editor.completion.support.CompletionUtilities;

/**
 *
 * @author stevenyi
 */
public class BSBCompletionItem implements CompletionItem {

    private final BSBObject bsbObj;
    private final String replacementKey;
    private final String label;
    private final String objectType;

    public BSBCompletionItem(BSBObject bsbObj, String replacementKey) {
        this.bsbObj = bsbObj;
        this.replacementKey = "<" + replacementKey + ">";
        this.label = StringEscapeUtils.escapeHtml4(replacementKey);
        objectType = bsbObj.getClass().getSimpleName();
    }

    @Override
    public void defaultAction(JTextComponent component) {
        replaceWordBeforeCaret(replacementKey, component);
        Completion.get().hideAll();
    }

    protected void replaceWordBeforeCaret(String replacementText, JTextComponent jtc) {
        int index1 = jtc.getCaretPosition();
        int index2 = index1;

        index1 = index1 > 0 ? index1 - 1 : index1;

        String text = jtc.getText();
        int len = text.length();
        
        char c;
        
        while (index1 >= 0 && !(Character.isWhitespace(c = text.charAt(index1)) || c == '(')) {
            index1--;
        }
        
        index1 += 1;

        while (index2 < len && !(Character.isWhitespace(c = text.charAt(index2)) || c == ')')) {
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
        return CompletionUtilities.getPreferredWidth(this.label, this.objectType, g,
                defaultFont);
    }

    @Override
    public void render(Graphics g, Font defaultFont, Color defaultColor, Color backgroundColor, int width, int height, boolean selected) {
        CompletionUtilities.renderHtml(null, this.label, this.objectType, g, defaultFont,
                (selected ? Color.orange : Color.white), width, height, selected);
    }

    @Override
    public CompletionTask createDocumentationTask() {
        return null;
//        return new AsyncCompletionTask(new AsyncCompletionQuery() {
//            @Override
//            protected void query(CompletionResultSet completionResultSet, Document document, int i) {
//
//                String doc = OpcodeDocumentation.getOpcodeDocumentation(opName);
//                if(doc != null) {
//                    completionResultSet.setDocumentation(
//                        new BSBCompletionDocumentation(doc));
//                }
//                
//                completionResultSet.finish();
//            }
//        });
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
        return -5;
    }

    @Override
    public CharSequence getSortText() {
        return this.replacementKey;
    }

    @Override
    public CharSequence getInsertPrefix() {
        return this.replacementKey;
    }
}
