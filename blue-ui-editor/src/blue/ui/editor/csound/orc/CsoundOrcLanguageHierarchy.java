/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.orc;

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
public class CsoundOrcLanguageHierarchy extends LanguageHierarchy<CsoundOrcTokenId> {
    
    private static List<CsoundOrcTokenId> tokens = new ArrayList<CsoundOrcTokenId>();
   

    static {
        
        for (CsoundOrcTokenId token : CsoundOrcTokenId.values()) {
            tokens.add(token);
        }
    }

    protected synchronized Collection<CsoundOrcTokenId> createTokenIds() {
        return tokens;
    }

    protected synchronized Lexer<CsoundOrcTokenId> createLexer(LexerRestartInfo<CsoundOrcTokenId> info) {
        return new CsoundOrcHLexer(info);
    }

    protected String mimeType() {
        return "text/x-csound-orc";
    }

}
