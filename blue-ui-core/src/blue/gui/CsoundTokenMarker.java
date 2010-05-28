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
package blue.gui;

import java.io.File;

import javax.swing.text.Segment;

import org.syntax.jedit.KeywordMap;
import org.syntax.jedit.tokenmarker.CTokenMarker;
import org.syntax.jedit.tokenmarker.Token;

import blue.BlueSystem;
import org.openide.util.Utilities;

public class CsoundTokenMarker extends CTokenMarker {

    public CsoundTokenMarker() {
        super(false, getKeywords());
        this.keywords = getKeywords();
    }

    public byte markTokensImpl(byte token, Segment line, int lineIndex) {
        char[] array = line.array;
        int offset = line.offset;
        lastOffset = offset;
        lastKeyword = offset;
        int length = line.count + offset;
        boolean backslash = false;

        loop: for (int i = offset; i < length; i++) {
            int i1 = (i + 1);

            char c = array[i];
            if (c == '\\') {
                backslash = !backslash;
                continue;
            }

            switch (token) {
                case Token.NULL:
                    switch (c) {
                        case '#':
                            if (backslash) {
                                backslash = false;
                            }
                            break;
                        case '"':
                            doKeyword(line, i, c);
                            if (backslash) {
                                backslash = false;
                            } else {
                                addToken(i - lastOffset, token);
                                token = Token.LITERAL1;
                                lastOffset = lastKeyword = i;
                            }
                            break;
                        case '\'':
                            doKeyword(line, i, c);
                            if (backslash) {
                                backslash = false;
                            } else {
                                addToken(i - lastOffset, token);
                                token = Token.LITERAL2;
                                lastOffset = lastKeyword = i;
                            }
                            break;
                        case ':':
                            if (lastKeyword == offset) {
                                if (doKeyword(line, i, c)) {
                                    break;
                                }
                                backslash = false;
                                addToken(i1 - lastOffset, Token.LABEL);
                                lastOffset = lastKeyword = i1;
                            } else if (doKeyword(line, i, c)) {
                                break;
                            }
                            break;
                        case '/':
                            backslash = false;
                            doKeyword(line, i, c);
                            if (length - i > 1) {
                                switch (array[i1]) {
                                    case '*':
                                        addToken(i - lastOffset, token);
                                        lastOffset = lastKeyword = i;
                                        if (length - i > 2
                                                && array[i + 2] == '*') {
                                            token = Token.COMMENT2;
                                        } else {
                                            token = Token.COMMENT1;
                                        }
                                        break;
                                    case '/':
                                        addToken(i - lastOffset, token);
                                        addToken(length - i, Token.COMMENT1);
                                        lastOffset = lastKeyword = length;
                                        break loop;
                                }
                            }
                            break;
                        case ';':
                            backslash = false;
                            doKeyword(line, i, c);
                            addToken(i - lastOffset, token);
                            addToken(length - i, Token.COMMENT1);
                            lastOffset = lastKeyword = length;
                            break loop;
                        default:
                            backslash = false;
                            if (!Character.isLetterOrDigit(c) && c != '_') {
                                doKeyword(line, i, c);
                            }
                            break;
                    }
                    break;
                case Token.COMMENT1:
                case Token.COMMENT2:
                    backslash = false;
                    if (c == '*' && length - i > 1) {
                        if (array[i1] == '/') {
                            i++;
                            addToken((i + 1) - lastOffset, token);
                            token = Token.NULL;
                            lastOffset = lastKeyword = i + 1;
                        }
                    }
                    break;
                case Token.LITERAL1:
                    if (backslash) {
                        backslash = false;
                    } else if (c == '"') {
                        addToken(i1 - lastOffset, token);
                        token = Token.NULL;
                        lastOffset = lastKeyword = i1;
                    }
                    break;
                case Token.LITERAL2:
                    if (backslash) {
                        backslash = false;
                    } else if (c == '\'') {
                        addToken(i1 - lastOffset, Token.LITERAL1);
                        token = Token.NULL;
                        lastOffset = lastKeyword = i1;
                    }
                    break;
                default:
                    throw new InternalError("Invalid state: " + token);
            }
        }

        if (token == Token.NULL) {
            doKeyword(line, length, '\0');
        }

        switch (token) {
            case Token.LITERAL1:
            case Token.LITERAL2:
                addToken(length - lastOffset, Token.INVALID);
                token = Token.NULL;
                break;
            case Token.KEYWORD2:
                addToken(length - lastOffset, token);
                if (!backslash) {
                    token = Token.NULL;
                }
            default:
                addToken(length - lastOffset, token);
                break;
        }

        return token;
    }

    public static synchronized KeywordMap getKeywords() {
        if (csoundKeywords == null) {
            csoundKeywords = new KeywordMap(false);

            csoundKeywords.add("else", Token.KEYWORD1);
            csoundKeywords.add("elseif", Token.KEYWORD1);
            csoundKeywords.add("if", Token.KEYWORD1);
            csoundKeywords.add("then", Token.KEYWORD1);
            csoundKeywords.add(",", Token.NULL);

            try {
                electric.xml.Document doc = new electric.xml.Document(
                        CsoundTokenMarker.class.getResourceAsStream("opcodes.xml"));
                electric.xml.Element root = doc.getRoot();
                populateKeywords(root);
                // Builder b = new Builder();
                // nu.xom.Document doc = b.build(f);
                //
                // populateKeywords2(doc.getRootElement());

            } catch (electric.xml.ParseException pe) {
                System.out.println("[BlueSyntaxDocument] "
                        + BlueSystem
                                .getString("message.file.couldNotOpenOrParse")
                        + " opcodes.xml");
                pe.printStackTrace();
            } catch (Exception e) {
                e.printStackTrace();
            }

        }
        return csoundKeywords;
    }

    private static void populateKeywords(electric.xml.Element root) {
        electric.xml.Elements temp = root.getElements("opcodeGroup");
        electric.xml.Elements temp2 = root.getElements("opcode");
        electric.xml.Element tempElement;
        String opcodeText;

        while (temp.hasMoreElements()) {
            tempElement = temp.next();
            populateKeywords(tempElement);
        }
        while (temp2.hasMoreElements()) {
            tempElement = temp2.next();

            opcodeText = tempElement.getElement("name").getTextString();
            // System.out.println("found: [" + opcodeText + "]");
            csoundKeywords.add(opcodeText.trim(), Token.KEYWORD1);
        }
    }

    // private static void populateKeywords2(nu.xom.Element root) {
    // Elements temp = root.getChildElements("opcodeGroup");
    // Elements temp2 = root.getChildElements("opcode");
    //
    // nu.xom.Element tempElement;
    // String opcodeText;
    //
    // for (int i = 0; i < temp.size(); i++) {
    // tempElement = temp.get(i);
    // populateKeywords2(tempElement);
    // }
    // for (int i = 0; i < temp2.size(); i++) {
    // tempElement = temp2.get(i);
    //
    // opcodeText = tempElement.getChildElements().get(0).getValue();
    // // System.out.println("found: [" + opcodeText + "]");
    // csoundKeywords.add(opcodeText.trim(), Token.KEYWORD1);
    // }
    // }

    // private members
    private static KeywordMap csoundKeywords;

    private final KeywordMap keywords;

    private int lastOffset;

    private int lastKeyword;

    private boolean doKeyword(Segment line, int i, char c) {
        int i1 = i + 1;

        int len = i - lastKeyword;

        byte id = keywords.lookup(line, lastKeyword, len);
        if (id != Token.NULL) {
            if (lastKeyword != lastOffset) {
                addToken(lastKeyword - lastOffset, Token.NULL);
            }
            addToken(len, id);
            lastOffset = i;

        } else if (isPfield(line, i - len)) {
            id = Token.KEYWORD3;

            if (lastKeyword != lastOffset) {
                addToken(lastKeyword - lastOffset, Token.NULL);
            }
            addToken(len, id);
            lastOffset = i;
        } else if (isCsoundVariable(line, i - len)) {
            id = Token.KEYWORD2;

            if (lastKeyword != lastOffset) {
                addToken(lastKeyword - lastOffset, Token.NULL);
            }
            addToken(len, id);
            lastOffset = i;

        }

        lastKeyword = i1;
        return (id == Token.NULL);
    }

    private boolean isCsoundVariable(Segment line, int index) {
        char[] text = line.array;
        int start = index;

        if (start > text.length - 1) {

            return false;
        }

        char c = text[start];

        if (c == 'g') {
            c = text[start + 1];
        }

        if (c == 'i' || c == 'k' || c == 'a') {
            return true;
        }

        return false;
    }

    private boolean isPfield(Segment line, int index) {
        char[] text = line.array;
        int start = index;

        if (start > text.length - 1) {

            return false;
        }

        char c = text[start];

        if (c == 'p') {
            start += 1;

            for(c = text[start]; start < text.length - 1; start++) {
                if(Character.isDigit(c)) {
                    continue;
                } else if(Character.isWhitespace(c)) {
                    break;
                } else {
                    return false;
                }
            }

            return true;
        }

        return false;
    }
}
