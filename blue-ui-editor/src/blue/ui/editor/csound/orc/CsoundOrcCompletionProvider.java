/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.orc;

import csound.manual.CsoundManualUtilities;
import java.util.ArrayList;
import java.util.Collections;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.swing.text.BadLocationException;
import javax.swing.text.Document;
import javax.swing.text.Element;
import javax.swing.text.JTextComponent;
import javax.swing.text.StyledDocument;
import org.netbeans.api.editor.mimelookup.MimeRegistration;
import org.netbeans.api.editor.mimelookup.MimeRegistrations;
import org.netbeans.spi.editor.completion.CompletionProvider;
import org.netbeans.spi.editor.completion.CompletionResultSet;
import org.netbeans.spi.editor.completion.CompletionTask;
import org.netbeans.spi.editor.completion.support.AsyncCompletionQuery;
import org.netbeans.spi.editor.completion.support.AsyncCompletionTask;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
@MimeRegistrations({
    @MimeRegistration(mimeType = "text/x-csound-orc",
    service = CompletionProvider.class, position = 100),
    @MimeRegistration(mimeType = "text/x-blue-synth-builder",
    service = CompletionProvider.class, position = 100)
})
public class CsoundOrcCompletionProvider implements CompletionProvider {

    protected static ArrayList<String> opNames;

    static {
        opNames = new ArrayList<>(CsoundManualUtilities.getOpcodeNames());
        Collections.sort(opNames);
    }

    @Override
    public CompletionTask createTask(int queryType, JTextComponent component) {
        if (queryType != CompletionProvider.COMPLETION_QUERY_TYPE) {
            return null;
        }
        return new AsyncCompletionTask(new AsyncCompletionQuery() {
            @Override
            protected void query(CompletionResultSet completionResultSet, Document document, int caretOffset) {
                String filter = null;
                int startOffset = caretOffset - 1;
                try {
                    final StyledDocument bDoc = (StyledDocument) document;
                    final int lineStartOffset = getRowFirstNonWhite(bDoc,
                            caretOffset);
                    final char[] line = bDoc.getText(lineStartOffset,
                            caretOffset - lineStartOffset).toCharArray();
                    final int whiteOffset = indexOfWhite(line);
                    filter = new String(line, whiteOffset + 1,
                            line.length - whiteOffset - 1);
                    if (whiteOffset > 0) {
                        startOffset = lineStartOffset + whiteOffset + 1;
                    } else {
                        startOffset = lineStartOffset;
                    }
                } catch (BadLocationException ex) {
                    Exceptions.printStackTrace(ex);
                }

                if (filter != null && !filter.equals("")) {
                    int index = filter.lastIndexOf("(");
                    if (index >= 0) {
                        filter = filter.substring(index + 1);
                    }

                    if (!filter.isEmpty()) {
                        if (isCsoundVariable(filter)) {

                            String textBeforeWord;
                            try {
                                textBeforeWord = document.getText(0,
                                        startOffset);
                                ArrayList<String> varMatches = findMatches(
                                        textBeforeWord,
                                        filter);

                                for (String var : varMatches) {
                                    completionResultSet.addItem(new CsoundOrcVariableCompletionItem(
                                            var));
                                }
                            } catch (BadLocationException ex) {
                                Exceptions.printStackTrace(ex);
                            }
                        }

                        for (String opName : opNames) {
                            if (opName.startsWith(filter)) {
                                completionResultSet.addItem(new CsoundOrcCompletionItem(
                                        opName,
                                        CsoundManualUtilities.getOpcodeSignature(
                                        opName)));
                            }
                        }
                    }


                }


                completionResultSet.finish();
            }
        }, component);
    }

    @Override
    public int getAutoQueryTypes(JTextComponent component, String typedText) {
        return 0;
    }

    private ArrayList<String> findMatches(String source, String toMatch) {
        Pattern p = Pattern.compile("\\b" + toMatch + "\\w*");
        Matcher m = p.matcher(source);

        ArrayList<String> matches = new ArrayList<>();

        while (m.find()) {
            String match = m.group();
            if (!matches.contains(match) && !opNames.contains(match)) {
                matches.add(match);
            }
        }

        return matches;
    }

    private boolean isCsoundVariable(String word) {
        return (word.startsWith("i") || word.startsWith("k")
                || word.startsWith("a") || word.startsWith("gi")
                || word.startsWith("gk") || word.startsWith("ga")
                || word.startsWith("w") || word.startsWith("f")
                || word.startsWith("gw") || word.startsWith("gf")
                || word.startsWith("S") || word.startsWith("gS"));
    }

    //    if (isCsoundVariable(word)) {
//                ArrayList varMatches = findMatches(getTextBeforeWord(word),
//                        word);
//                options.addAll(varMatches);
//            }
//
//            Collections.<String>sort(options);
    static int getRowFirstNonWhite(StyledDocument doc, int offset)
            throws BadLocationException {
        Element lineElement = doc.getParagraphElement(offset);
        int start = lineElement.getStartOffset();
        while (start + 1 < lineElement.getEndOffset()) {
            try {
                if (doc.getText(start, 1).charAt(0) != ' ') {
                    break;
                }
            } catch (BadLocationException ex) {
                throw (BadLocationException) new BadLocationException(
                        "calling getText(" + start + ", " + (start + 1)
                        + ") on doc of length: " + doc.getLength(), start).initCause(
                        ex);
            }
            start++;
        }
        return start;
    }

    static int indexOfWhite(char[] line) {
        int i = line.length;
        while (--i > -1) {
            final char c = line[i];
            if (Character.isWhitespace(c)) {
                return i;
            }
        }
        return -1;
    }
}
