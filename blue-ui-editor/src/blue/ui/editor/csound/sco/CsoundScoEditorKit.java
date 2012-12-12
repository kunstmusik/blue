/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.sco;

import blue.ui.editor.csound.orc.*;
import javax.swing.text.Document;
import org.netbeans.api.lexer.Language;
import org.netbeans.modules.editor.NbEditorDocument;
import org.netbeans.modules.editor.NbEditorKit;

/**
 *
 * @author stevenyi
 */
public class CsoundScoEditorKit extends NbEditorKit {

    @Override
    public Document createDefaultDocument() {
        
        Document doc = new CsoundScoEditorDocument(getContentType());
        doc.putProperty(Language.class, CsoundScoTokenId.language());
        return doc;
        
    }
    
    @Override
    public String getContentType() {
        return "text/x-csound-sco";
    }
    
    public class CsoundScoEditorDocument extends NbEditorDocument {

        public CsoundScoEditorDocument(String mimeType) {
            super(mimeType);
        }
    }
}
