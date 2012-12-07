/*
 * blue - object composition environment for csound Copyright (c) 2001-2003
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.gui;

import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.net.MalformedURLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JFrame;
import javax.swing.JOptionPane;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.text.BadLocationException;

import org.openide.util.Exceptions;
import org.syntax.jedit.InputHandler;
import org.syntax.jedit.JEditTextArea;
import org.syntax.jedit.SyntaxDocument;
import org.syntax.jedit.tokenmarker.JavaScriptTokenMarker;
import org.syntax.jedit.tokenmarker.PerlTokenMarker;
import org.syntax.jedit.tokenmarker.PythonTokenMarker;
import org.syntax.jedit.tokenmarker.ShellScriptTokenMarker;
import org.syntax.jedit.tokenmarker.TokenMarker;

import skt.swing.SwingUtil;
import blue.BlueSystem;
import blue.components.FindReplaceDialog;
import blue.settings.GeneralSettings;
import blue.ui.utilities.UiUtilities;
import blue.utility.GUI;
import blue.utility.TextUtilities;
import java.net.URL;
import org.openide.awt.HtmlBrowser.URLDisplayer;

/**
 * Text Editor Component for blue
 * 
 * @author steven yi
 * @version 1.0
 */

public class BlueEditorPane extends JEditTextArea {
    private static Map tokenMarkers;

    private static String killBuffer = "";

    boolean wasLastActionKillLine = false;

    int lastKillOffset = -1;

    int lastKillLength = -1;

    OpcodePopup opcodePopup = OpcodePopup.getOpcodePopup();

    private boolean syntaxSettable = false;

    static {

//        ProgramOptions.initializeTextDefaults();

        tokenMarkers = new LinkedHashMap();

        tokenMarkers.put("Csound", new CsoundTokenMarker());
        tokenMarkers.put("Python", new PythonTokenMarker());
        tokenMarkers.put("JavaScript", new JavaScriptTokenMarker());
        tokenMarkers.put("Perl", new PerlTokenMarker());
        tokenMarkers.put("Shell", new ShellScriptTokenMarker());
        tokenMarkers.put("None", null);
    }

    public static Object[] getSyntaxTypes() {
        return tokenMarkers.keySet().toArray();
    }

    public String getCurrentSyntaxType() {
        Iterator iter = tokenMarkers.keySet().iterator();

        TokenMarker currentMarker = getTokenMarker();

        while (iter.hasNext()) {
            String key = (String) iter.next();
            if (currentMarker == tokenMarkers.get(key)) {
                return key;
            }
        }

        return null;
    }

    public void setSyntaxType(String type) {
        opcodePopup.setCurrentSyntax(type);

        String currentSyntaxType = getCurrentSyntaxType();

        if (currentSyntaxType != null && currentSyntaxType.equals(type)) {
            return;
        }

        Object tokenMarker = tokenMarkers.get(type);

        setTokenMarker((TokenMarker) tokenMarker);

        firePropertyChange("syntaxType", currentSyntaxType, type);
    }

    public BlueEditorPane() {
        super();

        setMinimumSize(new Dimension(0, 0));

        initActions();
        setDocument(new SyntaxDocument());
        setTokenMarker(new CsoundTokenMarker());

        this.setAutoscrolls(true);

        this.painter.addMouseListener(new MouseAdapter() {

            public void mousePressed(MouseEvent e) {
                showOpcodePopup(e);
            }
        });

        this.getDocument().addDocumentListener(new DocumentListener() {

            public void changedUpdate(DocumentEvent e) {

            }

            public void insertUpdate(DocumentEvent e) {
                wasLastActionKillLine = false;
            }

            public void removeUpdate(DocumentEvent e) {
                if (e.getOffset() == lastKillOffset
                        && e.getLength() == lastKillLength) {
                    wasLastActionKillLine = true;
                } else {
                    wasLastActionKillLine = false;
                }
            }

        });
    }

    private void initActions() {

        SwingUtil.installActions(this, new Action[] { new CodeCompleteAction(),
                new OpenDocumentationAction(),
                new OpenDocumentationExampleAction(), new FindReplaceAction(),
                new AddSemiColonLineCommentAction(),
                new RemoveSemiColonLineCommentAction() });

        // this.inputHandler = new BlueEditorInputHandler();
        // setInputHandler(inputHandler);

        // inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ENTER,
        // BlueSystem.MENU_SHORTCUT_KEY), "formatCsoundCode");

        // actionMap.put("formatCsoundCode", new AbstractAction() {
        //
        // public void actionPerformed(ActionEvent e) {
        // if(isEditable()) {
        // formatCsoundCode();
        // }
        // }
        // });
    }

    private ArrayList<String> findMatches(String source, String toMatch) {
        Pattern p = Pattern.compile(toMatch + "\\w*");
        Matcher m = p.matcher(source);

        ArrayList<String> matches = new ArrayList<String>();

        while (m.find()) {
            String match = m.group() + " - [var]";
            if (!matches.contains(match)) {
                matches.add(match);
            }
        }

        return matches;
    }

    private boolean isCsoundVariable(String word) {
        if (word.startsWith("i") || word.startsWith("k")
                || word.startsWith("a") || word.startsWith("gi")
                || word.startsWith("gk") || word.startsWith("ga")) {
            return true;
        }
        return false;
    }

    public void replaceWordAroundCaret(String replacementText) {
        int index1 = getCaretPosition();
        int index2 = index1;

        index1 = index1 > 0 ? index1 - 1 : index1;

        String text = this.getText();
        int len = text.length();

        while (index1 >= 0 && !Character.isWhitespace(text.charAt(index1))) {
            index1--;
        }

        index1 += 1;

        while (index2 < len && !Character.isWhitespace(text.charAt(index2))) {
            index2++;
        }

        try {
            this.getDocument().remove(index1, index2 - index1);
            this.getDocument().insertString(index1, replacementText, null);
        } catch (BadLocationException e) {
            // Should not ever occur...
            e.printStackTrace();
        }

    }

    private String getTextBeforeWord(String word) {
        String text = this.getText();
        return text.substring(0, getCaretPosition() - word.length());
    }

    public String getWordAroundCaret() {

        String text = this.getText();

        int index1 = getCaretPosition();

        index1 = index1 > 0 ? index1 - 1 : index1;

        int len = text.length();

        if (text.length() == 0) {
            return null;
        }

        while (index1 > 0 && !Character.isWhitespace(text.charAt(index1))) {
            index1--;
        }


        int index2 = index1 + 1;
        
        while (index2 < len 
                && !Character.isWhitespace(text.charAt(index2))
                && text.charAt(index2) != '(') {
            index2++;
        }

        return text.substring(index1, index2).trim();
    }

    private void showOpcodePopup(MouseEvent e) {
        if (isEditable() && isEnabled() && UiUtilities.isRightMouseButton(e)) {
            opcodePopup.setSyntaxSettable(syntaxSettable);
            opcodePopup.show(this, e.getX(), e.getY());
        }
    }

    private void formatCsoundCode() {
        int index1 = getSelectionStart();
        int index2 = getSelectionEnd();

        if (index1 == index2) {
            return;
        }

        // try {
        // // index1 = Utilities.getRowStart(this, index1);
        // // index2 = Utilities.getRowEnd(this, index2);
        // // String ret = getText(index1, index2 - index1);
        //
        // } catch(BadLocationException e) {
        // return;
        // }

    }

    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();

        JFrame frame = new JFrame("Syntax Highlighting");
        BlueEditorPane edit = new BlueEditorPane();

        // JScrollPane scroll = new JScrollPane(edit);
        frame.getContentPane().add(edit);
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setSize(800, 300);

        frame.setVisible(true);
    }

    class CodeCompleteAction extends AbstractAction {

        public CodeCompleteAction() {
            super("code-complete");

            putValue(Action.SHORT_DESCRIPTION, "Code Completion");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_SPACE, KeyEvent.CTRL_DOWN_MASK));

        }

        public void actionPerformed(ActionEvent e) {
            if (isEditable()) {
                codeComplete();
            }
        }

        public void codeComplete() {
            String word = getWordAroundCaret();
            if (word == null || word.length() == 0) {
                return;
            }

            String[] matches = opcodePopup.getOpcodeMatches(word);

            ArrayList<String> options = new ArrayList<String>(matches.length);
            options.addAll(Arrays.asList(matches));

            if (isCsoundVariable(word)) {
                ArrayList varMatches = findMatches(getTextBeforeWord(word),
                        word);
                options.addAll(varMatches);
            }

            Collections.<String>sort(options);

            if (options.size() == 0) {
                return;
            }

            String message = BlueSystem
                    .getString("blueEditorPane.opcodeCompletion.message");
            String title = BlueSystem
                    .getString("blueEditorPane.opcodeCompletion.title");

            Object[] optionsArray = options.toArray();

            Object selectedValue = JOptionPane.showInputDialog(null, message,
                    title, JOptionPane.INFORMATION_MESSAGE, null, optionsArray,
                    optionsArray[0]);

            if (selectedValue == null) {
                return;
            }

            String val = selectedValue.toString();

            if (val.endsWith(" - [var]")) {
                val = val.substring(0, val.length() - 8);
            } else {
                val = OpcodePopup.getOpcodeSignature(val);
            }

            replaceWordAroundCaret(val);

        }

    }

    class OpenDocumentationAction extends AbstractAction {

        public OpenDocumentationAction() {
            super("open-documentation");
            putValue(Action.SHORT_DESCRIPTION, "Open Documentation for Opcode");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_F1, InputEvent.SHIFT_DOWN_MASK));
        }

        public void actionPerformed(ActionEvent e) {
            if (isEditable()) {
                openDocumentation();
            }
        }

        public void openDocumentation() {
//            String word = getWordAroundCaret();
//            if (word == null || word.length() == 0) {
//                return;
//            }

//            String url = GeneralSettings.getInstance().getCsoundDocRoot()
//                    + word + ".html";
//
//            if (!url.startsWith("http") && !url.startsWith("file://")) {
//                url = "file://" + url;
//            }
//
//            url = url.replace(" ", "%20");
//
//            try {
//                URLDisplayer.getDefault().showURL(new URL(url));
//            } catch (MalformedURLException ex) {
//                Exceptions.printStackTrace(ex);
//            }
        }

    }

    class OpenDocumentationExampleAction extends AbstractAction {

        public OpenDocumentationExampleAction() {
            super("open-documentation-example");
            putValue(Action.SHORT_DESCRIPTION,
                    "Open Documentation Example for Opcode");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_F2, InputEvent.SHIFT_DOWN_MASK));
        }

        public void actionPerformed(ActionEvent e) {
            if (isEditable()) {
//                openDocumentationExample();
            }
        }

//        public void openDocumentationExample() {
//            String word = getWordAroundCaret();
//            if (word == null || word.length() == 0) {
//                return;
//            }
//
//            String fileName = GeneralSettings.getInstance()
//                    .getCsoundDocRoot()
//                    + File.separator
//                    + "examples"
//                    + File.separator
//                    + word
//                    + ".csd";
//
//            File f = new File(fileName);
//
//            if (!f.exists() || f.isDirectory()) {
//                JOptionPane.showMessageDialog(BlueEditorPane.this,
//                        "Could not find manual example for opcode: " + word,
//                        "Error", JOptionPane.ERROR_MESSAGE);
//                return;
//            }
//
//            try {
//                String text = TextUtilities.getTextFromFile(f);
//                InfoDialog.showInformationDialogCode(SwingUtilities
//                        .getRoot(BlueEditorPane.this), text,
//                        "Manual Example for " + word);
//            } catch (FileNotFoundException e) {
//                JOptionPane.showMessageDialog(BlueEditorPane.this,
//                        "Could not find file " + f.getAbsolutePath(), "Error",
//                        JOptionPane.ERROR_MESSAGE);
//            } catch (IOException e) {
//                JOptionPane.showMessageDialog(BlueEditorPane.this,
//                        "Could not open file " + f.getAbsolutePath(), "Error",
//                        JOptionPane.ERROR_MESSAGE);
//            }
//        }

    }

    class FindReplaceAction extends AbstractAction {

        public FindReplaceAction() {
            super("find-replace");
            putValue(Action.SHORT_DESCRIPTION, "Open Find/Replace Dialog");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_F, BlueSystem.getMenuShortcutKey()));
        }

        public void actionPerformed(ActionEvent e) {
            if (isEditable()) {
                findReplace();
            }
        }

        protected void findReplace() {
            FindReplaceDialog.showFindReplace(BlueEditorPane.this);
        }

    }

    class AddSemiColonLineCommentAction extends AbstractAction {

        public AddSemiColonLineCommentAction() {
            super("add-semi-colon-line-comment");
            putValue(Action.SHORT_DESCRIPTION, "Add Semi-Colon Line Comment");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_SEMICOLON, BlueSystem.getMenuShortcutKey()));
        }

        public void actionPerformed(ActionEvent e) {
            if (isEditable()) {
                semiColonLineComment(e);
            }
        }

        protected void semiColonLineComment(ActionEvent e) {
            BlueEditorPane textArea = (BlueEditorPane) InputHandler
                    .getTextArea(e);

            SyntaxDocument doc = textArea.getDocument();

            int startLine = textArea.getSelectionStartLine();
            int endLine = textArea.getSelectionEndLine();

            doc.beginCompoundEdit();

            for (int i = startLine; i <= endLine; i++) {
                int offset = textArea.getLineStartOffset(i);
                try {
                    doc.insertString(offset, ";", null);
                } catch (BadLocationException e1) {
                    // TODO Auto-generated catch block
                    e1.printStackTrace();
                }
            }

            doc.endCompoundEdit();

        }
    }

    class RemoveSemiColonLineCommentAction extends AbstractAction {

        public RemoveSemiColonLineCommentAction() {
            super("remove-semi-colon-line-comment");
            putValue(Action.SHORT_DESCRIPTION, "Remove Semi-Colon Line Comment");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_SEMICOLON, BlueSystem.getMenuShortcutKey()
                            | InputEvent.SHIFT_DOWN_MASK));
        }

        public void actionPerformed(ActionEvent e) {
            if (isEditable()) {
                removeSemiColonLineComment(e);
            }
        }

        /**
         * @param e
         * 
         */
        protected void removeSemiColonLineComment(ActionEvent e) {
            BlueEditorPane textArea = (BlueEditorPane) InputHandler
                    .getTextArea(e);

            SyntaxDocument doc = textArea.getDocument();

            int startLine = textArea.getSelectionStartLine();
            int endLine = textArea.getSelectionEndLine();

            doc.beginCompoundEdit();

            for (int i = startLine; i <= endLine; i++) {
                int offset = textArea.getLineStartOffset(i);

                try {
                    if (doc.getText(offset, 1).equals(";")) {
                        doc.remove(offset, 1);
                    }
                } catch (BadLocationException e1) {
                    // TODO Auto-generated catch block
                    e1.printStackTrace();
                }

            }

            doc.endCompoundEdit();
        }

    }

    public boolean isSyntaxSettable() {
        return syntaxSettable;
    }

    public void setSyntaxSettable(boolean syntaxSettable) {
        this.syntaxSettable = syntaxSettable;
    }

}
