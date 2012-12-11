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

import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;

import org.netbeans.api.lexer.InputAttributes;
import org.netbeans.api.lexer.Language;
import org.netbeans.api.lexer.LanguagePath;
import org.netbeans.api.lexer.Token;
import org.netbeans.api.lexer.TokenId;
import org.netbeans.spi.lexer.LanguageEmbedding;
import org.netbeans.spi.lexer.LanguageHierarchy;
import org.netbeans.spi.lexer.Lexer;
import org.netbeans.spi.lexer.LexerRestartInfo;
import static org.netbeans.modules.javascript.editing.lexer.JsLexer.*;


/**
 * @todo Update for JavaScript
 * @todo I should handle embeddings of =begin/=end token pairs such that they
 *   get comment/rdoc highlighting!
 * 
 * @author Tor Norbye
 */
public enum JsTokenId implements TokenId {
    ERROR(null, ERROR_CAT),
    NEW("new", KEYWORD_CAT), // NOI18N
    
    IDENTIFIER(null, IDENTIFIER_CAT),
    REGEXP_LITERAL(null, REGEXP_CAT),
    FLOAT_LITERAL(null, NUMBER_CAT),
    STRING_LITERAL(null, STRING_CAT),
    WHITESPACE(null, WHITESPACE_CAT),
    EOL(null, WHITESPACE_CAT),
    LINE_COMMENT(null, COMMENT_CAT),
    BLOCK_COMMENT(null, COMMENT_CAT),
    LPAREN("(", SEPARATOR_CAT),
    RPAREN(")", SEPARATOR_CAT),
    LBRACE("{", SEPARATOR_CAT),
    RBRACE("}", SEPARATOR_CAT),
    LBRACKET("[", SEPARATOR_CAT),
    RBRACKET("]", SEPARATOR_CAT),
    STRING_BEGIN(null, STRING_CAT),
    STRING_END(null, STRING_CAT),
    REGEXP_BEGIN(null, REGEXP_CAT), // or separator,
    REGEXP_END(null, REGEXP_CAT),
    // Cheating: out of laziness just map all keywords returning from JRuby
    // into a single KEYWORD token; eventually I will have separate tokens
    // for each here such that the various helper methods for formatting,
    // smart indent, brace matching etc. can refer to specific keywords
    ANY_KEYWORD(null, KEYWORD_CAT),
    ANY_OPERATOR(null, OPERATOR_CAT),
    DOT(null, OPERATOR_CAT),
    THIS("this", KEYWORD_CAT), // NOI18N
    FOR("for", KEYWORD_CAT), // NOI18N
    IF("if", KEYWORD_CAT), // NOI18N
    ELSE("else", KEYWORD_CAT), // NOI18N
    WHILE("while", KEYWORD_CAT), // NOI18N
    CASE("case", KEYWORD_CAT), // NOI18N
    DEFAULT("default", KEYWORD_CAT), // NOI18N
    BREAK("break", KEYWORD_CAT), // NOI18N
    SWITCH("switch", KEYWORD_CAT), // NOI18N

    COLON(":", OPERATOR_CAT), // NOI18N
    
    SEMI(";", OPERATOR_CAT), // NOI18N
    FUNCTION("function", KEYWORD_CAT), // NOI18N
    
    // Non-unary operators which indicate a line continuation if used at the end of a line
    NONUNARY_OP(null, OPERATOR_CAT);

    private final String fixedText;
    private final String primaryCategory;


    JsTokenId(String fixedText, String primaryCategory) {
        this.fixedText = fixedText;
        this.primaryCategory = primaryCategory;
    }

    public String fixedText() {
        return fixedText;
    }

    public String primaryCategory() {
        return primaryCategory;
    }

    private static final Language<JsTokenId> language =
        new LanguageHierarchy<JsTokenId>() {
                protected String mimeType() {
                    return JsTokenId.JAVASCRIPT_MIME_TYPE;
                }

                protected Collection<JsTokenId> createTokenIds() {
                    return EnumSet.allOf(JsTokenId.class);
                }

                @Override
                protected Map<String, Collection<JsTokenId>> createTokenCategories() {
                    Map<String, Collection<JsTokenId>> cats =
                        new HashMap<String, Collection<JsTokenId>>();
                    return cats;
                }

                protected Lexer<JsTokenId> createLexer(LexerRestartInfo<JsTokenId> info) {
                    return JsLexer.create(info);
                }

                @Override
                protected LanguageEmbedding<?> embedding(Token<JsTokenId> token,
                    LanguagePath languagePath, InputAttributes inputAttributes) {
//                    JsTokenId id = token.id();
//
//                    if (id == STRING_LITERAL) {
//                        return LanguageEmbedding.create(JsStringTokenId.language(), 0, 0);
//                    } else if (id == BLOCK_COMMENT || id == LINE_COMMENT) {
//                        return LanguageEmbedding.create(JsCommentTokenId.language(), 0, 0);
//                    }

                    return null; // No embedding
                }
            }.language();

    public static Language<JsTokenId> language() {
        return language;
    }



   


    /**
     * MIME type for JavaScript. Don't change this without also consulting the various XML files
     * that cannot reference this value directly.
     */
    public static final String JAVASCRIPT_MIME_TYPE = "text/javascript"; // NOI18N
    
}
