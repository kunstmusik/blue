/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.blueSynthBuilder;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.netbeans.spi.lexer.LanguageHierarchy;
import org.netbeans.spi.lexer.Lexer;
import org.netbeans.spi.lexer.LexerRestartInfo;

/**
 *
 * @author stevenyi
 */
public class BSBLanguageHierarchy extends LanguageHierarchy<BSBTokenId> {
    
    private static List<BSBTokenId> tokens = new ArrayList<>();
   

    static {
        
        for (BSBTokenId token : BSBTokenId.values()) {
            tokens.add(token);
        }
    }

    @Override
    protected synchronized Collection<BSBTokenId> createTokenIds() {
        return tokens;
    }

    @Override
    protected synchronized Lexer<BSBTokenId> createLexer(LexerRestartInfo<BSBTokenId> info) {
        return new BSBHLexer(info);
    }

    @Override
    protected String mimeType() {
        return "text/x-blue-synth-builder";
    }

}
