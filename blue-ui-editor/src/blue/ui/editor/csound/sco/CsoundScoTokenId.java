/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.sco;

import org.netbeans.api.lexer.Language;
import org.netbeans.api.lexer.TokenId;

/**
 *
 * @author stevenyi
 */
public enum CsoundScoTokenId implements TokenId {

    CHAR(null, "character"),
    STRING(null, "string"),
    IDENTIFIER(null, "identifier"),
    COMMENT(null, "comment"),
    KEYWORD(null, "keyword"),
    MYFLOAT(null, "constant"),
    INT(null, "constant"),
    WS(null, "whitespace"),
    OPERATOR(null, "operator"),
    SL_COMMENT(null, "comment"),
    ML_COMMENT(null, "comment"),
    ML_COMMENT_INCOMPLETE(null, "error"),
    LPAREN("(", "separator"),
    RPAREN(")", "separator"),
    LBRACKET("[", "separator"),
    RBRACKET("]", "separator"),
    ERROR(null, "error");
    
    
    private static final Language<CsoundScoTokenId> language =
            new CsoundScoLanguageHierarchy().language();
    private final String fixedText;
    private final String primaryCategory;
//    private final int id;

    private CsoundScoTokenId(String fixedText, String primaryCategory) {
        this.fixedText = fixedText;
        this.primaryCategory = primaryCategory;
//        this.id = id;
    }
    
    public String getFixedText() {
        return fixedText;
    }

    @Override
    public String primaryCategory() {
        return primaryCategory;
    }

    public static final Language<CsoundScoTokenId> language() {
        return language;
    }
}
