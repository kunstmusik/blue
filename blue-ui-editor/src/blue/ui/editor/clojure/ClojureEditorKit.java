/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.clojure;

import blue.ui.editor.csound.orc.*;
import blue.ui.editor.csound.orc.actions.AddSemiColonLineCommentAction;
import blue.ui.editor.csound.orc.actions.RemoveSemiColonLineCommentAction;
import javax.swing.Action;
import javax.swing.JEditorPane;
import javax.swing.text.Document;
import javax.swing.text.TextAction;
import org.netbeans.api.lexer.Language;
import org.netbeans.modules.editor.NbEditorDocument;
import org.netbeans.modules.editor.NbEditorKit;
import org.openide.util.Utilities;

/**
 *
 * @author stevenyi
 */
public class ClojureEditorKit extends NbEditorKit {

    @Override
    protected Action[] createActions() {
        Action[] csOrcActions =  new Action[] {
            new AddSemiColonLineCommentAction(),
            new RemoveSemiColonLineCommentAction()
        };
        
        return TextAction.augmentList(super.createActions(), csOrcActions);
    }
    
    @Override
    public void install(JEditorPane c) {
        super.install(c);
        c.getInputMap().put(Utilities.stringToKey("D-SEMICOLON"), AddSemiColonLineCommentAction.ACTION_NAME);
        c.getInputMap().put(Utilities.stringToKey("DS-SEMICOLON"), RemoveSemiColonLineCommentAction.ACTION_NAME);
    }
    
    @Override
    public Document createDefaultDocument() {
        
        Document doc = new ClojureEditorDocument(getContentType());
        doc.putProperty(Language.class, ClojureTokenId.language());
        return doc;
        
    }
    
    @Override
    public String getContentType() {
        return "text/x-clojure";
    }
    
    public class ClojureEditorDocument extends NbEditorDocument {

        public ClojureEditorDocument(String mimeType) {
            super(mimeType);
        }
    }
}
