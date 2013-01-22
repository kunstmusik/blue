/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.clojure;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.netbeans.spi.lexer.LanguageHierarchy;
import org.netbeans.spi.lexer.Lexer;
import org.netbeans.spi.lexer.LexerRestartInfo;

/**
 *
 * @author stevenyi
 */
public class ClojureLanguageHierarchy extends LanguageHierarchy<ClojureTokenId> {
    
    private static List<ClojureTokenId> tokens = null;
    private static Map<Integer, ClojureTokenId> idToToken;

    /**
     * Initializes the list of tokens with IDs generated from the ANTLR
     * token file.
     */
    private static void init() {
        AntlrTokenReader reader = new AntlrTokenReader();
        tokens = reader.readTokenFile();
        idToToken = new HashMap<Integer, ClojureTokenId>();
        for (ClojureTokenId token : tokens) {
            idToToken.put(token.ordinal(), token);
        }
    }

    /**
     * Initializes the tokens in use.
     *
     * @return
     */
    @Override
    protected synchronized Collection<ClojureTokenId> createTokenIds() {
        if (tokens == null) {
            init();
        }
        return tokens;
    }

    protected synchronized Lexer<ClojureTokenId> createLexer(LexerRestartInfo<ClojureTokenId> info) {
        return new ClojureEditorLexer(info);
    }

    /**
     * Returns an actual ClojureTokenId from an id. This essentially allows
     * the syntax highlighter to decide the color of specific words.
     * @param id
     * @return
     */
    static synchronized ClojureTokenId getToken(int id) {
        if (idToToken == null) {
            init();
        }
        return idToToken.get(id);
    }
    
    
    protected String mimeType() {
        return "text/x-clojure";
    }

}
