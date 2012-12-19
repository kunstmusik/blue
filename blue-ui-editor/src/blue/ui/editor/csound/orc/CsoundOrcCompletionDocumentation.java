/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.orc;

import java.net.URL;
import javax.swing.Action;
import org.netbeans.spi.editor.completion.CompletionDocumentation;

/**
 *
 * @author stevenyi
 */
public class CsoundOrcCompletionDocumentation implements CompletionDocumentation {
    private final String docText;
    private final URL url;

    public CsoundOrcCompletionDocumentation(String docText, URL url) {
        this.docText = docText;
        this.url = url;
    }
    
    @Override
    public String getText() {
        return docText;
    }

    @Override
    public URL getURL() {
        return url;
    }

    @Override
    public CompletionDocumentation resolveLink(String link) {
        if(link.endsWith(".html")) {
            String opName = link.substring(0, link.length() - 5);
            String doc = OpcodeDocumentation.getOpcodeDocumentation(opName);
            if(doc != null) {
                URL url = OpcodeDocumentation.getOpcodeDocumentationUrl(opName);
                return new CsoundOrcCompletionDocumentation(doc, url);
            }
        }
        return null;
    }

    @Override
    public Action getGotoSourceAction() {
        return null;
    }
    
}
