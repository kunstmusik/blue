/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.blueSynthBuilder;

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
public class BSBHLexer implements Lexer<BSBTokenId> {

    private static final Map<String,BSBTokenId> keywords = new HashMap<>();
    
    private static final Set<String> opcodeNames = CsoundManualUtilities.getOpcodeNames();
    
    static {
        addKeyword(BSBTokenId.INSTR_START);
        addKeyword(BSBTokenId.INSTR_END);
        addKeyword(BSBTokenId.OPCODE_START);
        addKeyword(BSBTokenId.OPCODE_END);
    }
    
    private static final void addKeyword(BSBTokenId id) {
       keywords.put(id.getFixedText(), id);
    }
    
    private static final int EOF = LexerInput.EOF;
    private LexerRestartInfo<BSBTokenId> info;
    private LexerInput input;
    TokenFactory<BSBTokenId> tokenFactory;

    public BSBHLexer(LexerRestartInfo<BSBTokenId> info) {
        this.info = info;
        this.input = info.input();
        tokenFactory = info.tokenFactory();
    }

    @Override
    @SuppressWarnings("fallthrough")
    public org.netbeans.api.lexer.Token<BSBTokenId> nextToken() {

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
                                return token(BSBTokenId.STRING);
                            case '\n':
                            case EOF:
                                return token(BSBTokenId.ERROR);
                        }
                    }
                    
                case '{':
                    if(input.read() == '{') {
                        while (true) {
                            switch (input.read()) {
                                case '}':
                                    if(input.read() == '}') {
                                        return token(BSBTokenId.STRING);
                                    } else {
                                        input.backup(1);
                                    }
                                    break;
                                case EOF:
                                    return token(BSBTokenId.ERROR);
                            }
                        }
                    } else {
                        input.backup(1);
                        return token(BSBTokenId.ERROR);
                    }
                
                case '+':
                case '-':
                case '*':
                case '%':
                    return token(BSBTokenId.OPERATOR);
                case '/':
                    switch (input.read()) {
                        case '/': // in single-line comment
                            while (true) {
                                switch (input.read()) {
                                    case '\r':
                                        input.consumeNewline();
                                    case '\n':
                                    case EOF:
                                        return token(BSBTokenId.SL_COMMENT);
                                }
                            }
                        case '*': // in multi-line comment
                            while (true) {
                                ch = input.read();
                                while (ch == '*') {
                                    ch = input.read();
                                    if (ch == '/') {
                                        return token(BSBTokenId.ML_COMMENT);
                                    } else if (ch == EOF) {
                                        return token(
                                                BSBTokenId.ML_COMMENT_INCOMPLETE);
                                    }
                                }
                                if (ch == EOF) {
                                    return token(
                                            BSBTokenId.ML_COMMENT_INCOMPLETE);
                                }
                            }
                    }
                    input.backup(1);
                    return token(BSBTokenId.OPERATOR);
                    
                case ';':
                    while (true) {
                        switch (input.read()) {
                            case '\r':
                                input.consumeNewline();
                            case '\n':
                            case EOF:
                                return token(BSBTokenId.SL_COMMENT);
                        }
                    }
                    
                case '(':
                    return token(BSBTokenId.LPAREN);

                case ')':
                    return token(BSBTokenId.RPAREN);

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
                        return token(BSBTokenId.WS);
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
                                BSBTokenId id = keywords.get(word);
                                if (id == null) {
                                    
                                    if(opcodeNames.contains(word)) {
                                        id = BSBTokenId.OPCODE;
                                    } else {
                                        id = BSBTokenId.CHAR;
                                    }
                                    
                                }
                                return token(id);
                            }
                            ch = input.read(); // read next char
                        }
                    }

                    return token(BSBTokenId.CHAR);
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

    private Token<BSBTokenId> finishIntOrFloatLiteral(int ch) {
        boolean floatLiteral = false;
        boolean inExponent = false;
        while (true) {
            switch (ch) {
                case '.':
                    if (floatLiteral) {
                        return token(BSBTokenId.MYFLOAT);
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
                        return token(BSBTokenId.MYFLOAT);
                    } else {
                        floatLiteral = true;
                        inExponent = true;
                    }
                    break;
                default:
                    input.backup(1);
                    return token(floatLiteral ? BSBTokenId.MYFLOAT
                            : BSBTokenId.INT);
            }
            ch = input.read();
        }
    }

    private Token<BSBTokenId> token(BSBTokenId id) {
        return (id.getFixedText() != null)
                ? tokenFactory.getFlyweightToken(id, id.getFixedText())
                : tokenFactory.createToken(id);
    }
}
