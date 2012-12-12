/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.blueSynthBuilder;

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
public class BlueSynthBuilderEditorKit extends NbEditorKit {

    @Override
    protected Action[] createActions() {
        Action[] bsbActions =  new Action[] {
            new AddSemiColonLineCommentAction(),
            new RemoveSemiColonLineCommentAction()
        };
        
        return TextAction.augmentList(super.createActions(), bsbActions);
    }

    @Override
    public void install(JEditorPane c) {
        super.install(c);
        c.getInputMap().put(Utilities.stringToKey("D-SEMICOLON"), AddSemiColonLineCommentAction.ACTION_NAME);
        c.getInputMap().put(Utilities.stringToKey("DS-SEMICOLON"), RemoveSemiColonLineCommentAction.ACTION_NAME);
    }

    
    
    @Override
    public Document createDefaultDocument() {
        
        Document doc = new BlueSynthBuilderEditorDocument(getContentType());
        doc.putProperty(Language.class, CsoundOrcTokenId.language());
        return doc;
        
    }
    
    @Override
    public String getContentType() {
        return "text/x-blue-synth-builder";
    }
    
    public class BlueSynthBuilderEditorDocument extends NbEditorDocument {
        
        public BlueSynthBuilderEditorDocument(String mimeType) {
            super(mimeType);
        }
    }
}
