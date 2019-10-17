/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.orc;

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
public class CsoundOrcLanguageHierarchy extends LanguageHierarchy<CsoundOrcTokenId> {
    
    private static List<CsoundOrcTokenId> tokens = new ArrayList<>();
   

    static {
        
        for (CsoundOrcTokenId token : CsoundOrcTokenId.values()) {
            tokens.add(token);
        }
    }

    @Override
    protected synchronized Collection<CsoundOrcTokenId> createTokenIds() {
        return tokens;
    }

    @Override
    protected synchronized Lexer<CsoundOrcTokenId> createLexer(LexerRestartInfo<CsoundOrcTokenId> info) {
        return new CsoundOrcHLexer(info);
    }

    @Override
    protected String mimeType() {
        return "text/x-csound-orc";
    }

}
