/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.sco;

import java.util.HashMap;
import java.util.Map;
import org.netbeans.api.lexer.Token;
import org.netbeans.spi.lexer.Lexer;
import org.netbeans.spi.lexer.LexerInput;
import org.netbeans.spi.lexer.LexerRestartInfo;
import org.netbeans.spi.lexer.TokenFactory;

/**
 *
 * @author stevenyi
 */
public class CsoundScoHLexer implements Lexer<CsoundScoTokenId> {

    private static final Map<String,CsoundScoTokenId> keywords = new HashMap<String,CsoundScoTokenId>();
   
    private static final void addKeyword(CsoundScoTokenId id) {
       keywords.put(id.getFixedText(), id);
    }
    
    private static final int EOF = LexerInput.EOF;
    private LexerRestartInfo<CsoundScoTokenId> info;
    private LexerInput input;
    TokenFactory<CsoundScoTokenId> tokenFactory;

    public CsoundScoHLexer(LexerRestartInfo<CsoundScoTokenId> info) {
        this.info = info;
        this.input = info.input();
        tokenFactory = info.tokenFactory();
    }

    public org.netbeans.api.lexer.Token<CsoundScoTokenId> nextToken() {

        while (true) {
            int ch = input.read();

            switch (ch) {
                case '\"':
                    while (true) {
                        switch (input.read()) {
                            case '\\':
                                input.read();
                                break;
                            case '\"':
                                return token(CsoundScoTokenId.STRING);
                            case '\n':
                            case EOF:
                                return token(CsoundScoTokenId.ERROR);
                        }
                    }
                
                case '+':
                case '-':
                case '*':
                case '%':
                    return token(CsoundScoTokenId.OPERATOR);
                case '/':
                    switch (input.read()) {
                        case '/': // in single-line comment
                            while (true) {
                                switch (input.read()) {
                                    case '\r':
                                        input.consumeNewline();
                                    case '\n':
                                    case EOF:
                                        return token(CsoundScoTokenId.SL_COMMENT);
                                }
                            }
                        case '*': // in multi-line comment
                            while (true) {
                                ch = input.read();
                                while (ch == '*') {
                                    ch = input.read();
                                    if (ch == '/') {
                                        return token(CsoundScoTokenId.ML_COMMENT);
                                    } else if (ch == EOF) {
                                        return token(
                                                CsoundScoTokenId.ML_COMMENT_INCOMPLETE);
                                    }
                                }
                                if (ch == EOF) {
                                    return token(
                                            CsoundScoTokenId.ML_COMMENT_INCOMPLETE);
                                }
                            }
                    }
                    input.backup(1);
                    return token(CsoundScoTokenId.OPERATOR);
                    
                case ';':
                    while (true) {
                        switch (input.read()) {
                            case '\r':
                                input.consumeNewline();
                            case '\n':
                            case EOF:
                                return token(CsoundScoTokenId.SL_COMMENT);
                        }
                    }
                    
                case '(':
                    return token(CsoundScoTokenId.LPAREN);

                case ')':
                    return token(CsoundScoTokenId.RPAREN);

                case '0':
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9':
                case '.':
                    return finishIntOrFloatLiteral(ch);

                case EOF:
                    return null;

                default:
                    if (Character.isWhitespace((char) ch)) {
                        ch = input.read();
                        while (ch != EOF && Character.isWhitespace((char) ch)) {
                            ch = input.read();
                        }
                        input.backup(1);
                        return token(CsoundScoTokenId.WS);
                    }

                    if (Character.isLetter((char) ch)) { // identifier or keyword
                        while (true) {
                            if (ch == EOF || !Character.isLetter((char)ch)) {
                                input.backup(1); // backup the extra char (or EOF)
                                // Check for keywords
                                CharSequence word = input.readText();
                                CsoundScoTokenId id = keywords.get(word);
                                if (id == null) {
                                    if(word.equals("i") || word.equals("f") || 
                                            word.equals("e") || word.equals("t")) {
                                        id = CsoundScoTokenId.KEYWORD;
                                    } else {
                                       id = CsoundScoTokenId.CHAR;
                                    }
                                    
                                }
                                return token(id);
                            }
                            ch = input.read(); // read next char
                        }
                    }

                    return token(CsoundScoTokenId.CHAR);
            }


        }

    }
    

    public Object state() {
        return null;
    }

    public void release() {
    }

    private Token<CsoundScoTokenId> finishIntOrFloatLiteral(int ch) {
        boolean floatLiteral = false;
        boolean inExponent = false;
        while (true) {
            switch (ch) {
                case '.':
                    if (floatLiteral) {
                        return token(CsoundScoTokenId.MYFLOAT);
                    } else {
                        floatLiteral = true;
                    }
                    break;
                case '0':
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9':
                    break;
                case 'e':
                case 'E': // exponent part
                    if (inExponent) {
                        return token(CsoundScoTokenId.MYFLOAT);
                    } else {
                        floatLiteral = true;
                        inExponent = true;
                    }
                    break;
                default:
                    input.backup(1);
                    return token(floatLiteral ? CsoundScoTokenId.MYFLOAT
                            : CsoundScoTokenId.INT);
            }
            ch = input.read();
        }
    }

    private Token<CsoundScoTokenId> token(CsoundScoTokenId id) {
        return (id.getFixedText() != null)
                ? tokenFactory.getFlyweightToken(id, id.getFixedText())
                : tokenFactory.createToken(id);
    }
}
