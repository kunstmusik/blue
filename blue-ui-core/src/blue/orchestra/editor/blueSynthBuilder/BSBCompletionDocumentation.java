/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.orchestra.editor.blueSynthBuilder;

import java.net.URL;
import javax.swing.Action;
import org.netbeans.spi.editor.completion.CompletionDocumentation;

/**
 *
 * @author stevenyi
 */
public class BSBCompletionDocumentation implements CompletionDocumentation {
    private final String docText;

    public BSBCompletionDocumentation(String docText) {
        this.docText = docText;
    }
    
    @Override
    public String getText() {
        return docText;
    }

    @Override
    public URL getURL() {
        return null;
    }

    @Override
    public CompletionDocumentation resolveLink(String link) {
        System.err.println("LINK: " + link);
        return null;
    }

    @Override
    public Action getGotoSourceAction() {
        return null;
    }
    
}
