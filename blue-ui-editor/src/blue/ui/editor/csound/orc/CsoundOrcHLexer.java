/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.orc;

import csound.manual.CsoundManualUtilities;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.netbeans.api.lexer.Token;
import org.netbeans.spi.lexer.Lexer;
import org.netbeans.spi.lexer.LexerInput;
import org.netbeans.spi.lexer.LexerRestartInfo;
import org.netbeans.spi.lexer.TokenFactory;

/**
 *
 * @author stevenyi
 */
public class CsoundOrcHLexer implements Lexer<CsoundOrcTokenId> {

    private static final Map<String,CsoundOrcTokenId> keywords = new HashMap<String,CsoundOrcTokenId>();
    
    private static final Set<String> opcodeNames = CsoundManualUtilities.getOpcodeNames();
    
    static {
        addKeyword(CsoundOrcTokenId.INSTR_START);
        addKeyword(CsoundOrcTokenId.INSTR_END);
        addKeyword(CsoundOrcTokenId.OPCODE_START);
        addKeyword(CsoundOrcTokenId.OPCODE_END);
    }
    
    private static final void addKeyword(CsoundOrcTokenId id) {
       keywords.put(id.getFixedText(), id);
    }
    
    private static final int EOF = LexerInput.EOF;
    private LexerRestartInfo<CsoundOrcTokenId> info;
    private LexerInput input;
    TokenFactory<CsoundOrcTokenId> tokenFactory;

    public CsoundOrcHLexer(LexerRestartInfo<CsoundOrcTokenId> info) {
        this.info = info;
        this.input = info.input();
        tokenFactory = info.tokenFactory();
    }

    @Override
    public org.netbeans.api.lexer.Token<CsoundOrcTokenId> nextToken() {

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
                                return token(CsoundOrcTokenId.STRING);
                            case '\n':
                            case EOF:
                                return token(CsoundOrcTokenId.ERROR);
                        }
                    }
                    
                case '{':
                    if(input.read() == '{') {
                        while (true) {
                            switch (input.read()) {
                                case '}':
                                    if(input.read() == '}') {
                                        return token(CsoundOrcTokenId.STRING);
                                    } else {
                                        input.backup(1);
                                    }
                                    break;
                                case EOF:
                                    return token(CsoundOrcTokenId.ERROR);
                            }
                        }
                    } else {
                        input.backup(1);
                        return token(CsoundOrcTokenId.ERROR);
                    }
                
                case '+':
                case '-':
                case '*':
                case '%':
                    return token(CsoundOrcTokenId.OPERATOR);
                case '/':
                    switch (input.read()) {
                        case '/': // in single-line comment
                            while (true) {
                                switch (input.read()) {
                                    case '\r':
                                        input.consumeNewline();
                                    case '\n':
                                    case EOF:
                                        return token(CsoundOrcTokenId.SL_COMMENT);
                                }
                            }
                        case '*': // in multi-line comment
                            while (true) {
                                ch = input.read();
                                while (ch == '*') {
                                    ch = input.read();
                                    if (ch == '/') {
                                        return token(CsoundOrcTokenId.ML_COMMENT);
                                    } else if (ch == EOF) {
                                        return token(
                                                CsoundOrcTokenId.ML_COMMENT_INCOMPLETE);
                                    }
                                }
                                if (ch == EOF) {
                                    return token(
                                            CsoundOrcTokenId.ML_COMMENT_INCOMPLETE);
                                }
                            }
                    }
                    input.backup(1);
                    return token(CsoundOrcTokenId.OPERATOR);
                    
                case ';':
                    while (true) {
                        switch (input.read()) {
                            case '\r':
                                input.consumeNewline();
                            case '\n':
                            case EOF:
                                return token(CsoundOrcTokenId.SL_COMMENT);
                        }
                    }
                    
                case '(':
                    return token(CsoundOrcTokenId.LPAREN);

                case ')':
                    return token(CsoundOrcTokenId.RPAREN);

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
                        return token(CsoundOrcTokenId.WS);
                    }

                    if (Character.isLetter((char) ch)) { // identifier or keyword
                        while (true) {
                            if (ch == EOF || 
                                    !(Character.isLetter((char) ch) ||
                                    Character.isDigit((char) ch) ||
                                    ch == '_') ) {
                                input.backup(1); // backup the extra char (or EOF)
                                // Check for keywords
                                CharSequence word = input.readText();
                                CsoundOrcTokenId id = keywords.get(word);
                                if (id == null) {
                                    
                                    if(opcodeNames.contains(word)) {
                                        id = CsoundOrcTokenId.OPCODE;
                                    } else {
                                        id = CsoundOrcTokenId.CHAR;
                                    }
                                    
                                }
                                return token(id);
                            }
                            ch = input.read(); // read next char
                        }
                    }

                    return token(CsoundOrcTokenId.CHAR);
            }


        }

    }
    

    @Override
    public Object state() {
        return null;
    }

    @Override
    public void release() {
    }

    private Token<CsoundOrcTokenId> finishIntOrFloatLiteral(int ch) {
        boolean floatLiteral = false;
        boolean inExponent = false;
        while (true) {
            switch (ch) {
                case '.':
                    if (floatLiteral) {
                        return token(CsoundOrcTokenId.MYFLOAT);
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
                        return token(CsoundOrcTokenId.MYFLOAT);
                    } else {
                        floatLiteral = true;
                        inExponent = true;
                    }
                    break;
                default:
                    input.backup(1);
                    return token(floatLiteral ? CsoundOrcTokenId.MYFLOAT
                            : CsoundOrcTokenId.INT);
            }
            ch = input.read();
        }
    }

    private Token<CsoundOrcTokenId> token(CsoundOrcTokenId id) {
        return (id.getFixedText() != null)
                ? tokenFactory.getFlyweightToken(id, id.getFixedText())
                : tokenFactory.createToken(id);
    }
}
