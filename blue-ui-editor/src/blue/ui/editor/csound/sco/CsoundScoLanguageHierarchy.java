/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.sco;

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
public class CsoundScoLanguageHierarchy extends LanguageHierarchy<CsoundScoTokenId> {
    
    private static List<CsoundScoTokenId> tokens = new ArrayList<>();
   

    static {
        
        for (CsoundScoTokenId token : CsoundScoTokenId.values()) {
            tokens.add(token);
        }
    }

    @Override
    protected synchronized Collection<CsoundScoTokenId> createTokenIds() {
        return tokens;
    }

    @Override
    protected synchronized Lexer<CsoundScoTokenId> createLexer(LexerRestartInfo<CsoundScoTokenId> info) {
        return new CsoundScoHLexer(info);
    }

    @Override
    protected String mimeType() {
        return "text/x-csound-sco";
    }

}
