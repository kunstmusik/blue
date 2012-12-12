/*
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS HEADER.
 *
 * Copyright 1997-2010 Oracle and/or its affiliates. All rights reserved.
 *
 * Oracle and Java are registered trademarks of Oracle and/or its affiliates.
 * Other names may be trademarks of their respective owners.
 *
 * The contents of this file are subject to the terms of either the GNU
 * General Public License Version 2 only ("GPL") or the Common
 * Development and Distribution License("CDDL") (collectively, the
 * "License"). You may not use this file except in compliance with the
 * License. You can obtain a copy of the License at
 * http://www.netbeans.org/cddl-gplv2.html
 * or nbbuild/licenses/CDDL-GPL-2-CP. See the License for the
 * specific language governing permissions and limitations under the
 * License.  When distributing the software, include this License Header
 * Notice in each file and include the License file at
 * nbbuild/licenses/CDDL-GPL-2-CP.  Oracle designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Oracle in the GPL Version 2 section of the License file that
 * accompanied this code. If applicable, add the following below the
 * License Header, with the fields enclosed by brackets [] replaced by
 * your own identifying information:
 * "Portions Copyrighted [year] [name of copyright owner]"
 *
 * Contributor(s):
 *
 * The Original Software is NetBeans. The Initial Developer of the Original
 * Software is Sun Microsystems, Inc. Portions Copyright 1997-2006 Sun
 * Microsystems, Inc. All Rights Reserved.
 *
 * If you wish your version of this file to be governed by only the CDDL
 * or only the GPL Version 2, indicate your decision by adding
 * "[Contributor] elects to include this software in this distribution
 * under the [CDDL or GPL Version 2] license." If you do not indicate a
 * single choice of license, a recipient has the option to distribute
 * your version of this file under either the CDDL, the GPL Version 2 or
 * to extend the choice of license to its licensees as provided above.
 * However, if you add GPL Version 2 code and therefore, elected the GPL
 * Version 2 license, then the option applies only if the new code is
 * made subject to such option by the copyright holder.
 */
package org.netbeans.modules.javascript.editing.lexer;

import java.io.IOException;

import org.netbeans.spi.lexer.Lexer;
import org.netbeans.spi.lexer.LexerInput;
import org.netbeans.spi.lexer.LexerRestartInfo;
import org.netbeans.spi.lexer.TokenFactory;
import org.openide.ErrorManager;
import org.mozilla.nb.javascript.CompilerEnvirons;
import org.mozilla.nb.javascript.Context;
import org.mozilla.nb.javascript.ContextFactory;
import org.mozilla.nb.javascript.ErrorReporter;
import org.mozilla.nb.javascript.EvaluatorException;
import org.mozilla.nb.javascript.Parser;
import org.mozilla.nb.javascript.Token;
import org.mozilla.nb.javascript.TokenStream;
//import org.netbeans.modules.javascript.editing.SupportedBrowsers;


/**
 * A scanner for JavaScript, using Rhino.
 *
  In correct lexing of regexps:
Effect.Transitions = {
  flicker: function(pos) {
    return ((-Math.cos(pos*Math.PI)/4) + 0.75) + Math.random()/4;
  }
};
 *
 *
 * @todo Handle language versions
 * @todo Handle XML tokens
 * @todo Handle Regular expressions
 * @todo Gotta handle stringBufferTop and some other tokenstream state
 * 
 * @todo Finding out that something is a regexp is apparently a parse-time operation in JavaScript?
 *   Do this via semantic highlighting instead (but will that screw up lexed-based identification of
 *   matching delimiters etc.?
 * @todo Regexp handling is kinda funky. I'm right now always trying regexp lexing when I see / or /=
 *   - will that cause problems lexing x = 500/3/2 ? I see /3/ as a regexp here but it isn't - I need
 *     to look at flags (only literal context apparently applies)
 *   Attempt to find regexps. Something about "literal context" for the parser. Investigate what that means.
 *   Empirically, if you see a "/" after a (possibly whitespace separated) comma, =, or left paren, or
 *   some kind of operator like !, it's a regexp, otherwise it's division (or maybe a comment.) 
 *   It's never an empty regexp. (Also make sure you don't hit the second/ending part.)
 *
 * @author Tor Norbye
 */
public final class JsLexer implements Lexer<JsTokenId> {
    public static final String COMMENT_CAT = "comment";
    public static final String KEYWORD_CAT = "keyword"; // NOI18N
    public static final String REGEXP_CAT = "mod-regexp"; // NOI18N
    public static final String STRING_CAT = "string"; // NOI18N
    public static final String WHITESPACE_CAT = "whitespace"; // NOI18N
    public static final String OPERATOR_CAT = "operator"; // NOI18N
    public static final String SEPARATOR_CAT = "separator"; // NOI18N
    public static final String ERROR_CAT = "error"; // NOI18N
    public static final String NUMBER_CAT = "number"; // NOI18N
    public static final String IDENTIFIER_CAT = "identifier"; // NOI18N

    private static final boolean DEBUG_TOKENS = false;
    /** This is still not working; I wonder if release() is called correctly at all times...*/
    private static final boolean REUSE_LEXERS = false;
    private static JsLexer cached;
    private LexerInput input;
    private TokenFactory<JsTokenId> tokenFactory;
    private Parser parser;
    private TokenStream tokenStream;

    private JsLexer(LexerRestartInfo<JsTokenId> info) {
        // TODO Use Rhino's scanner and TokenStream classes.
        // Unfortunately, they don't provide access... I'll need a hacked version of
        // Rhino!
        CompilerEnvirons compilerEnv = new CompilerEnvirons();
        ErrorReporter errorReporter =
            new ErrorReporter() {

            public void warning(String message, String sourceName, int line, String lineSource, int lineOffset, String id, Object params) {
            }

            public void error(String message, String sourceName, int line, String lineSource, int lineOffset, String id, Object params) {
            }

            public EvaluatorException runtimeError(String message, String sourceName, int line, String lineSource, int lineOffset) {
                return null;
            }
        };

        RhinoContext ctx = new RhinoContext();
        compilerEnv.initFromContext(ctx);

        compilerEnv.setErrorReporter(errorReporter);
        compilerEnv.setGeneratingSource(false);
        compilerEnv.setGenerateDebugInfo(false);

//        final int targetVersion = SupportedBrowsers.getInstance().getLanguageVersion();
        final int targetVersion = Context.VERSION_DEFAULT;
        compilerEnv.setLanguageVersion(targetVersion);

        if (targetVersion >= Context.VERSION_1_7) {
            // Let's try E4X... why not?
            compilerEnv.setXmlAvailable(true);
        }
        // XXX What do I set here: compilerEnv.setReservedKeywordAsIdentifier();

        // The parser is NOT used for parsing here, but the Rhino scanner
        // calls into the parser for error messages. So we register our own error
        // handler for the parser and pass it into the tokenizer to handle errors.
        parser = new Parser(compilerEnv, errorReporter);

        tokenStream = new TokenStream(parser, null, null, "", 0);
    }

    public static synchronized JsLexer create(LexerRestartInfo<JsTokenId> info) {
        JsLexer rubyLexer = cached;

        if (rubyLexer == null) {
            rubyLexer = new JsLexer(info);
        }

        rubyLexer.restart(info);

        return rubyLexer;
    }

    void restart(LexerRestartInfo<JsTokenId> info) {
        input = info.input();
        tokenFactory = info.tokenFactory();
        tokenStream.setInput(info.input());
        Object state = info.state();
        tokenStream.fromState(state);

        // Ensure that the parser instance is pointing to the same tokenstream instance
        // such that its error handler etc. is synchronized
        parser.setTokenStream(tokenStream);

        // For debugging only
        //this.buffer = buffer;
    }

    public void release() {
        if (REUSE_LEXERS) {
            // Possibly reset the structures that could cause memory leaks
            synchronized (JsLexer.class) {
                cached = this;
            }
        }
    }

    public Object state() {
        return tokenStream.toState();
    }

    private org.netbeans.api.lexer.Token<JsTokenId> token(JsTokenId id, int length) {
        String fixedText = id.fixedText();

        return (fixedText != null) ? tokenFactory.getFlyweightToken(id, fixedText)
                                   : tokenFactory.createToken(id, length);
    }

    public org.netbeans.api.lexer.Token<JsTokenId> nextToken() {

        int token;

        try {
            token = tokenStream.getToken() & Parser.CLEAR_TI_MASK;
        } catch (IOException ex) {
            ErrorManager.getDefault().notify(ex);
            token = org.mozilla.nb.javascript.Token.ERROR;
        }

//        if (DEBUG_TOKENS) {
//            for (int i = 0; i < tokenLength; i++) {
//                System.out.print(buffer.charAt(oldOffset + i));
//            }
//
//            System.out.println(" = " + token + ": " + org.mozilla.nb.javascript.Token.name(token));
//        }

        // Map to IDE types
        JsTokenId tokenType = getTokenId(token);
        int tokenLength = input.readLength();
        if (tokenLength < 1) {
            if (token == Token.EOF) {
                return null;
            }
        }

        return token(tokenType, tokenLength);
    }
    
    /** @todo Move classification of tokens into TokenTypes into JJs somehow */
    private JsTokenId getTokenId(int token) {
        // If you add any new token types here, remember to update #getRelevantTokenTypes below
        switch (token) {
        case 65535: // SIGN ERRORS! Why does this happen?
        case Token.ERROR://          = -1, // well-known as the only code < EOF
            return JsTokenId.ERROR;
        case Token.LINE_COMMENT:
            return JsTokenId.LINE_COMMENT;
        case Token.BLOCK_COMMENT:
            return JsTokenId.BLOCK_COMMENT;
        case Token.NEW:
            return JsTokenId.NEW;
        case Token.DOT:
            return JsTokenId.DOT;
        case Token.WHITESPACE://     = 153,
        case Token.EOF://            = 0,  // end of file token - (not EOF_CHAR)
            return JsTokenId.WHITESPACE;
        case Token.EOL://            = 1,  // end of line
            return JsTokenId.EOL;
        case Token.FUNCTION:
            return JsTokenId.FUNCTION;
        case Token.THIS:
            return JsTokenId.THIS;
        case Token.FOR:
            return JsTokenId.FOR;
        case Token.IF:
            return JsTokenId.IF;
        case Token.WHILE:
            return JsTokenId.WHILE;
        case Token.ELSE:
            return JsTokenId.ELSE;
        case Token.CASE:
            return JsTokenId.CASE;
        case Token.DEFAULT:
            return JsTokenId.DEFAULT;
        case Token.BREAK:
            return JsTokenId.BREAK;
        case Token.SWITCH:
            return JsTokenId.SWITCH;
        case Token.DO:
        case Token.WITH:
        case Token.CATCH:
        case Token.CONST:
        case Token.CONTINUE:
        case Token.DELPROP:
        case Token.EXPORT:
        case Token.FALSE:
        case Token.FINALLY:
        case Token.IMPORT:
        case Token.IN:
        case Token.INSTANCEOF:
        case Token.NULL:
        case Token.RESERVED:
        case Token.RETURN:
        case Token.THROW:
        case Token.TRUE:
        case Token.TRY:
        case Token.TYPEOF:
        case Token.UNDEFINED:
        case Token.VAR:
        case Token.VOID:
        case Token.GOTO:
        case Token.YIELD:
        case Token.LET:
        case Token.DEBUGGER:
            return JsTokenId.ANY_KEYWORD;
        case Token.NUMBER:
            return JsTokenId.FLOAT_LITERAL;
        case Token.STRING_BEGIN:
            return JsTokenId.STRING_BEGIN;
        case Token.STRING:
            return JsTokenId.STRING_LITERAL;
        case Token.STRING_END:
            return JsTokenId.STRING_END;
        case Token.DIV:
            return JsTokenId.NONUNARY_OP;
        case Token.ASSIGN_DIV: 
            return JsTokenId.ANY_OPERATOR;
        case Token.REGEXP_BEGIN:
            return JsTokenId.REGEXP_BEGIN;
        case Token.REGEXP:
            return JsTokenId.REGEXP_LITERAL;
        case Token.REGEXP_END:
            return JsTokenId.REGEXP_END;
        case Token.IFEQ://           = 6,
        case Token.IFNE://           = 7,
        case Token.BITOR://          = 9,
        case Token.BITXOR://         = 10,
        case Token.BITAND://         = 11,
        case Token.EQ://             = 12,
        case Token.NE://             = 13,
        case Token.LT://             = 14,
        case Token.LE://             = 15,
        case Token.GT://             = 16,
        case Token.GE://             = 17,
        case Token.LSH://            = 18,
        case Token.RSH://            = 19,
        case Token.URSH://           = 20,
        case Token.ADD://            = 21,
        case Token.SUB://            = 22,
        case Token.MUL://            = 23,
        case Token.MOD://            = 25,
        case Token.NOT://            = 26,
        case Token.BITNOT://         = 27,
        case Token.POS://            = 28,
        case Token.SHEQ://           = 45,   // shallow equality (===)
        case Token.SHNE://           = 46,   // shallow inequality (!==)
        case Token.ASSIGN://         = 86,  // simple assignment  (=)
        case Token.ASSIGN_BITOR://   = 87,  // |=
        case Token.ASSIGN_BITXOR://  = 88,  // ^=
        case Token.ASSIGN_BITAND://  = 89,  // |=
        case Token.ASSIGN_LSH://     = 90,  // <<=
        case Token.ASSIGN_RSH://     = 91,  // >>=
        case Token.ASSIGN_URSH://    = 92,  // >>>=
        case Token.ASSIGN_ADD://     = 93,  // +=
        case Token.ASSIGN_SUB://     = 94,  // -=
        case Token.ASSIGN_MUL://     = 95,  // *=
        case Token.ASSIGN_MOD://     = 97;  // %=
        case Token.OR://             = 100, // logical or (||)
        case Token.AND://            = 101, // logical and (&&)
        case Token.HOOK://           = 98, // conditional (?:)
            return JsTokenId.NONUNARY_OP;
        case Token.COLON://          = 99,
            return JsTokenId.COLON;
            // I don't want to treat it as a nonunary operator since formatting doesn't
            // handle it well yet
        case Token.COMMA://          = 85,  // comma operator
            return JsTokenId.ANY_OPERATOR;

        case Token.NAME://           = 38,
            return JsTokenId.IDENTIFIER;
        case Token.NEG://            = 29,
        case Token.INC://            = 102, // increment/decrement (++ --)
        case Token.DEC://            = 103,
            return JsTokenId.ANY_OPERATOR;
        case Token.ARRAYLIT://       = 63, // array literal
        case Token.OBJECTLIT://      = 64, // object literal
            // XXX What do I do about these?
            return JsTokenId.IDENTIFIER;
        case Token.SEMI:
            return JsTokenId.SEMI;
        case Token.LB:
            return JsTokenId.LBRACKET;
        case Token.RB:
            return JsTokenId.RBRACKET;
        case Token.LC:
            return JsTokenId.LBRACE;
        case Token.RC:
            return JsTokenId.RBRACE;
        case Token.LP:
            return JsTokenId.LPAREN;
        case Token.RP:
            return JsTokenId.RPAREN;
        default:
            return JsTokenId.IDENTIFIER;
        }
    }

    private static final class RhinoContext extends org.mozilla.nb.javascript.Context {
        public RhinoContext() {
            super(ContextFactory.getGlobal());
        }
    } // End of RhinoContext
}
