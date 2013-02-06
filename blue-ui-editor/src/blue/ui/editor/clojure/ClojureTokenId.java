/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.clojure;

import org.netbeans.api.lexer.Language;
import org.netbeans.api.lexer.TokenId;

/**
 *
 * @author stevenyi
 */
public class ClojureTokenId implements TokenId {
    
    private static final Language<ClojureTokenId> language =
            new ClojureLanguageHierarchy().language();
    
    private final String name;
    private final String primaryCategory;
    private final int id;

    public ClojureTokenId(String name,
            String primaryCategory,
            int id) {
        this.name = name;
        this.primaryCategory = primaryCategory;
        this.id = id;
    }
    
    @Override
    public String name() {
        return name;
    }

    @Override
    public int ordinal() {
        return id;
    }

    @Override
    public String primaryCategory() {
        return primaryCategory;
    }

    public static final Language<ClojureTokenId> language() {
        return language;
    }
}
